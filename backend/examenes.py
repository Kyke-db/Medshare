"""MedShare - Exámenes de laboratorio: subir un PDF, extraer los valores y compararlos con el examen anterior.

Se registra desde main.py, igual que chatbot.py y citas.py:

    from examenes import init_examenes, make_router as make_examenes_router
    init_examenes(db)
    app.include_router(make_examenes_router(current_user, db))

Endpoints:
    POST   /api/exams                   sube un PDF (multipart, campo "file"); solo pacientes
    GET    /api/exams                   lista los exámenes del paciente (médico: ?patient_id=N)
    GET    /api/exams/{id}              detalle con cada valor y su estado (bajo / normal / alto)
    GET    /api/exams/{id}/comparison   compara con el examen anterior del mismo tipo
    DELETE /api/exams/{id}              elimina un examen propio

Los números y las diferencias se calculan AQUÍ, en código. La IA solo recibe el resultado ya calculado
(explain_context) y lo explica en lenguaje simple.

Formato de PDF que entiende el prototipo (PDF con texto, no fotos ni escaneos):
    Fecha de toma de muestra: 12-11-2026
    Examen: Perfil renal
    Creatinina 1,4 mg/dL 0,7 - 1,3          <- nombre, resultado, unidad, rango de referencia
"""
import io
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

UPLOAD_DIR = Path(__file__).parent / "uploads" / "exams"
MAX_BYTES = 5 * 1024 * 1024
TOLERANCE_PCT = 2.0  # cambios menores a esto se consideran "igual"

NUM = r"\d+(?:[.,]\d+)?"
LINE_RE = re.compile(
    rf"^(?P<name>[^\W\d_][\w ()/.\-]*?)\s+(?P<value>{NUM})\s+(?P<unit>\S+)\s+"
    rf"(?P<ref>{NUM}\s*[-–]\s*{NUM}|[<>]=?\s*{NUM})\s*$"
)
DATE_RE = re.compile(r"(?:toma de muestra|fecha del examen|fecha de examen)\D{0,10}(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})", re.I)
TYPE_RE = re.compile(r"^\s*Examen\s*:\s*(.+?)\s*$", re.I | re.M)


# ---------- utilidades ----------
def to_float(s):
    return float(s.replace(",", "."))


def norm(s):
    """'Nitrógeno  ureico (BUN)' -> 'nitrogeno ureico (bun)' (para emparejar un examen con el anterior)."""
    s = "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def fn(x):
    """65.0 -> '65'; 1.4 -> '1,4' (decimales con coma, como en Chile)."""
    return f"{x:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def pretty_date(iso):
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%d-%m-%Y")


def parse_date(s):
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def parse_ref(ref):
    """'0,7 - 1,3' -> (0.7, 1.3); '> 90' -> (90, None); '< 200' -> (None, 200)."""
    nums = [to_float(n) for n in re.findall(NUM, ref)]
    if "<" in ref:
        return None, nums[0]
    if ">" in ref:
        return nums[0], None
    return nums[0], nums[1]


def status_of(value, lo, hi):
    if lo is not None and value < lo:
        return "bajo"
    if hi is not None and value > hi:
        return "alto"
    return "normal"


def ref_text(lo, hi):
    if lo is not None and hi is not None:
        return f"{fn(lo)} a {fn(hi)}"
    return f"mayor a {fn(lo)}" if lo is not None else f"menor a {fn(hi)}"


# ---------- lectura del PDF ----------
def read_pdf_text(data):
    if not data.startswith(b"%PDF"):
        raise HTTPException(422, "El archivo no es un PDF")
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception:
        raise HTTPException(422, "No pude leer el PDF")
    if not text.strip():
        raise HTTPException(422, "El PDF no tiene texto legible (¿es una foto o un escaneo?). Por ahora solo acepto PDFs con texto.")
    return text


def parse_exam(text):
    m = DATE_RE.search(text)
    taken_at = parse_date(m.group(1)) if m else None
    if not taken_at:
        raise HTTPException(422, "No encontré la fecha de toma de muestra en el PDF")
    t = TYPE_RE.search(text)
    exam_type = t.group(1) if t else "Examen de laboratorio"
    values = []
    for line in text.splitlines():
        lm = LINE_RE.match(line.strip())
        if not lm:
            continue
        lo, hi = parse_ref(lm["ref"])
        name = lm["name"].strip()
        values.append({"name": name, "key": norm(name), "value": to_float(lm["value"]), "unit": lm["unit"], "ref_min": lo, "ref_max": hi})
    if not values:
        raise HTTPException(422, "No pude encontrar resultados en el PDF (formato: nombre, resultado, unidad, rango de referencia)")
    return {"exam_type": exam_type, "taken_at": taken_at, "values": values}


