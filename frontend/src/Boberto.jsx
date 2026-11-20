import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { api } from "./api";

// Asistente con respuestas predefinidas como respaldo (plan de contingencia del RF-04) + IA local (Ollama) + citas
const RULES = [
  [/diagn|receta|recet|qué tengo|que tengo|dosis/i, "No puedo diagnosticar ni recetar. Si tienes síntomas, consulta a un profesional de la salud lo antes posible."],
  [/examen|laboratorio|creatinina|urea/i, "Puedes subir una foto o PDF de tu examen y te lo explicaré en lenguaje sencillo. Una creatinina elevada puede indicar que los riñones filtran menos, pero solo tu médico puede interpretarla. (Subida de archivos: próxima versión.)"],
  [/ibuprofeno|naproxeno|ketorolaco|medicament|pastilla|dolor|automedic/i, "⚠️ No te automediques. Ibuprofeno, naproxeno y ketorolaco pueden dañar tus riñones, sobre todo si estás deshidratado. Consulta a tu médico antes de tomarlos."],
  [/hora|cita|agendar|médico|medico/i, "Puedes escribirle a tu médico desde Perfil → Mensajes del médico. Para urgencias, acude al servicio de urgencias más cercano."],
  [/hidrat|agua|beber|líquido|liquido/i, "Mantenerte bien hidratado ayuda a proteger tus riñones. Si tienes vómitos, diarrea o fiebre, avisa a tu médico: pueden requerir ajustes."],
  [/síntoma|sintoma|hincha|náusea|nausea|fatiga|orina/i, "Señales para vigilar: poca orina, hinchazón en piernas o rostro, náuseas, fatiga extrema o falta de aire. Regístralos en Salud y consulta a tu médico si aparecen."],
];
const DEFAULT = "Puedo ayudarte con dudas generales sobre hidratación, síntomas de alerta y medicamentos de riesgo. Para temas clínicos, consulta a tu médico.";
const SUGGEST = ["Ayúdame a entender mi examen de laboratorio", "Ayúdame a agendar una cita médica", "Quiero ver o cancelar mis citas", "Tengo una duda sobre mi hidratación / síntomas"];

// \b evita falsos positivos: "ahora" contiene "hora" y "solicita" contiene "cita"
const RE_CANCEL = /\b(cancel\w*|anular|mi cita|mis citas|mis reservas?)\b/i;
const RE_SLOTS = /\b(cita|citas|agendar|reservar|hora|horas|horario|horarios|disponib\w*)\b/i;

// Formato de fechas ("2026-11-20 09:00" -> "vie, 20 nov", "09:00")
const toDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (s) => new Date(s.replace(" ", "T")).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (s) => s.slice(11, 16);
const fmtFull = (s) => `${fmtDate(s)}, ${fmtTime(s)}`;
// Agrupa las horas por día: [["2026-11-20", [slot, slot…]], …]
const byDay = (slots) => Object.entries(slots.reduce((acc, s) => { const d = s.start_at.slice(0, 10); (acc[d] = acc[d] || []).push(s); return acc; }, {}));

// Consultas a la API de citas (no tocan el estado; quien las llama decide qué mostrar)
const fetchSlots = () => {
  const from = new Date();
  const to = new Date();
  to.setDate(from.getDate() + 14);
  return api(`/appointments/availability?from_date=${toDate(from)}&to_date=${toDate(to)}&limit=50`);
};
const fetchAppointments = () => api("/appointments");

