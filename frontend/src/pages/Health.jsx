import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Minus, Plus, Scale, Activity, Trash2 } from "lucide-react";
import { api } from "../api";
import { SYMPTOMS } from "../content";

const EMPTY = { weight: "", systolic: "", diastolic: "", micturition_count: 4, urine_amount: "intermedia", symptoms: [], notes: "" };

export default function Health() {
  const [logs, setLogs] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [gone, setGone] = useState(null);
  const load = () => api("/logs").then(setLogs).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = (s) => setF((p) => {
    if (s === "Ninguno") return { ...p, symptoms: p.symptoms.includes(s) ? [] : [s] };
    const base = p.symptoms.filter((x) => x !== "Ninguno");
    return { ...p, symptoms: base.includes(s) ? base.filter((x) => x !== s) : [...base, s] };
  });

  async function save(e) {
    e.preventDefault(); setMsg(null);
    try {
      await api("/logs", { method: "POST", body: { ...f, weight: +f.weight, systolic: +f.systolic, diastolic: +f.diastolic } });
      setMsg({ ok: true, t: "Registro guardado correctamente" }); setF(EMPTY); load();
    } catch (e) { setMsg({ ok: false, t: e.message }); }
  }

  async function remove(id) {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setGone(id); // la fila se desvanece antes de borrarse
    await new Promise((r) => setTimeout(r, 300));
    try { await api(`/logs/${id}`, { method: "DELETE" }); setMsg({ ok: true, t: "Registro eliminado" }); await load(); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
    setGone(null);
  }

  const last = logs[0];
  const chart = [...logs].reverse().map((l) => ({ dia: l.created_at.slice(5, 10), Peso: l.weight, Sistólica: l.systolic }));
  const cards = last && [
    [Scale, "Peso", `${last.weight} kg`], [Activity, "Presión arterial", `${last.systolic}/${last.diastolic} mmHg`],
    [Droplets, "Micciones", `${last.micturition_count} veces · ${last.urine_amount}`],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-dark">Monitoreo de Salud</h1>

      {last && (
        <section>
          <h2 className="font-bold mb-2">Tus índices recientes <span className="text-xs font-normal text-slate-500">({last.created_at.slice(0, 10)})</span></h2>
          <div className="grid sm:grid-cols-3 gap-3 stagger">
            {cards.map(([Icon, t, v]) => (
              <div key={t} className="card flex items-center gap-3"><Icon className="text-brand" /><div><p className="text-xs text-slate-500">{t}</p><p className="font-bold">{v}</p></div></div>
            ))}
          </div>
          {chart.length > 1 && (
            <div className="card mt-3 h-64">
              <ResponsiveContainer>
                <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="dia" fontSize={12} /><YAxis yAxisId="a" fontSize={12} domain={["auto", "auto"]} /><YAxis yAxisId="b" orientation="right" fontSize={12} domain={["auto", "auto"]} /><Tooltip />
                  <Line yAxisId="a" dataKey="Peso" stroke="#2563EB" strokeWidth={2} /><Line yAxisId="b" dataKey="Sistólica" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <form onSubmit={save} className="card space-y-4">
        <h2 className="font-bold text-lg">Registrar métricas de hoy</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">Peso corporal (kg)<input className="input mt-1" type="number" step="0.1" required value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
          <label className="text-sm">Presión sistólica<input className="input mt-1" type="number" required placeholder="120" value={f.systolic} onChange={(e) => setF({ ...f, systolic: e.target.value })} /></label>
          <label className="text-sm">Presión diastólica<input className="input mt-1" type="number" required placeholder="80" value={f.diastolic} onChange={(e) => setF({ ...f, diastolic: e.target.value })} /></label>
        </div>

        <div>
          <p className="text-sm mb-1">¿Cuántas veces orinaste hoy?</p>
          <div className="flex items-center gap-3">
            <button type="button" className="btn !p-2" onClick={() => setF({ ...f, micturition_count: Math.max(0, f.micturition_count - 1) })}><Minus size={16} /></button>
            <span key={f.micturition_count} className="text-2xl font-bold w-10 text-center anim-pop">{f.micturition_count}</span>
            <button type="button" className="btn !p-2" onClick={() => setF({ ...f, micturition_count: f.micturition_count + 1 })}><Plus size={16} /></button>
          </div>
          <div className="flex gap-2 mt-3">
            {["poca", "intermedia", "abundante"].map((o) => (
              <button type="button" key={o} onClick={() => setF({ ...f, urine_amount: o })}
                className={`px-3 py-1.5 rounded-full text-sm border capitalize ${f.urine_amount === o ? "bg-brand text-white border-brand" : "bg-white border-slate-300"}`}>{o}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm mb-2">Síntomas del día</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SYMPTOMS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm bg-soft rounded-lg p-2 cursor-pointer">
                <input type="checkbox" checked={f.symptoms.includes(s)} onChange={() => toggle(s)} />{s}
              </label>
            ))}
          </div>
        </div>

        <textarea className="input" rows={2} placeholder="Notas adicionales (opcional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {msg && <p key={msg.t} className={`text-sm rounded-lg p-2 anim-pop ${msg.ok ? "bg-emerald-50 text-ok" : "bg-red-50 text-danger"}`}>{msg.t}</p>}
        <button className="btn w-full sm:w-auto">Guardar registro</button>
      </form>

      {logs.length > 0 && (
        <section className="card">
          <h2 className="font-bold">Mis registros</h2>
          <p className="text-xs text-slate-500 mb-2">¿Te equivocaste en un dato? Elimina el registro y vuelve a guardarlo con los valores correctos.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Fecha</th><th>Peso</th><th>Presión</th><th>Micciones</th><th>Síntomas</th><th></th></tr></thead>
              <tbody className="stagger-fade">
                {logs.map((l) => (
                  <tr key={l.id} className={`border-t border-slate-100 transition-opacity duration-300 ${gone === l.id ? "opacity-0 bg-red-50" : ""}`}>
                    <td className="py-1.5 whitespace-nowrap">{l.created_at.slice(0, 16)}</td><td>{l.weight} kg</td><td>{l.systolic}/{l.diastolic}</td>
                    <td>{l.micturition_count} · {l.urine_amount}</td><td className="text-xs">{l.symptoms.length ? l.symptoms.join(", ") : "—"}</td>
                    <td><button onClick={() => remove(l.id)} className="text-danger p-1 hover:bg-red-50 rounded" aria-label="Eliminar registro"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
