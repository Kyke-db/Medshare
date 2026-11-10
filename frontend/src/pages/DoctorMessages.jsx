import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, MessageSquare, Search } from "lucide-react";
import { api } from "../api";
import Avatar from "../Avatar";
import ChatBox from "../ChatBox";

export default function DoctorMessages() {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");

  const refresh = useCallback(() => api("/chat").then(setList).catch(() => {}), []);
  useEffect(() => { refresh(); const id = setInterval(refresh, 8000); return () => clearInterval(id); }, [refresh]);

  const load = useCallback(() => api(`/chat/${sel}`), [sel]);
  const send = useCallback((content) => api(`/chat/${sel}`, { method: "POST", body: { content } }).then(refresh), [sel, refresh]);
  const pick = (id) => { setSel(id); setTimeout(refresh, 800); };

  const shown = list.filter((p) => (p.name + p.clinical_id).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold text-brand-dark">Mensajes con pacientes</h1>
      <div className="md:grid md:grid-cols-[19rem_1fr] gap-4 h-[calc(100vh-15rem)] min-h-[26rem]">
        <div className={`card !p-2 overflow-y-auto h-full ${sel ? "hidden md:block" : ""}`}>
          <div className="relative mb-2"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="input !pl-9" placeholder="Buscar paciente…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {shown.length === 0 && <p className="text-sm text-slate-400 p-3">Aún no hay pacientes registrados.</p>}
          {shown.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)} className={`w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-soft ${sel === p.id ? "bg-soft" : ""}`}>
              <Avatar user={p} size={42} />
              <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{p.name}</p><p className="text-xs text-slate-500 truncate">{p.last || p.clinical_id}</p></div>
              {p.unread > 0 && <span className="bg-danger text-white text-[10px] rounded-full px-1.5 py-0.5">{p.unread}</span>}
            </button>
          ))}
        </div>
        <div className={`h-full ${sel ? "" : "hidden md:grid place-items-center"}`}>
          {sel ? (
            <div className="h-full flex flex-col gap-2">
              <button onClick={() => setSel(null)} className="md:hidden text-brand font-semibold flex items-center gap-1"><ChevronLeft size={18} />Pacientes</button>
              <div className="flex-1 min-h-0"><ChatBox key={sel} load={load} send={send} /></div>
            </div>
          ) : (
            <div className="text-center text-slate-400"><MessageSquare className="mx-auto mb-2" size={40} />Selecciona un paciente para conversar</div>
          )}
        </div>
      </div>
    </div>
  );
}
