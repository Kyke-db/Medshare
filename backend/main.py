"""MedShare - API (FastAPI + SQLite). Ejecutar: uvicorn main:app --reload"""
import csv, hashlib, hmac, json, mimetypes, os, secrets, sqlite3, time
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE = Path(__file__).parent
DB = BASE / "medshare.db"
CSV = BASE / "data" / "pacientes.csv"
DIST = BASE.parent / "frontend" / "dist"
SECRET = os.getenv("MEDSHARE_SECRET", "cambia-esto-en-produccion")
CODE_2FA = "123456"  # 2FA simulado para la demo

# En Windows el registro puede asociar .js a text/plain y el navegador bloquea el script (pantalla en blanco)
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

app = FastAPI(title="MedShare")


# ---------- utilidades ----------
def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(8)
    return f"{salt}${hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100_000).hex()}"


def check_pw(pw, stored):
    return hmac.compare_digest(hash_pw(pw, stored.split("$")[0]), stored)


def make_token(uid, scope="access", hours=24):
    return jwt.encode({"sub": str(uid), "scope": scope, "exp": int(time.time() + hours * 3600)}, SECRET, "HS256")


def read_token(t, scope):
    try:
        p = jwt.decode(t, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sesión inválida o expirada")
    if p.get("scope") != scope:
        raise HTTPException(401, "Sesión inválida")
    return int(p["sub"])


def public(u):
    u = dict(u)
    u.pop("password_hash", None)
    u["conditions"] = json.loads(u.get("conditions") or "[]")
    return u


def current_user(authorization: str = Header("")):
    uid = read_token(authorization.removeprefix("Bearer "), "access")
    with db() as c:
        u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not u:
        raise HTTPException(401, "Usuario no encontrado")
    return public(u)


# ---------- base de datos ----------
def init():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, clinical_id TEXT UNIQUE, name TEXT,
            role TEXT DEFAULT 'patient', password_hash TEXT, birth_date TEXT, weight REAL, height REAL,
            conditions TEXT DEFAULT '[]', photo TEXT);
        CREATE TABLE IF NOT EXISTS patient_daily_logs(id INTEGER PRIMARY KEY, patient_id INTEGER, weight REAL,
            systolic INTEGER, diastolic INTEGER, micturition_count INTEGER, urine_amount TEXT,
            symptoms_json TEXT, notes TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, sender_id INTEGER, receiver_id INTEGER,
            content TEXT, is_read INTEGER DEFAULT 0, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
        """)
        if "photo" not in [r[1] for r in c.execute("PRAGMA table_info(users)")]:
            c.execute("ALTER TABLE users ADD COLUMN photo TEXT")  # migración de bases antiguas
        if c.execute("SELECT 1 FROM users").fetchone():
            return
        c.execute("INSERT INTO users(clinical_id,name,role,password_hash) VALUES('DOC-001','Dr. Carlos Mendoza','doctor',?)",
                  (hash_pw("doctor123"),))
        c.execute("INSERT INTO users(clinical_id,name,password_hash,birth_date,weight,height,conditions) "
                  "VALUES('PAC-001','Pedro Pérez González',?,'1985-03-14',70,172,?)",
                  (hash_pw("demo1234"), json.dumps(["Hipertensión arterial"])))
        for i in range(7):
            d = (date.today() - timedelta(days=6 - i)).isoformat()
            c.execute("INSERT INTO patient_daily_logs(patient_id,weight,systolic,diastolic,micturition_count,urine_amount,"
                      "symptoms_json,notes,created_at) VALUES(2,?,?,?,?,?,?,?,?)",
                      (70 + (i % 3) * .3, 118 + i, 76 + i % 4, 5 - i % 2, "intermedia", "[]", "", d))
        c.execute("INSERT INTO messages(sender_id,receiver_id,content,is_read) VALUES(1,2,'Hola Pedro, revisé tus registros de la semana. Se ven estables; sigue hidratándote bien.',0)")
        c.execute("INSERT INTO messages(sender_id,receiver_id,content,is_read) VALUES(1,2,'Recuerda no tomar ibuprofeno ni naproxeno sin consultarme antes.',0)")


init()
from chatbot import make_router
app.include_router(make_router(current_user))

# ---------- autenticación ----------
class Login(BaseModel):
    clinical_id: str
    password: str


class Register(Login):
    name: str
    birth_date: str = ""
    weight: float | None = None
    height: float | None = None


class Verify(BaseModel):
    challenge: str
    code: str


@app.post("/api/auth/register")
def register(b: Register):
    if len(b.password) < 6:
        raise HTTPException(422, "La contraseña debe tener al menos 6 caracteres")
    try:
        with db() as c:
            cur = c.execute("INSERT INTO users(clinical_id,name,password_hash,birth_date,weight,height) VALUES(?,?,?,?,?,?)",
                            (b.clinical_id.strip().upper(), b.name.strip(), hash_pw(b.password), b.birth_date, b.weight, b.height))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ese ID clínico ya está registrado")
    return {"challenge": make_token(cur.lastrowid, "2fa", hours=0.1)}


@app.post("/api/auth/login")
def login(b: Login):
    with db() as c:
        u = c.execute("SELECT * FROM users WHERE clinical_id=?", (b.clinical_id.strip().upper(),)).fetchone()
    if not u or not check_pw(b.password, u["password_hash"]):
        raise HTTPException(401, "ID clínico o contraseña incorrectos")
    return {"challenge": make_token(u["id"], "2fa", hours=0.1)}


@app.post("/api/auth/2fa")
def verify(b: Verify):
    uid = read_token(b.challenge, "2fa")
    if b.code.strip() != CODE_2FA:
        raise HTTPException(401, "Código incorrecto")
    with db() as c:
        u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return {"token": make_token(uid), "user": public(u)}


@app.get("/api/me")
def me(u=Depends(current_user)):
    return u


class Conditions(BaseModel):
    conditions: list[str]


@app.put("/api/me/conditions")
def set_conditions(b: Conditions, u=Depends(current_user)):
    with db() as c:
        c.execute("UPDATE users SET conditions=? WHERE id=?", (json.dumps(b.conditions), u["id"]))
    return {"ok": True}


# ---------- registro diario ----------
class Log(BaseModel):
    weight: float
    systolic: int
    diastolic: int
    micturition_count: int
    urine_amount: str
    symptoms: list[str] = []
    notes: str = ""


@app.post("/api/logs")
def add_log(b: Log, u=Depends(current_user)):
    if not 20 <= b.weight <= 300 or not 70 <= b.systolic <= 260 or not 40 <= b.diastolic <= 160 or not 0 <= b.micturition_count <= 30:
        raise HTTPException(422, "Revisa los valores: hay datos fuera de rango")
    with db() as c:
        c.execute("INSERT INTO patient_daily_logs(patient_id,weight,systolic,diastolic,micturition_count,urine_amount,"
                  "symptoms_json,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                  (u["id"], b.weight, b.systolic, b.diastolic, b.micturition_count, b.urine_amount,
                   json.dumps(b.symptoms), b.notes, time.strftime("%Y-%m-%d %H:%M")))
    return {"ok": True}


@app.get("/api/logs")
def logs(u=Depends(current_user)):
    with db() as c:
        rows = c.execute("SELECT * FROM patient_daily_logs WHERE patient_id=? ORDER BY id DESC LIMIT 30", (u["id"],)).fetchall()
    return [{**dict(r), "symptoms": json.loads(r["symptoms_json"])} for r in rows]


# ---------- perfil y configuración ----------
class ProfileIn(BaseModel):
    name: str
    birth_date: str = ""
    weight: float | None = None
    height: float | None = None


class PhotoIn(BaseModel):
    photo: str = ""


class PasswordIn(BaseModel):
    current: str
    new: str


@app.put("/api/me/profile")
def set_profile(b: ProfileIn, u=Depends(current_user)):
    if not b.name.strip():
        raise HTTPException(422, "El nombre no puede estar vacío")
    if b.weight is not None and not 20 <= b.weight <= 300:
        raise HTTPException(422, "Peso fuera de rango (20–300 kg)")
    if b.height is not None and not 50 <= b.height <= 250:
        raise HTTPException(422, "Estatura fuera de rango (50–250 cm)")
    with db() as c:
        c.execute("UPDATE users SET name=?,birth_date=?,weight=?,height=? WHERE id=?",
                  (b.name.strip(), b.birth_date, b.weight, b.height, u["id"]))
        return public(c.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone())


@app.put("/api/me/photo")
def set_photo(b: PhotoIn, u=Depends(current_user)):
    if b.photo and (not b.photo.startswith("data:image/") or len(b.photo) > 400_000):
        raise HTTPException(422, "Imagen no válida o demasiado grande")
    with db() as c:
        c.execute("UPDATE users SET photo=? WHERE id=?", (b.photo or None, u["id"]))
    return {"ok": True}


@app.post("/api/me/password")
def change_password(b: PasswordIn, u=Depends(current_user)):
    with db() as c:
        row = c.execute("SELECT password_hash FROM users WHERE id=?", (u["id"],)).fetchone()
        if not check_pw(b.current, row["password_hash"]):
            raise HTTPException(401, "La contraseña actual es incorrecta")
        if len(b.new) < 6:
            raise HTTPException(422, "La nueva contraseña debe tener al menos 6 caracteres")
        c.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_pw(b.new), u["id"]))
    return {"ok": True}


@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int, u=Depends(current_user)):
    with db() as c:
        cur = c.execute("DELETE FROM patient_daily_logs WHERE id=? AND patient_id=?", (log_id, u["id"]))
    if not cur.rowcount:
        raise HTTPException(404, "Registro no encontrado")
    return {"ok": True}


# ---------- mensajes paciente <-> médico ----------
class Msg(BaseModel):
    content: str


def thread(c, a, b):
    return c.execute("SELECT * FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY id",
                     (a, b, b, a)).fetchall()


def view(c, me, other):
    c.execute("UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=?", (me, other["id"]))
    return {"with": dict(other), "messages": [{**dict(r), "mine": r["sender_id"] == me} for r in thread(c, me, other["id"])]}


def add_msg(sender, receiver, content):
    if not content.strip():
        raise HTTPException(422, "Mensaje vacío")
    with db() as c:
        c.execute("INSERT INTO messages(sender_id,receiver_id,content,timestamp) VALUES(?,?,?,?)",
                  (sender, receiver, content.strip(), time.strftime("%Y-%m-%d %H:%M")))


def need_doctor(u):
    if u["role"] != "doctor":
        raise HTTPException(403, "Solo para profesionales de la salud")


@app.get("/api/messages")  # paciente: conversación con su médico
def messages(u=Depends(current_user)):
    with db() as c:
        doc = c.execute("SELECT id,clinical_id,name,photo FROM users WHERE role='doctor' LIMIT 1").fetchone()
        return view(c, u["id"], doc)


@app.get("/api/messages/unread")
def unread(u=Depends(current_user)):
    with db() as c:
        return {"count": c.execute("SELECT COUNT(*) FROM messages WHERE receiver_id=? AND is_read=0", (u["id"],)).fetchone()[0]}


@app.post("/api/messages")
def send(b: Msg, u=Depends(current_user)):
    with db() as c:
        doc = c.execute("SELECT id FROM users WHERE role='doctor' LIMIT 1").fetchone()["id"]
    add_msg(u["id"], doc, b.content)
    return {"ok": True}


@app.get("/api/chat")  # médico: lista de pacientes con último mensaje y no leídos
def conversations(u=Depends(current_user)):
    need_doctor(u)
    out = []
    with db() as c:
        for p in c.execute("SELECT id,clinical_id,name,photo FROM users WHERE role='patient' ORDER BY name").fetchall():
            last = c.execute("SELECT content,timestamp FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY id DESC LIMIT 1",
                             (p["id"], u["id"], u["id"], p["id"])).fetchone()
            un = c.execute("SELECT COUNT(*) FROM messages WHERE sender_id=? AND receiver_id=? AND is_read=0", (p["id"], u["id"])).fetchone()[0]
            out.append({**dict(p), "last": last["content"] if last else "", "last_at": last["timestamp"] if last else "", "unread": un})
    return sorted(out, key=lambda x: x["last_at"], reverse=True)


@app.get("/api/chat/{pid}")
def chat_with(pid: int, u=Depends(current_user)):
    need_doctor(u)
    with db() as c:
        p = c.execute("SELECT id,clinical_id,name,photo FROM users WHERE id=? AND role='patient'", (pid,)).fetchone()
        if not p:
            raise HTTPException(404, "Paciente no encontrado")
        return view(c, u["id"], p)


@app.post("/api/chat/{pid}")
def chat_send(pid: int, b: Msg, u=Depends(current_user)):
    need_doctor(u)
    with db() as c:
        if not c.execute("SELECT 1 FROM users WHERE id=? AND role='patient'", (pid,)).fetchone():
            raise HTTPException(404, "Paciente no encontrado")
    add_msg(u["id"], pid, b.content)
    return {"ok": True}


# ---------- dashboard médico (lee el CSV) ----------
@app.get("/api/dashboard")
def dashboard(u=Depends(current_user)):
    if u["role"] != "doctor":
        raise HTTPException(403, "Solo para profesionales de la salud")
    with open(CSV, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    by_day, sint, last = defaultdict(list), defaultdict(int), {}
    for r in rows:
        by_day[r["fecha"]].append(r)
        for s in filter(None, r["sintomas"].split(";")):
            sint[s] += 1
        last[r["paciente"]] = r
    fin = max(r["fecha"] for r in rows)
    tendencia = [{"fecha": d, "creatinina": round(sum(float(x["creatinina"]) for x in v) / len(v), 2),
                  "micciones": round(sum(int(x["micciones"]) for x in v) / len(v), 1)} for d, v in sorted(by_day.items())]
    riesgo = defaultdict(int)
    for r in last.values():
        riesgo[r["riesgo"]] += 1
    pacientes = []
    for p, r in sorted(last.items()):
        sin = (date.fromisoformat(fin) - date.fromisoformat(r["fecha"])).days
        pacientes.append({"paciente": p, "ultimo": r["fecha"], "creatinina": float(r["creatinina"]),
                          "riesgo": r["riesgo"], "dias_sin_registro": sin, "inactivo": sin >= 3})
    return {"kpis": {"pacientes": len(last), "registros": len(rows),
                     "creatinina_prom": round(sum(float(r["creatinina"]) for r in rows) / len(rows), 2),
                     "alertas": sum(1 for p in pacientes if p["riesgo"] == "Alto" or p["inactivo"])},
            "tendencia": tendencia, "sintomas": [{"name": k, "value": v} for k, v in sorted(sint.items(), key=lambda x: -x[1])],
            "riesgo": [{"name": k, "value": v} for k, v in riesgo.items()], "pacientes": pacientes}


# ---------- frontend compilado (React) ----------
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = (DIST / path).resolve()
        return FileResponse(f if path and f.is_file() and DIST.resolve() in f.parents else DIST / "index.html")
