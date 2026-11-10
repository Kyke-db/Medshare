import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import CountUp from "../CountUp";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (iso) => (iso?.length === 10 ? `${+iso.slice(8)} ${MESES[+iso.slice(5, 7) - 1]}` : iso);
const num = (v, d = 2) => Number(v).toLocaleString("es-CL", { maximumFractionDigits: d });

// Umbrales de riesgo usados en el prototipo (deben ser validados por el equipo médico)
const RISK = {
  Alto: { color: "#EF4444", label: "Riesgo alto", rule: "creatinina de 1,5 mg/dL o más" },
  Medio: { color: "#F59E0B", label: "Riesgo medio", rule: "creatinina entre 1,2 y 1,5 mg/dL" },
  Bajo: { color: "#10B981", label: "Riesgo bajo", rule: "creatinina menor a 1,2 mg/dL" },
};
const ORDER = ["Alto", "Medio", "Bajo"];
const tick = { fontSize: 12, fill: "#475569" };
const title = (value, extra) => ({ value, fill: "#334155", fontSize: 12, fontWeight: 600, ...extra });

function Card({ title: t, hint, children }) {
  return (
    <div className="card">
      <h2 className="font-bold text-slate-800">{t}</h2>
      <p className="text-xs text-slate-500 mb-3">{hint}</p>
      <div className="h-64">{children}</div>
    </div>
  );
}

function Trend({ data, dataKey, name, unit, yTitle, color, domain, refLine }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 10, right: 24, bottom: 28, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="fecha" tickFormatter={fecha} interval={4} tick={tick} label={title("Fecha", { position: "insideBottom", offset: -16 })} />
        <YAxis domain={domain} tick={tick} width={62} tickFormatter={(v) => num(v, 1)}
          label={title(yTitle, { angle: -90, position: "insideLeft", offset: 6, style: { textAnchor: "middle" } })} />
        <Tooltip labelFormatter={fecha} formatter={(v) => [`${num(v)} ${unit}`, name]} />
        {refLine && <ReferenceLine y={refLine.y} stroke="#F59E0B" strokeDasharray="6 4" label={{ value: refLine.label, position: "insideTopLeft", fill: "#B45309", fontSize: 11 }} />}
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} animationDuration={1400} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Kpi({ label, value, hint, danger }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`text-3xl font-extrabold ${danger ? "text-danger" : "text-brand"}`}>{value}</p>
      <p className="text-[11px] text-slate-400 leading-tight">{hint}</p>
    </div>
  );
}

