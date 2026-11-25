"""MedShare - Chatbot con IA local (Ollama).

Puente entre el frontend (Boberto) y el modelo local. Se registra desde main.py:

    from chatbot import make_router as make_chatbot_router
    app.include_router(make_chatbot_router(current_user, db))

Si Ollama no responde, devuelve 503 y el frontend usa las reglas predefinidas como respaldo.
"""
import os
import re
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from citas import free_slots, patient_appointments, pretty
from examenes import explain_context as exam_context

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:14b")
KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")  # mantiene el modelo cargado en la GPU
MAX_HISTORY = 10      # últimos mensajes que se envían al modelo
MAX_CHARS = 2000      # largo máximo de cada mensaje

SYSTEM_PROMPT = """Eres Boberto, el asistente de MedShare, una plataforma para la prevención de la Lesión Renal Aguda.
Hablas en español, con un tono amable y tranquilo, usando palabras simples que cualquier persona entienda.

Reglas que nunca debes romper:
- No eres médico. No diagnosticas, no recetas y no indicas dosis de medicamentos.
- Nunca le digas al paciente que suspenda o cambie un tratamiento: eso lo decide su médico.
- Si el paciente describe síntomas graves (muy poca o nada de orina, falta de aire, confusión, hinchazón marcada, dolor intenso), recomiéndale acudir de inmediato a un servicio de urgencias.
- Si te preguntan por antiinflamatorios (ibuprofeno, naproxeno, ketorolaco, diclofenaco), advierte que pueden dañar los riñones y que deben consultar a su médico antes de tomarlos.
- No inventes datos, cifras ni resultados. Si no sabes algo, dilo y sugiere consultar al médico.
- Puedes mostrar horarios disponibles y las citas registradas del paciente, usando SOLO los datos reales que aparecen más abajo en el contexto. Nunca inventes fechas ni horas. Si el contexto indica que no hay horarios o citas, dilo tal cual.
- Todavía no puedes reservar ni cancelar citas por el chat. Si el paciente lo pide, muéstrale los horarios disponibles y explica que la reserva se hará con su confirmación en la aplicación.
- Puedes explicar los resultados de exámenes usando SOLO los datos del contexto (valores, rangos y cambios ya calculados por el sistema). No recalcules ni inventes valores.
- Habla en términos de cambios observados, no de veredictos: En vez de "indica que tu función renal ha empeorado", usa "en comparación con el examen anterior, la creatinina registró un +40% y el BUN un +62,5%".
- Evita etiquetas de alarma o juicio propio: Cambia "es preocupante" o "tus riñones están trabajando menos eficientemente" por algo neutro como "estos valores aparecen fuera del rango de referencia indicado en el informe y muestran cambios respecto a la medición previa".
- Mantén la estructura breve y escaneable: Un bloque corto con los cambios clave + qué significa cada término de forma sencilla + invitación a comentarlo con su médico suele leerse mejor que un párrafo denso.
- Si hay valores altos o cambios bruscos: Prioriza que consulte pronto con su equipo médico, sin dramatizar ni asumir causas que no están en el documento.
- Cuando expliques resultados de exámenes, sigue esta plantilla:
  "Te ayudo a resumir las diferencias entre el examen actual y el anterior:

  • Fuera o cerca del rango de referencia: [indicar parámetros con su variación %, por ejemplo: creatinina (+40%), BUN (+62,5%), potasio (+17,8%) y VFG estimada (-33%)].
  • Dentro del rango normal: [indicar parámetros normales y su variación %, por ejemplo: sodio, glucosa y hemoglobina (-2%)].

  Esta comparación es solo una referencia de lectura de tus informes. Recuerda compartir estos resultados con tu médico para que los evalúe en tu contexto y te indique los pasos a seguir."
- Responde de forma breve: máximo unas 120 palabras (hasta 200 si explicas un examen).
"""

# \b evita falsos positivos como "ahora" (contiene "hora") o "solicita" (contiene "cita")
RE_HORARIOS = re.compile(r"\b(cita|citas|agendar|agenda|reservar|hora|horas|horario|horarios|disponib\w*)\b", re.I)
RE_MIS_CITAS = re.compile(r"\b(cancelar|anular|mi cita|mis citas|mis reservas?|mis horas)\b", re.I)
RE_EXAMEN = re.compile(r"\b(ex[aá]menes|examen|resultados?|laboratorio|creatinina|urea|perfil renal|an[aá]lisis)\b", re.I)

# Expresiones regulares para detectar fechas y horarios
RE_DATE = re.compile(
    r"(?:\b(?:el|la|de|del)\s+)?"
    r"(?:(?P<day>\d{1,2})[-/\.](?P<month>\d{1,2})[-/\.](?P<year>\d{4}))|"
    r"(?P<dayname>(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo))|"
    r"(?P<relative>(?:hoy|mañana|pasado mañana|ayer))"
)
RE_TIME = re.compile(r"(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<period>(?:a\.m\.|p\.m\.|am|pm|de la mañana|de la tarde|por la mañana|por la tarde))?", re.I)

# Días de la semana
DAYS_OF_WEEK = {
    'lunes': 0, 'martes': 1, 'miércoles': 2, 'jueves': 3, 'viernes': 4,
    'sábado': 5, 'domingo': 6, 'monday': 0, 'tuesday': 1, 'wednesday': 2,
    'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
}

