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
            conditions TEXT DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS patient_daily_logs(id INTEGER PRIMARY KEY, patient_id INTEGER, weight REAL,
            systolic INTEGER, diastolic INTEGER, micturition_count INTEGER, urine_amount TEXT,
            symptoms_json TEXT, notes TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, sender_id INTEGER, receiver_id INTEGER,
            content TEXT, is_read INTEGER DEFAULT 0, timestamp TEXT DEFAULT CURRENT_TIMESTAMP);
        """)
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


# ---------- mensajes ----------
class Msg(BaseModel):
    content: str


@app.get("/api/messages")
def messages(u=Depends(current_user)):
    with db() as c:
        c.execute("UPDATE messages SET is_read=1 WHERE receiver_id=?", (u["id"],))
        rows = c.execute("SELECT * FROM messages WHERE sender_id=? OR receiver_id=? ORDER BY id", (u["id"], u["id"])).fetchall()
    return [{**dict(r), "mine": r["sender_id"] == u["id"]} for r in rows]


@app.get("/api/messages/unread")
def unread(u=Depends(current_user)):
    with db() as c:
        return {"count": c.execute("SELECT COUNT(*) FROM messages WHERE receiver_id=? AND is_read=0", (u["id"],)).fetchone()[0]}


@app.post("/api/messages")
def send(b: Msg, u=Depends(current_user)):
    if not b.content.strip():
        raise HTTPException(422, "Mensaje vacío")
    with db() as c:
        doc = c.execute("SELECT id FROM users WHERE role='doctor' LIMIT 1").fetchone()["id"]
        c.execute("INSERT INTO messages(sender_id,receiver_id,content,timestamp) VALUES(?,?,?,?)",
                  (u["id"], doc, b.content.strip(), time.strftime("%Y-%m-%d %H:%M")))
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
    tendencia = [{"fecha": d[5:], "creatinina": round(sum(float(x["creatinina"]) for x in v) / len(v), 2),
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
