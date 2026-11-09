import { useState } from "react";
import { Bell, CheckCircle2, Circle } from "lucide-react";

const INIT = [
  ["Registrar mis métricas de hoy", "Todos los días · 20:00"],
  ["Tomar agua durante el día", "Cada 2 horas"],
  ["Revisar medicamentos con mi médico antes de tomar algo nuevo", "Siempre"],
  ["Control médico mensual", "Primer lunes del mes"],
];

export default function Reminders() {
  const [done, setDone] = useState({});
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-extrabold text-brand-dark flex items-center gap-2"><Bell />Recordatorios</h1>
      {INIT.map(([t, w]) => (
        <button key={t} onClick={() => setDone({ ...done, [t]: !done[t] })} className="card w-full flex items-center gap-3 text-left hover:shadow-md">
          {done[t] ? <CheckCircle2 className="text-ok" /> : <Circle className="text-slate-300" />}
          <div><p className={`font-semibold text-sm ${done[t] ? "line-through text-slate-400" : ""}`}>{t}</p><p className="text-xs text-slate-500">{w}</p></div>
        </button>
      ))}
      <p className="text-xs text-slate-400">Prototipo: los recordatorios no envían notificaciones reales.</p>
    </div>
  );
}
