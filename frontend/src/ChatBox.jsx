import { useEffect, useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import Avatar from "./Avatar";

// Chat reutilizable (paciente y médico). `load` debe devolver { with, messages } y `send(texto)` envía.
export default function ChatBox({ load, send }) {
  const [data, setData] = useState({ with: null, messages: [] });
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const box = useRef(null);
  const shown = useRef(0);

  useEffect(() => {
    let on = true;
    const tick = () => load().then((d) => { if (on) setData(d); }).catch((e) => { if (on) setErr(e.message); });
    tick();
    const id = setInterval(tick, 5000); // actualiza cada 5 s
    return () => { on = false; clearInterval(id); };
  }, [load]);

  useEffect(() => {
    const el = box.current;
    if (el && data.messages.length !== shown.current) { el.scrollTop = el.scrollHeight; shown.current = data.messages.length; }
  }, [data]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try { await send(text); setText(""); setErr(""); setData(await load()); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card !p-0 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-blue-100">
        <Avatar user={data.with} size={40} />
        <div><p className="font-bold leading-tight">{data.with?.name ?? "…"}</p><p className="text-xs text-slate-500">{data.with?.clinical_id}</p></div>
      </div>
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-bg">
        {data.messages.length === 0 && <p className="text-center text-sm text-slate-400 mt-8">Aún no hay mensajes. ¡Escribe el primero!</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm anim-msg ${m.mine ? "ml-auto bg-brand text-white" : "bg-white border border-blue-100"}`}>
            {m.content}
            <p className={`text-[10px] mt-1 ${m.mine ? "text-blue-100" : "text-slate-400"}`}>{m.timestamp.slice(0, 16)}</p>
          </div>
        ))}
      </div>
      {err && <p className="text-sm text-danger bg-red-50 p-2">{err}</p>}
      <form onSubmit={submit} className="p-3 flex gap-2 border-t border-blue-100">
        <input className="input" placeholder="Escribe un mensaje…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" aria-label="Enviar"><Send size={18} /></button>
      </form>
      <p className="text-[11px] text-slate-500 flex items-center gap-1 px-3 pb-2"><ShieldCheck size={12} className="text-brand" />La comunicación es segura y confidencial.</p>
    </div>
  );
}
