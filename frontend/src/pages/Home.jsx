import { Link } from "react-router-dom";
import { ChevronRight, Droplets, HeartPulse, Pill, Stethoscope } from "lucide-react";
import { useAuth } from "../auth";
import { ARTICLES } from "../content";

const TIPS = [
  [Droplets, "Hidrátate bien", "Toma agua durante el día, sobre todo con calor, diarrea o vómitos."],
  [Pill, "No te automediques", "Evita ibuprofeno, naproxeno y ketorolaco sin consultar a tu médico."],
  [Stethoscope, "Consulta regularmente", "Acude a tus controles y avisa si notas cambios en tu orina."],
  [HeartPulse, "Registra tu salud", "Anota tus métricas y síntomas para detectar cambios a tiempo."],
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-blue-100 to-soft p-6 md:p-8">
        <p className="text-slate-600">¡Bienvenido, {user.name.split(" ")[0]}!</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark">Vamos a priorizar tu salud renal.</h1>
        <p className="text-slate-500 text-sm mt-1">Aprende y monitorea.</p>
        <Link to="/salud" className="btn inline-block mt-4">Registrar métricas de hoy</Link>
      </div>

      <section>
        <h2 className="font-bold text-lg mb-3">Educación sobre Lesión Renal Aguda (LRA)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {ARTICLES.map((a) => (
            <Link key={a.id} to={`/aprender/${a.id}`} className="card flex items-center gap-3 hover:shadow-md">
              <span className="text-3xl">{a.emoji}</span>
              <div className="flex-1"><p className="font-semibold text-sm">{a.title}</p><p className="text-xs text-brand">Aprende más</p></div>
              <ChevronRight className="text-slate-400" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-3">Consejos de salud renal</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TIPS.map(([Icon, t, d]) => (
            <div key={t} className="card text-center"><Icon className="mx-auto text-brand" /><p className="font-semibold text-sm mt-2">{t}</p><p className="text-xs text-slate-500 mt-1">{d}</p></div>
          ))}
        </div>
      </section>
    </div>
  );
}
