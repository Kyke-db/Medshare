import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Send, ShieldCheck } from "lucide-react";
import { api } from "../api";

export default function Messages() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef();
  const load = () => api("/messages").then(setMsgs).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { end.current?.scrollIntoView(); }, [msgs]);

  async function send(e) {
    e.preventDefault();
    try { await api("/messages", { method: "POST", body: { content: text } }); setText(""); setErr(""); load(); }
    catch (e) { setErr(e.message + ". Guardamos tu mensaje como borrador; en urgencias acude al servicio médico."); }
  }
  return (
    <div className="max-w-2xl space-y-3">
      <Link to="/perfil" className="text-brand font-semibold flex items-center gap-1"><ChevronLeft size={18} />Perfil</Link>
      <h1 className="text-2xl font-extrabold text-brand-dark">Mensajes del médico</h1>
      <div className="card h-[26rem] overflow-y-auto space-y-3">
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-brand text-white" : "bg-slate-100"}`}>
            {!m.mine && <p className="text-xs font-semibold text-brand mb-0.5">Dr. Carlos Mendoza</p>}{m.content}
            <p className={`text-[10px] mt-1 ${m.mine ? "text-blue-100" : "text-slate-400"}`}>{m.timestamp.slice(0, 16)}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {err && <p className="text-sm text-danger bg-red-50 rounded-lg p-2">{err}</p>}
      <form onSubmit={send} className="flex gap-2"><input className="input" placeholder="Escribe un mensaje a tu médico…" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn" aria-label="Enviar"><Send size={18} /></button></form>
      <p className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck size={14} className="text-brand" />La comunicación con tu médico es segura y confidencial.</p>
    </div>
  );
}