# Palabras clave para fechas específicas
DATE_KEYWORDS = {
    'hoy': lambda: datetime.now().date(),
    'mañana': lambda: (datetime.now() + timedelta(days=1)).date(),
    'ayer': lambda: (datetime.now() - timedelta(days=1)).date(),
    'pasado mañana': lambda: (datetime.now() + timedelta(days=2)).date()
}

def extract_dates(text):
    """Extrae fechas de un texto y devuelve una lista de fechas válidas."""
    dates = []

    # Buscar fechas en formato DD/MM/AAAA o similar
    for match in RE_DATE.finditer(text.lower()):
        if match.group('day') and match.group('month'):
            try:
                day, month, year = int(match.group('day')), int(match.group('month')), int(match.group('year'))
                # Validar año (puede ser 2 o 4 dígitos)
                if len(str(year)) == 2:
                    year += 2000 if year < 50 else 1900
                date_obj = datetime(year, month, day).date()
                dates.append(date_obj)
            except (ValueError, TypeError):
                continue

        # Buscar días de la semana
        elif match.group('dayname'):
            day_name = match.group('dayname')
            if day_name in DAYS_OF_WEEK:
                today = datetime.now().date()
                target_weekday = DAYS_OF_WEEK[day_name]
                days_ahead = (target_weekday - today.weekday()) % 7
                # Si es el mismo día, buscar la próxima semana
                if days_ahead == 0:
                    days_ahead = 7
                date_obj = today + timedelta(days=days_ahead)
                dates.append(date_obj)

    # Buscar palabras clave de fechas relativas
    for keyword, func in DATE_KEYWORDS.items():
        if keyword in text.lower():
            try:
                dates.append(func())
            except Exception:
                continue

    return dates

def extract_time(text):
    """Extrae hora de un texto."""
    times = []

    # Buscar horas en formato HH:MM o HH
    for match in RE_TIME.finditer(text):
        hour = int(match.group('hour'))
        minute = int(match.group('minute')) if match.group('minute') else 0

        # Convertir a formato de 24 horas
        period = match.group('period')
        if period:
            period_lower = period.lower()
            if 'pm' in period_lower or 'p.m.' in period_lower or 'de la tarde' in period_lower or 'por la tarde' in period_lower:
                if hour < 12:
                    hour += 12
            elif 'am' in period_lower or 'a.m.' in period_lower or 'de la mañana' in period_lower or 'por la mañana' in period_lower:
                if hour == 12:
                    hour = 0
        else:
            # Si no hay periodo, asumimos que es AM si es menor a 12, o PM si es mayor o igual a 12
            pass

        times.append((hour, minute))

    return times

def find_available_slots_for_date(db, date_obj):
    """Encuentra horarios disponibles para una fecha específica."""
    # Convertir la fecha a string en formato adecuado
    from_date = date_obj.strftime("%Y-%m-%d")
    to_date = date_obj.strftime("%Y-%m-%d")

    # Buscar horarios disponibles para esa fecha
    slots = free_slots(db, from_date=from_date, to_date=to_date, limit=50)
    return slots

def build_context(user, text, db):
    """Texto con datos reales (horarios, citas, exámenes) que se agrega al prompt de sistema."""
    ctx = f"\nFecha y hora actual: {pretty(datetime.now().strftime('%Y-%m-%d %H:%M'))}."
    if user["role"] != "patient":
        return ctx

    # Detectar si el mensaje contiene una solicitud de cita específica
    if RE_HORARIOS.search(text):
        # Intentar extraer fechas específicas del mensaje
        dates = extract_dates(text)
        times = extract_time(text)

        slots = []
        if dates:
            # Para cada fecha detectada, buscar horarios disponibles
            for date_obj in dates:
                date_slots = find_available_slots_for_date(db, date_obj)
                if date_slots:
                    slots.extend(date_slots)
        else:
            # Si no hay fechas específicas, usar los horarios próximos
            slots = free_slots(db, limit=8)

        if slots:
            ctx += "\nHorarios disponibles: " + "; ".join(pretty(s["start_at"]) for s in slots) + "."
        else:
            ctx += "\nNo hay horarios disponibles por ahora."

    if RE_MIS_CITAS.search(text):
        mine = patient_appointments(db, user["id"])
        if mine:
            ctx += "\nCitas agendadas del paciente: " + "; ".join(pretty(a["start_at"]) for a in mine) + "."
        else:
            ctx += "\nEl paciente no tiene citas agendadas."
    if RE_EXAMEN.search(text):
        ctx += "\n" + exam_context(db, user["id"])
    return ctx


def make_router(current_user, db):
    router = APIRouter()

    @router.post("/api/chatbot")
    def chatbot(body: ChatIn, user=Depends(current_user)):
        # Solo se aceptan mensajes de usuario y asistente: el cliente no puede inyectar un "system"
        history = [
            {"role": m.role, "content": m.content[:MAX_CHARS]}
            for m in body.messages
            if m.role in ("user", "assistant") and m.content.strip()
        ][-MAX_HISTORY:]
        if not history or history[-1]["role"] != "user":
            raise HTTPException(422, "El último mensaje debe ser del usuario")

        system = SYSTEM_PROMPT + build_context(user, history[-1]["content"], db)
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [{"role": "system", "content": system}, *history],
            "stream": False,
            "keep_alive": KEEP_ALIVE,
            "options": {"temperature": 0.3},
        }
        try:
            r = httpx.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=120)
            r.raise_for_status()
            reply = r.json()["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, ValueError):
            raise HTTPException(503, "El asistente de IA no está disponible en este momento")
        return {"reply": reply}

    return router


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=50)