# ---------- base de datos ----------
def init_examenes(db):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS exams(id INTEGER PRIMARY KEY, patient_id INTEGER, exam_type TEXT,
            taken_at TEXT, uploaded_at TEXT, filename TEXT);
        CREATE TABLE IF NOT EXISTS exam_values(id INTEGER PRIMARY KEY, exam_id INTEGER, name TEXT, key TEXT,
            value REAL, unit TEXT, ref_min REAL, ref_max REAL);
        """)


def with_status(row):
    d = dict(row)
    d["status"] = status_of(d["value"], d["ref_min"], d["ref_max"])
    return d


def save_exam(db, patient_id, filename, data):
    parsed = parse_exam(read_pdf_text(data))
    with db() as c:
        if c.execute("SELECT 1 FROM exams WHERE patient_id=? AND exam_type=? AND taken_at=?",
                     (patient_id, parsed["exam_type"], parsed["taken_at"])).fetchone():
            raise HTTPException(409, "Ya subiste este examen (mismo tipo y fecha)")
        cur = c.execute("INSERT INTO exams(patient_id, exam_type, taken_at, uploaded_at, filename) VALUES(?,?,?,?,?)",
                        (patient_id, parsed["exam_type"], parsed["taken_at"], datetime.now().strftime("%Y-%m-%d %H:%M"), filename))
        exam_id = cur.lastrowid
        for v in parsed["values"]:
            c.execute("INSERT INTO exam_values(exam_id, name, key, value, unit, ref_min, ref_max) VALUES(?,?,?,?,?,?,?)",
                      (exam_id, v["name"], v["key"], v["value"], v["unit"], v["ref_min"], v["ref_max"]))
    (UPLOAD_DIR / f"{exam_id}.pdf").write_bytes(data)
    out = [dict(v, status=status_of(v["value"], v["ref_min"], v["ref_max"])) for v in parsed["values"]]
    return {"id": exam_id, "exam_type": parsed["exam_type"], "taken_at": parsed["taken_at"], "values": out,
            "fuera_de_rango": [v["name"] for v in out if v["status"] != "normal"]}


def list_exams(db, patient_id):
    with db() as c:
        rows = c.execute(
            "SELECT e.id, e.exam_type, e.taken_at, e.uploaded_at, COUNT(v.id) AS n_values, "
            "COALESCE(SUM(CASE WHEN (v.ref_min IS NOT NULL AND v.value < v.ref_min) "
            "OR (v.ref_max IS NOT NULL AND v.value > v.ref_max) THEN 1 ELSE 0 END), 0) AS n_out_of_range "
            "FROM exams e LEFT JOIN exam_values v ON v.exam_id = e.id WHERE e.patient_id=? "
            "GROUP BY e.id ORDER BY e.taken_at DESC, e.id DESC", (patient_id,)).fetchall()
    return [dict(r) for r in rows]


def get_exam(db, exam_id):
    with db() as c:
        e = c.execute("SELECT * FROM exams WHERE id=?", (exam_id,)).fetchone()
        if not e:
            return None
        vals = c.execute("SELECT name, key, value, unit, ref_min, ref_max FROM exam_values WHERE exam_id=? ORDER BY id", (exam_id,)).fetchall()
    return {**dict(e), "values": [with_status(v) for v in vals]}


def compare_exam(db, exam):
    """Compara un examen con el anterior (misma persona y mismo tipo, fecha anterior). Todo calculado aquí."""
    with db() as c:
        prev = c.execute("SELECT id, taken_at FROM exams WHERE patient_id=? AND exam_type=? AND taken_at<? "
                         "ORDER BY taken_at DESC, id DESC LIMIT 1", (exam["patient_id"], exam["exam_type"], exam["taken_at"])).fetchone()
    prev_exam = get_exam(db, prev["id"]) if prev else None
    prev_by_key = {v["key"]: v for v in prev_exam["values"]} if prev_exam else {}
    out = []
    for v in exam["values"]:
        item = {k: v[k] for k in ("name", "unit", "value", "ref_min", "ref_max", "status")}
        p = prev_by_key.get(v["key"])
        if p:
            delta = v["value"] - p["value"]
            pct = delta / p["value"] * 100 if p["value"] else None
            if pct is None:
                trend = "igual" if delta == 0 else ("sube" if delta > 0 else "baja")
            else:
                trend = "igual" if abs(pct) < TOLERANCE_PCT else ("sube" if delta > 0 else "baja")
            item.update(previous_value=p["value"], previous_status=p["status"], delta=round(delta, 3),
                        pct=None if pct is None else round(pct, 1), trend=trend)
        else:
            item.update(previous_value=None, previous_status=None, delta=None, pct=None, trend=None)
        out.append(item)
    return {"exam": {"id": exam["id"], "exam_type": exam["exam_type"], "taken_at": exam["taken_at"]},
            "previous": {"id": prev_exam["id"], "taken_at": prev_exam["taken_at"]} if prev_exam else None,
            "values": out}


def explain_context(db, patient_id):
    """Texto con el último examen ya calculado, para que la IA lo explique (la IA no calcula nada)."""
    exams = list_exams(db, patient_id)
    if not exams:
        return "El paciente todavía no ha subido ningún examen."
    cmp = compare_exam(db, get_exam(db, exams[0]["id"]))
    lines = [f"Último examen del paciente: {cmp['exam']['exam_type']} del {pretty_date(cmp['exam']['taken_at'])}.",
             "Resultados calculados por el sistema (no los recalcules):"]
    for v in cmp["values"]:
        estado = {"normal": "dentro del rango", "alto": "ALTO", "bajo": "BAJO"}[v["status"]]
        line = f"- {v['name']}: {fn(v['value'])} {v['unit']} (rango {ref_text(v['ref_min'], v['ref_max'])}), {estado}"
        if v["trend"]:
            cambio = {"igual": "sin cambios", "sube": f"sube {fn(abs(v['pct']))}%" if v["pct"] is not None else "sube",
                      "baja": f"baja {fn(abs(v['pct']))}%" if v["pct"] is not None else "baja"}[v["trend"]]
            line += f"; antes {fn(v['previous_value'])} ({cambio})"
        lines.append(line)
    lines.append(f"Comparado con el examen del {pretty_date(cmp['previous']['taken_at'])}." if cmp["previous"]
                 else "No hay un examen anterior del mismo tipo para comparar.")
    return "\n".join(lines)


# ---------- endpoints ----------
def make_router(current_user, db):
    router = APIRouter()

    def visible(u, exam):
        if not exam or not (u["role"] == "doctor" or exam["patient_id"] == u["id"]):
            raise HTTPException(404, "Examen no encontrado")
        return exam

    @router.post("/api/exams", status_code=201)
    def upload(file: UploadFile = File(...), u=Depends(current_user)):
        if u["role"] != "patient":
            raise HTTPException(403, "Solo los pacientes pueden subir exámenes")
        data = file.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "El archivo supera los 5 MB")
        return save_exam(db, u["id"], file.filename or "examen.pdf", data)

    @router.get("/api/exams")
    def my_exams(patient_id: int | None = None, u=Depends(current_user)):
        if u["role"] == "doctor":
            if patient_id is None:
                raise HTTPException(422, "Indica el paciente (patient_id)")
            return list_exams(db, patient_id)
        return list_exams(db, u["id"])

    @router.get("/api/exams/{exam_id}")
    def one_exam(exam_id: int, u=Depends(current_user)):
        return visible(u, get_exam(db, exam_id))

    @router.get("/api/exams/{exam_id}/comparison")
    def comparison(exam_id: int, u=Depends(current_user)):
        return compare_exam(db, visible(u, get_exam(db, exam_id)))

    @router.delete("/api/exams/{exam_id}")
    def delete(exam_id: int, u=Depends(current_user)):
        exam = get_exam(db, exam_id)
        if not exam or exam["patient_id"] != u["id"]:
            raise HTTPException(404, "Examen no encontrado")
        with db() as c:
            c.execute("DELETE FROM exam_values WHERE exam_id=?", (exam_id,))
            c.execute("DELETE FROM exams WHERE id=?", (exam_id,))
        (UPLOAD_DIR / f"{exam_id}.pdf").unlink(missing_ok=True)
        return {"message": "Examen eliminado"}

    return router
