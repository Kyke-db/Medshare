import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";

const RISK_COLOR = { Bajo: "#10B981", Medio: "#F59E0B", Alto: "#EF4444" };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/dashboard").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-danger">{err}</p>;
  if (!d) return <p className="text-slate-500">Cargando dashboard…</p>;
  const k = d.kpis;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold text-brand-dark">Dashboard médico</h1><p className="text-sm text-slate-500">Seguimiento centralizado · datos desde <code>pacientes.csv</code> (ficticios)</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Pacientes", k.pacientes], ["Registros", k.registros], ["Creatinina prom. (mg/dL)", k.creatinina_prom], ["Alertas", k.alertas]].map(([t, v]) => (
          <div key={t} className="card"><p className="text-xs text-slate-500">{t}</p><p className={`text-3xl font-extrabold ${t === "Alertas" ? "text-danger" : "text-brand"}`}>{v}</p></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card h-72"><p className="font-bold mb-2 text-sm">Tendencia promedio: creatinina y micciones</p>
          <ResponsiveContainer><LineChart data={d.tendencia}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="fecha" fontSize={11} /><YAxis yAxisId="a" fontSize={11} /><YAxis yAxisId="b" orientation="right" fontSize={11} /><Tooltip /><Legend />
            <Line yAxisId="a" dataKey="creatinina" stroke="#2563EB" strokeWidth={2} dot={false} /><Line yAxisId="b" dataKey="micciones" stroke="#10B981" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        <div className="card h-72"><p className="font-bold mb-2 text-sm">Síntomas más reportados</p>
          <ResponsiveContainer><BarChart data={d.sintomas} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" fontSize={11} width={110} /><Tooltip /><Bar dataKey="value" fill="#2563EB" radius={4} /></BarChart></ResponsiveContainer></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card h-72"><p className="font-bold mb-2 text-sm">Pacientes por nivel de riesgo</p>
          <ResponsiveContainer><PieChart><Pie data={d.riesgo} dataKey="value" nameKey="name" outerRadius={80} label>{d.riesgo.map((r) => <Cell key={r.name} fill={RISK_COLOR[r.name]} />)}</Pie><Legend /><Tooltip /></PieChart></ResponsiveContainer></div>
        <div className="card lg:col-span-2 overflow-x-auto"><p className="font-bold mb-2 text-sm">Pacientes</p>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Paciente</th><th>Último registro</th><th>Creatinina</th><th>Riesgo</th><th>Estado</th></tr></thead>
            <tbody>{d.pacientes.map((p) => (
              <tr key={p.paciente} className="border-t border-slate-100"><td className="py-1.5 font-medium">{p.paciente}</td><td>{p.ultimo}</td><td>{p.creatinina}</td>
                <td><span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ background: RISK_COLOR[p.riesgo] }}>{p.riesgo}</span></td>
                <td>{p.inactivo ? <span className="px-2 py-0.5 rounded-full text-xs bg-warn-soft text-amber-900">Inactivo {p.dias_sin_registro} días</span> : <span className="text-xs text-ok">Activo</span>}</td></tr>
            ))}</tbody></table></div>
      </div>
    </div>
  );
}
