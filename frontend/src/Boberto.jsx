import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { api } from "./api";

// Asistente con respuestas predefinidas (plan de contingencia del RF-04: sin IA real, sin diagnósticos)
const RULES = [
  [/diagn|receta|recet|qué tengo|que tengo|dosis/i, "No puedo diagnosticar ni recetar. Si tienes síntomas, consulta a un profesional de la salud lo antes posible."],
  [/examen|laboratorio|creatinina|urea/i, "Puedes subir una foto o PDF de tu examen y te lo explicaré en lenguaje sencillo. Una creatinina elevada puede indicar que los riñones filtran menos, pero solo tu médico puede interpretarla. (Subida de archivos: próxima versión.)"],
  [/ibuprofeno|naproxeno|ketorolaco|medicament|pastilla|dolor|automedic/i, "⚠️ No te automediques. Ibuprofeno, naproxeno y ketorolaco pueden dañar tus riñones, sobre todo si estás deshidratado. Consulta a tu médico antes de tomarlos."],
  [/hora|cita|agendar|médico|medico/i, "Puedes escribirle a tu médico desde Perfil → Mensajes del médico. Para urgencias, acude al servicio de urgencias más cercano."],
  [/hidrat|agua|beber|líquido|liquido/i, "Mantenerte bien hidratado ayuda a proteger tus riñones. Si tienes vómitos, diarrea o fiebre, avisa a tu médico: pueden requerir ajustes."],
  [/síntoma|sintoma|hincha|náusea|nausea|fatiga|orina/i, "Señales para vigilar: poca orina, hinchazón en piernas o rostro, náuseas, fatiga extrema o falta de aire. Regístralos en Salud y consulta a tu médico si aparecen."],
];
const DEFAULT = "Puedo ayudarte con dudas generales sobre hidratación, síntomas de alerta y medicamentos de riesgo. Para temas clínicos, consulta a tu médico.";
const SUGGEST = ["Ayúdame a entender mi examen de laboratorio", "Ayúdame a agendar una cita médica", "Tengo una duda sobre mi hidratación / síntomas"];

export default function Boberto({ open, onClose }) {
  const [msgs, setMsgs] = useState([{ bot: true, t: "¡Hola! Soy Boberto, tu asistente. Puedo ayudarte a entender exámenes y resolver dudas generales sobre salud renal. No emito diagnósticos." }]);
  const [text, setText] = useState("");
  const end = useRef();
  const [typing, setTyping] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open, typing]);

  const send = async (q) => {
    q = (q ?? text).trim();
    if (!q || typing) return;
    const history = [...msgs, { t: q }];
    setMsgs(history);
    setText("");
    setTyping(true); // muestra "escribiendo…" mientras responde la IA
    let ans;
    try {
      const r = await api("/chatbot", { method: "POST", body: { messages: history.map((m) => ({ role: m.bot ? "assistant" : "user", content: m.t })) } });
      ans = r.reply;
    } catch {
      // Respaldo (RF-04): si la IA no responde, se usan las reglas predefinidas
      ans = RULES.find(([re]) => re.test(q))?.[1] ?? DEFAULT;
    }
    setMsgs((m) => [...m, { bot: true, t: ans }]);
    setTyping(false);
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
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm anim-msg ${m.bot ? "bg-slate-100 text-slate-800" : "bg-brand text-white ml-auto"}`}>{m.t}</div>
        ))}
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