export default function Boberto({ open, onClose }) {
  // Cada mensaje puede traer `slots` (horas para elegir) o `appts` (citas para cancelar).
  // Esas listas solo se muestran bajo el ÚLTIMO mensaje: al escribir o responder algo nuevo desaparecen solas.
  const [msgs, setMsgs] = useState([{ bot: true, t: "¡Hola! Soy Boberto, tu asistente. Puedo ayudarte a entender exámenes y resolver dudas generales sobre salud renal. No emito diagnósticos." }]);
  const [text, setText] = useState("");
  const end = useRef();
  const [typing, setTyping] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open, typing]);

  const send = async (q) => {
    q = (q ?? text).trim();
    if (!q || typing) return;
    const history = [...msgs, { t: q }];
    setMsgs(history);
    setText("");
    setSelectedSlot(null);
    setTyping(true); // muestra "escribiendo…" mientras responde la IA
    let ans;
    try {
      const r = await api("/chatbot", { method: "POST", body: { messages: history.map((m) => ({ role: m.bot ? "assistant" : "user", content: m.t })) } });
      ans = r.reply;
    } catch {
      // Respaldo (RF-04): si la IA no responde, se usan las reglas predefinidas
      ans = RULES.find(([re]) => re.test(q))?.[1] ?? DEFAULT;
    }
    const extra = {};
    try {
      if (RE_CANCEL.test(q)) extra.appts = await fetchAppointments();
      else if (RE_SLOTS.test(q)) extra.slots = await fetchSlots();
    } catch (error) {
      ans += `\n\n${error.message}`;
    }
    setMsgs((m) => [...m, { bot: true, t: ans, ...extra }]);
    setTyping(false);
  };

  const confirmAppointment = async () => {
    if (!selectedSlot || booking) return;
    const slot = selectedSlot;
    setBooking(true);
    try {
      const r = await api("/appointments", { method: "POST", body: { slot_id: slot.id } });
      setSelectedSlot(null);
      setMsgs((m) => [...m, { bot: true, t: `Listo, tu cita quedó agendada para el ${fmtFull(r.start_at)}. Si necesitas cambiarla, escríbeme "cancelar mi cita".` }]);
    } catch (error) {
      // p. ej. "Esa hora ya no está disponible": se vuelve a ofrecer lo que sigue libre
      let fresh = [];
      try { fresh = await fetchSlots(); } catch { /* sin lista nueva */ }
      setSelectedSlot(null);
      setMsgs((m) => [...m, { bot: true, t: error.message + (fresh.length ? " Estas son las horas que siguen libres:" : ""), slots: fresh }]);
    } finally {
      setBooking(false);
    }
  };

  const cancelAppointment = async (appointment) => {
    if (cancelling !== null) return;
    if (!window.confirm(`¿Cancelar tu cita del ${fmtFull(appointment.start_at)}?`)) return;
    setCancelling(appointment.id);
    try {
      await api(`/appointments/${appointment.id}`, { method: "DELETE" });
      let rest = [];
      try { rest = await fetchAppointments(); } catch { /* sin lista nueva */ }
      setMsgs((m) => [...m, { bot: true, t: `Listo, cancelé tu cita del ${fmtFull(appointment.start_at)}.` + (rest.length ? " Estas son las que te quedan:" : ""), appts: rest }]);
    } catch (error) {
      setMsgs((m) => [...m, { bot: true, t: error.message }]);
    } finally {
      setCancelling(null);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 z-50 sm:w-96 sm:h-[34rem] bg-white sm:rounded-2xl shadow-2xl flex flex-col border border-blue-100 anim-panel">
      <div className="flex items-center gap-3 p-4 border-b border-blue-100">
        <div className="w-10 h-10 rounded-full bg-brand text-white grid place-items-center"><Bot size={22} /></div>
        <div className="flex-1"><p className="font-bold leading-tight">Boberto</p><p className="text-xs text-slate-500">Tu aliado en el cuidado renal</p></div>
        <button onClick={onClose} aria-label="Cerrar"><X /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-bg">
        {msgs.map((m, i) => {
          const last = i === msgs.length - 1;
          return (
            <div key={i} className="space-y-2">
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line anim-msg ${m.bot ? "bg-slate-100 text-slate-800" : "bg-brand text-white ml-auto"}`}>{m.t}</div>

              {last && m.slots?.length > 0 && (
                <div className="space-y-3 rounded-xl border border-blue-100 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-600">Elige un horario:</p>
                  {byDay(m.slots).map(([day, list]) => (
                    <div key={day}>
                      <p className="text-xs text-slate-500 mb-1 capitalize">{fmtDate(list[0].start_at)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg border px-2.5 py-1 text-sm ${selectedSlot?.id === slot.id ? "border-brand bg-soft text-brand font-semibold" : "border-slate-200"}`}
                          >
                            {fmtTime(slot.start_at)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {selectedSlot && (
                    <button type="button" onClick={confirmAppointment} disabled={booking} className="btn w-full">
                      {booking ? "Agendando..." : `Confirmar cita: ${fmtFull(selectedSlot.start_at)}`}
                    </button>
                  )}
                </div>
              )}

              {last && m.appts?.length > 0 && (
                <div className="space-y-2 rounded-xl border border-red-100 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-600">Tus citas agendadas:</p>
                  {m.appts.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <span className="text-sm">{fmtFull(appointment.start_at)}{appointment.doctor_name ? ` · ${appointment.doctor_name}` : ""}</span>
                      <button
                        type="button"
                        onClick={() => cancelAppointment(appointment)}
                        disabled={cancelling !== null}
                        className="text-xs font-semibold text-red-600"
                      >
                        {cancelling === appointment.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {msgs.length === 1 && SUGGEST.map((s) => (
          <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm card hover:bg-soft anim-up">{s}</button>
        ))}
        {typing && <div className="bg-slate-100 rounded-2xl px-4 py-3 w-16 flex gap-1 anim-msg" aria-label="Boberto está escribiendo"><span className="dot" /><span className="dot" /><span className="dot" /></div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 flex gap-2 border-t border-blue-100">
        <input className="input" placeholder="Escribe tu mensaje..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn !px-3" aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}