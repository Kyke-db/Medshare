import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import { ARTICLES } from "../content";

export function Learn() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark">Aprender</h1>
      <div className="grid sm:grid-cols-2 gap-4 stagger">
        {ARTICLES.map((a) => (
          <Link key={a.id} to={`/aprender/${a.id}`} className="card hover:shadow-md">
            <span className="text-4xl">{a.emoji}</span>
            <h2 className="font-bold mt-2">{a.title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock size={12} />{a.read} de lectura · Contenido preventivo</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Article() {
  const { id } = useParams();
  const i = ARTICLES.findIndex((a) => a.id === id);
  if (i < 0) return <Navigate to="/aprender" replace />;
  const a = ARTICLES[i], prev = ARTICLES[i - 1], next = ARTICLES[i + 1];
  return (
    <div className="max-w-2xl mx-auto space-y-4 stagger">
      <Link to="/aprender" className="text-brand font-semibold flex items-center gap-1"><ChevronLeft size={18} />Aprender</Link>
      <div className="text-center"><span className="text-6xl">{a.emoji}</span><h1 className="text-2xl font-extrabold text-brand-dark mt-2">{a.title}</h1>
        <p className="text-xs text-slate-500 flex justify-center items-center gap-1 mt-1"><Clock size={12} />{a.read} de lectura · Contenido preventivo</p></div>
      {a.warn && (
        <div className="flex gap-2 rounded-xl bg-warn-soft border border-warn p-3 text-sm text-amber-900">
          <ShieldAlert className="shrink-0 text-warn" /><b>No te automediques.</b> Consulta siempre a tu médico antes de tomar cualquier medicamento.
        </div>
      )}
      <p className="card bg-blue-100/60 text-sm">{a.intro}</p>
      <div className="card space-y-3 stagger">
        <h2 className="font-bold text-brand-dark">{a.heading}</h2>
        {a.items.map(([t, d]) => (
          <div key={t} className="border border-blue-100 rounded-xl p-3"><p className="font-semibold text-sm">{t}</p><p className="text-sm text-slate-600 mt-1">{d}</p></div>
        ))}
      </div>
      <div className="flex justify-between">
        {prev ? <Link to={`/aprender/${prev.id}`} className="btn flex items-center gap-1"><ChevronLeft size={16} />Anterior</Link> : <span />}
        {next ? <Link to={`/aprender/${next.id}`} className="btn flex items-center gap-1">Siguiente<ChevronRight size={16} /></Link> : <span />}
      </div>
    </div>
  );
}
