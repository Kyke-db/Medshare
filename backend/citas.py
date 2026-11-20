"""MedShare - Módulo de citas (horarios del médico y reservas del paciente).

Se registra desde main.py, igual que el chatbot (sin importar nada de main.py):

    from citas import init_citas, make_router as make_citas_router
    init_citas(db)
    app.include_router(make_citas_router(current_user, db))

Endpoints:
    GET    /api/appointments/availability?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&limit=12
    POST   /api/appointments            cuerpo: {"slot_id": 5}   (solo pacientes)
    GET    /api/appointments            paciente: sus citas; médico: su agenda
    DELETE /api/appointments/{id}       cancela una cita propia (solo pacientes)
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

FMT = "%Y-%m-%d %H:%M"
DAYS_AHEAD = 14
BLOCKS = [("09:00", "13:00"), ("15:00", "17:00")]  # bloques de atención, horas cada 30 min
SLOT_MINUTES = 30
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


class BookIn(BaseModel):
    slot_id: int


def now_str():
    return datetime.now().strftime(FMT)


def pretty(start_at):
    """'2026-11-19 09:00' -> 'jueves 19-11-2026 a las 09:00'."""
    d = datetime.strptime(start_at, FMT)
    return f"{DIAS[d.weekday()]} {d:%d-%m-%Y} a las {d:%H:%M}"


# ---------- base de datos ----------
def generate_slots(c, doctor_id):
    """Lunes a viernes, bloques 09:00-13:00 y 15:00-17:00, una hora cada 30 min, próximos DAYS_AHEAD días."""
    today = datetime.now().date()
    for offset in range(DAYS_AHEAD):
        day = today + timedelta(days=offset)
        if day.weekday() >= 5:  # sin fines de semana
            continue
        for start, end in BLOCKS:
            t = datetime.strptime(f"{day} {start}", FMT)
            stop = datetime.strptime(f"{day} {end}", FMT)
            while t < stop:
                c.execute("INSERT INTO schedule_slots(doctor_id, start_at, available) VALUES(?,?,1)",
                          (doctor_id, t.strftime(FMT)))
                t += timedelta(minutes=SLOT_MINUTES)


def init_citas(db):
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS schedule_slots(id INTEGER PRIMARY KEY, doctor_id INTEGER,
            start_at TEXT, available INTEGER DEFAULT 1);
        CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, patient_id INTEGER,
            slot_id INTEGER, status TEXT DEFAULT 'scheduled', created_at TEXT);
        """)
        if not c.execute("SELECT 1 FROM schedule_slots").fetchone():
            doctor = c.execute("SELECT id FROM users WHERE role='doctor' ORDER BY id LIMIT 1").fetchone()
            if doctor:
                generate_slots(c, doctor["id"])


# ---------- lógica (reutilizable por el chatbot) ----------
def free_slots(db, from_date=None, to_date=None, limit=12):
    """Horas libres y futuras, ordenadas. Fechas en formato YYYY-MM-DD (opcionales)."""
    start = max(f"{from_date} 00:00" if from_date else "", now_str())
    end = f"{to_date} 23:59" if to_date else "9999-12-31 23:59"
    with db() as c:
        rows = c.execute(
            "SELECT id, doctor_id, start_at FROM schedule_slots "
            "WHERE available=1 AND start_at>=? AND start_at<=? ORDER BY start_at LIMIT ?",
            (start, end, max(1, min(limit, 50)))).fetchall()
    return [dict(r) for r in rows]


def patient_appointments(db, patient_id, include_cancelled=False):
    sql = ("SELECT a.id, a.slot_id, a.status, a.created_at, s.start_at, s.doctor_id, d.name AS doctor_name "
           "FROM appointments a JOIN schedule_slots s ON s.id=a.slot_id "
           "LEFT JOIN users d ON d.id=s.doctor_id WHERE a.patient_id=? ")
    if not include_cancelled:
        sql += "AND a.status='scheduled' "
    with db() as c:
        return [dict(r) for r in c.execute(sql + "ORDER BY s.start_at", (patient_id,)).fetchall()]


def doctor_agenda(db, doctor_id):
    with db() as c:
        rows = c.execute(
            "SELECT a.id, a.slot_id, a.status, s.start_at, a.patient_id, p.name AS patient_name, p.clinical_id "
            "FROM appointments a JOIN schedule_slots s ON s.id=a.slot_id "
            "LEFT JOIN users p ON p.id=a.patient_id "
            "WHERE s.doctor_id=? AND a.status='scheduled' ORDER BY s.start_at", (doctor_id,)).fetchall()
    return [dict(r) for r in rows]


def book_slot(db, patient_id, slot_id):
    with db() as c:
        # Un solo UPDATE condicional: si dos pacientes piden la misma hora a la vez, solo uno lo consigue
        cur = c.execute("UPDATE schedule_slots SET available=0 WHERE id=? AND available=1 AND start_at>=?",
                        (slot_id, now_str()))
        if cur.rowcount != 1:
            raise HTTPException(409, "Esa hora ya no está disponible")
        appt = c.execute("INSERT INTO appointments(patient_id, slot_id, status, created_at) VALUES(?,?,'scheduled',?)",
                         (patient_id, slot_id, now_str()))
        start_at = c.execute("SELECT start_at FROM schedule_slots WHERE id=?", (slot_id,)).fetchone()["start_at"]
    return {"id": appt.lastrowid, "slot_id": slot_id, "start_at": start_at, "status": "scheduled"}


def cancel_appointment(db, patient_id, appointment_id):
    with db() as c:
        cur = c.execute("UPDATE appointments SET status='cancelled' WHERE id=? AND patient_id=? AND status='scheduled'",
                        (appointment_id, patient_id))
        if cur.rowcount != 1:
            raise HTTPException(404, "Cita no encontrada")
        c.execute("UPDATE schedule_slots SET available=1 "
                  "WHERE id=(SELECT slot_id FROM appointments WHERE id=?)", (appointment_id,))


# ---------- endpoints ----------
def make_router(current_user, db):
    router = APIRouter()

    def only_patient(u):
        if u["role"] != "patient":
            raise HTTPException(403, "Solo los pacientes pueden agendar o cancelar citas")

    @router.get("/api/appointments/availability")
    def availability(from_date: str, to_date: str, limit: int = 12, u=Depends(current_user)):
        try:
            d1 = datetime.strptime(from_date, "%Y-%m-%d")
            d2 = datetime.strptime(to_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(422, "Formato de fecha inválido (usa AAAA-MM-DD)")
        if d1 > d2:
            raise HTTPException(422, "La fecha inicial no puede ser posterior a la final")
        return free_slots(db, from_date, to_date, limit)

    @router.post("/api/appointments", status_code=201)
    def create(b: BookIn, u=Depends(current_user)):
        only_patient(u)
        return book_slot(db, u["id"], b.slot_id)

    @router.get("/api/appointments")
    def my_appointments(include_cancelled: bool = False, u=Depends(current_user)):
        if u["role"] == "doctor":
            return doctor_agenda(db, u["id"])
        return patient_appointments(db, u["id"], include_cancelled)

    @router.delete("/api/appointments/{appointment_id}")
    def cancel(appointment_id: int, u=Depends(current_user)):
        only_patient(u)
        cancel_appointment(db, u["id"], appointment_id)
        return {"message": "Cita cancelada"}

    return router