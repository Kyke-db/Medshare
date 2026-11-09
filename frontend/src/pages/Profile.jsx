import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, MessageSquare } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { CONDITIONS } from "../content";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [saved, setSaved] = useState(false);
  const age = user.birth_date ? Math.floor((Date.now() - new Date(user.birth_date)) / 31557600000) : null;

  async function toggle(c) {
    const next = user.conditions.includes(c) ? user.conditions.filter((x) => x !== c) : [...user.conditions, c];
    await api("/me/conditions", { method: "PUT", body: { conditions: next } });
    setUser({ ...user, conditions: next }); setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  const data = [["ID clínico", user.clinical_id], ["Edad", age ? `${age} años` : "—"], ["Peso", user.weight ? `${user.weight} kg` : "—"], ["Estatura", user.height ? `${user.height} cm` : "—"]];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand text-white grid place-items-center text-2xl font-bold">{user.name[0]}</div>
        <div><h1 className="text-xl font-extrabold">{user.name}</h1><p className="text-sm text-slate-500">Paciente</p></div>
      </div>
      <div className="card grid grid-cols-2 gap-3">
        {data.map(([k, v]) => <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-semibold">{v}</p></div>)}
      </div>
      <div className="card">
        <h2 className="font-bold mb-2">Antecedentes y condiciones {saved && <span className="text-xs text-ok font-normal">✓ guardado</span>}</h2>
        <div className="space-y-2">
          {CONDITIONS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={user.conditions.includes(c)} onChange={() => toggle(c)} />{c}</label>
          ))}
        </div>
        {user.conditions.some((c) => c.includes("analgésicos")) && (
          <p className="mt-3 text-sm bg-warn-soft border border-warn rounded-lg p-2">⚠️ Marcaste uso de antiinflamatorios sin receta. Coméntalo con tu médico.</p>
        )}
      </div>
      <Link to="/mensajes" className="card flex items-center gap-3 hover:shadow-md"><MessageSquare className="text-brand" /><span className="font-semibold">Mensajes del médico</span></Link>
      <button onClick={logout} className="btn !bg-white !text-danger border border-danger w-full flex justify-center gap-2 md:hidden"><LogOut size={18} />Cerrar sesión</button>
    </div>
  );
}