function RiskCard({ data }) {
  const by = Object.fromEntries(data.map((r) => [r.name, r.value]));
  const total = data.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div className="card">
      <h2 className="font-bold text-slate-800">Pacientes por nivel de riesgo</h2>
      <p className="text-xs text-slate-500 mb-4">Según la última creatinina registrada de cada paciente.</p>
      <div className="flex h-4 rounded-full overflow-hidden mb-3 bg-slate-100">
        {ORDER.map((k) => by[k] ? <div key={k} className="grow-x" style={{ width: `${(by[k] / total) * 100}%`, background: RISK[k].color }} title={`${RISK[k].label}: ${by[k]}`} /> : null)}
      </div>
      {ORDER.map((k) => (
        <div key={k} className="flex items-center gap-3 py-2.5 border-t border-slate-100 first:border-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: RISK[k].color }} />
          <div className="flex-1"><p className="font-semibold text-sm">{RISK[k].label}</p><p className="text-xs text-slate-500">{RISK[k].rule}</p></div>
          <div className="text-right"><p className="text-xl font-extrabold leading-none">{by[k] || 0}</p><p className="text-xs text-slate-500">{Math.round(((by[k] || 0) / total) * 100)}%</p></div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/dashboard").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-danger">{err}</p>;
  if (!d) return <div className="flex items-center gap-3 text-slate-500"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />Cargando dashboard…</div>;

  const k = d.kpis, t = d.tendencia;
  const periodo = t.length ? `${fecha(t[0].fecha)} – ${fecha(t[t.length - 1].fecha)}` : "";
  const rows = [...d.pacientes].sort((a, b) => ORDER.indexOf(a.riesgo) - ORDER.indexOf(b.riesgo) || b.dias_sin_registro - a.dias_sin_registro || a.paciente.localeCompare(b.paciente));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">Dashboard médico</h1>
        <p className="text-sm text-slate-500">Período: {periodo} · datos ficticios desde <code>pacientes.csv</code></p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <Kpi label="Pacientes" value={<CountUp value={k.pacientes} />} hint="con registros en el período" />
        <Kpi label="Registros" value={<CountUp value={k.registros} />} hint="datos diarios ingresados" />
        <Kpi label="Creatinina promedio" value={<CountUp value={k.creatinina_prom} decimals={2} suffix=" mg/dL" />} hint="de todos los registros" />
        <Kpi label="Pacientes en alerta" value={<CountUp value={k.alertas} />} hint="riesgo alto o 3+ días sin registrar" danger />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Evolución en el tiempo</h2>
        <div className="grid lg:grid-cols-2 gap-4 stagger">
          <Card title="Creatinina promedio" hint="Promedio diario de todos los pacientes. Eje horizontal: fecha · Eje vertical: mg/dL.">
            <Trend data={t} dataKey="creatinina" name="Creatinina" unit="mg/dL" yTitle="Creatinina (mg/dL)" color="#2563EB" domain={[0, 1.6]}
              refLine={{ y: 1.2, label: "Umbral de riesgo medio (1,2)" }} />
          </Card>
          <Card title="Micciones por día" hint="Promedio diario de veces que orinaron los pacientes. Eje horizontal: fecha · Eje vertical: veces por día.">
            <Trend data={t} dataKey="micciones" name="Micciones" unit="veces/día" yTitle="Veces por día" color="#10B981" domain={[0, 8]} />
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Síntomas y riesgo</h2>
        <div className="grid lg:grid-cols-2 gap-4 stagger">
          <Card title="Síntomas más reportados" hint="Eje vertical: síntoma · Eje horizontal: cantidad de veces reportado en el período.">
            <ResponsiveContainer>
              <BarChart data={d.sintomas} layout="vertical" margin={{ top: 5, right: 40, bottom: 28, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={tick} allowDecimals={false} label={title("Cantidad de reportes", { position: "insideBottom", offset: -16 })} />
                <YAxis type="category" dataKey="name" tick={tick} width={140} />
                <Tooltip cursor={{ fill: "#eff6ff" }} formatter={(v) => [`${v} reportes`, "Total"]} />
                <Bar dataKey="value" fill="#2563EB" radius={[0, 6, 6, 0]} barSize={18} animationDuration={1000}>
                  <LabelList dataKey="value" position="right" fill="#1e293b" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <RiskCard data={d.riesgo} />
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="font-bold text-slate-800">Detalle por paciente</h2>
        <p className="text-xs text-slate-500 mb-3">Ordenados por prioridad: primero riesgo alto y los que llevan más días sin registrar.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2">ID paciente</th><th>Último registro</th><th>Creatinina (mg/dL)</th><th>Nivel de riesgo</th><th>Estado de registro</th>
            </tr>
          </thead>
          <tbody className="stagger-fade">
            {rows.map((p) => (
              <tr key={p.paciente} className={`border-b border-slate-100 ${p.riesgo === "Alto" ? "bg-red-50/60" : ""}`}>
                <td className="py-2 font-semibold">{p.paciente}</td>
                <td>{fecha(p.ultimo)}</td>
                <td>{num(p.creatinina)}</td>
                <td><span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ background: RISK[p.riesgo].color }}>{p.riesgo}</span></td>
                <td>{p.inactivo
                  ? <span className="px-2 py-0.5 rounded-full text-xs bg-warn-soft text-amber-900">Sin registrar hace {p.dias_sin_registro} días</span>
                  : <span className="text-xs text-ok">Al día</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-3">Los umbrales de riesgo son referenciales del prototipo y deben ser validados por el equipo médico.</p>
      </section>
    </div>
  );
}
