"""MedShare - Chatbot con IA local (Ollama).

Puente entre el frontend (Boberto) y el modelo local. Se registra desde main.py:

    from chatbot import make_router as make_chatbot_router
    app.include_router(make_chatbot_router(current_user, db))

Si Ollama no responde, devuelve 503 y el frontend usa las reglas predefinidas como respaldo.
"""
import os
import re
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from citas import free_slots, patient_appointments, pretty

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
- No puedes leer exámenes. Indica que pueden subirlos o revisarlos con su médico.
- Responde de forma breve: máximo unas 120 palabras.
"""

# \b evita falsos positivos como "ahora" (contiene "hora") o "solicita" (contiene "cita")
RE_HORARIOS = re.compile(r"\b(cita|citas|agendar|agenda|reservar|hora|horas|horario|horarios|disponib\w*)\b", re.I)
RE_MIS_CITAS = re.compile(r"\b(cancelar|anular|mi cita|mis citas|mis reservas?|mis horas)\b", re.I)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=50)


def appointment_context(user, text, db):
    """Texto con datos reales (horarios/citas) que se agrega al prompt de sistema."""
    ctx = f"\nFecha y hora actual: {pretty(datetime.now().strftime('%Y-%m-%d %H:%M'))}."
    if user["role"] != "patient":
        return ctx
    if RE_HORARIOS.search(text):
        slots = free_slots(db, limit=8)
        if slots:
            ctx += "\nPróximos horarios disponibles: " + "; ".join(pretty(s["start_at"]) for s in slots) + "."
        else:
            ctx += "\nNo hay horarios disponibles por ahora."
    if RE_MIS_CITAS.search(text):
        mine = patient_appointments(db, user["id"])
        if mine:
            ctx += "\nCitas agendadas del paciente: " + "; ".join(pretty(a["start_at"]) for a in mine) + "."
        else:
            ctx += "\nEl paciente no tiene citas agendadas."
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

        system = SYSTEM_PROMPT + appointment_context(user, history[-1]["content"], db)
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