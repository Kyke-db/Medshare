import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Camera, LogOut, MessageSquare, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { CONDITIONS } from "../content";
import Avatar, { resizeImage } from "../Avatar";

function Note({ n, k }) {
  return n?.k === k ? <p className={`text-sm rounded-lg p-2 anim-pop ${n.ok ? "bg-emerald-50 text-ok" : "bg-red-50 text-danger"}`}>{n.t}</p> : null;
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { unread } = useOutletContext();
  const isDoc = user.role === "doctor";
  const [f, setF] = useState({ name: user.name, birth_date: user.birth_date || "", weight: user.weight ?? "", height: user.height ?? "" });
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [note, setNote] = useState(null);
  const flash = (k, ok, t) => { setNote({ k, ok, t }); setTimeout(() => setNote(null), 3000); };
  const age = user.birth_date ? Math.floor((Date.now() - new Date(user.birth_date)) / 31557600000) : null;

  async function onPhoto(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const photo = await resizeImage(file);
      await api("/me/photo", { method: "PUT", body: { photo } });
      setUser({ ...user, photo }); flash("photo", true, "Foto actualizada");
    } catch (err) { flash("photo", false, err.message); }
  }
  async function removePhoto() {
    await api("/me/photo", { method: "PUT", body: { photo: "" } });
    setUser({ ...user, photo: null }); flash("photo", true, "Foto eliminada");
  }
  async function saveProfile(e) {
    e.preventDefault();
    try {
      const res = await api("/me/profile", { method: "PUT", body: { name: f.name, birth_date: f.birth_date, weight: f.weight === "" ? null : +f.weight, height: f.height === "" ? null : +f.height } });
      setUser(res); flash("profile", true, "Datos guardados");
    } catch (err) { flash("profile", false, err.message); }
  }
  async function savePw(e) {
    e.preventDefault();
    if (pw.next !== pw.again) return flash("pw", false, "Las contraseñas nuevas no coinciden");
    try {
      await api("/me/password", { method: "POST", body: { current: pw.current, new: pw.next } });
      setPw({ current: "", next: "", again: "" }); flash("pw", true, "Contraseña actualizada");
    } catch (err) { flash("pw", false, err.message); }
  }
  async function toggle(c) {
    const next = user.conditions.includes(c) ? user.conditions.filter((x) => x !== c) : [...user.conditions, c];
    await api("/me/conditions", { method: "PUT", body: { conditions: next } });
    setUser({ ...user, conditions: next }); flash("cond", true, "Guardado");
  }

  return (
    <div className="space-y-4 max-w-2xl stagger">
      <div className="card flex items-center gap-4">
        <Avatar key={(user.photo || "").slice(-16)} user={user} size={80} />
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{user.name}</h1>
          <p className="text-sm text-slate-500">{isDoc ? "Profesional de la salud" : "Paciente"} · {user.clinical_id}{age ? ` · ${age} años` : ""}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <label className="btn !py-1.5 !px-3 text-sm inline-flex items-center gap-1 cursor-pointer"><Camera size={15} />Cambiar foto<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
            {user.photo && <button onClick={removePhoto} className="text-sm text-danger flex items-center gap-1 px-2"><Trash2 size={15} />Quitar</button>}
          </div>
        </div>
      </div>
      <Note n={note} k="photo" />

      <form onSubmit={saveProfile} className="card space-y-3">
        <h2 className="font-bold">Mis datos</h2>
        <label className="text-sm block">Nombre completo<input className="input mt-1" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        {!isDoc && (
          <>
            <label className="text-sm block">Fecha de nacimiento<input className="input mt-1" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Peso base (kg)<input className="input mt-1" type="number" step="0.1" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
              <label className="text-sm">Estatura (cm)<input className="input mt-1" type="number" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} /></label>
            </div>
          </>
        )}
        <Note n={note} k="profile" />
        <button className="btn">Guardar cambios</button>
      </form>

      {!isDoc && (
        <div className="card">
          <h2 className="font-bold mb-2">Antecedentes y condiciones {note?.k === "cond" && <span className="text-xs text-ok font-normal">✓ guardado</span>}</h2>
          <div className="space-y-2">
            {CONDITIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={user.conditions.includes(c)} onChange={() => toggle(c)} />{c}</label>
            ))}
          </div>
          {user.conditions.some((c) => c.includes("analgésicos")) && (
            <p className="mt-3 text-sm bg-warn-soft border border-warn rounded-lg p-2">⚠️ Marcaste uso de antiinflamatorios sin receta. Coméntalo con tu médico.</p>
          )}
        </div>
      )}

      <form onSubmit={savePw} className="card space-y-3">
        <h2 className="font-bold">Cambiar contraseña</h2>
        <input className="input" type="password" placeholder="Contraseña actual" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input className="input" type="password" placeholder="Nueva contraseña (mín. 6 caracteres)" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <input className="input" type="password" placeholder="Repite la nueva contraseña" required value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
        <Note n={note} k="pw" />
        <button className="btn">Actualizar contraseña</button>
      </form>

      {!isDoc && (
        <Link to="/mensajes" className="card flex items-center gap-3 hover:shadow-md">
          <MessageSquare className="text-brand" /><span className="font-semibold flex-1">Mensajes del médico</span>
          {unread > 0 && <span className="bg-danger text-white text-xs rounded-full px-2 py-0.5">{unread} nuevo{unread > 1 ? "s" : ""}</span>}
        </Link>
      )}
      <button onClick={logout} className="btn !bg-white !text-danger border border-danger w-full flex justify-center gap-2 md:hidden"><LogOut size={18} />Cerrar sesión</button>
    </div>
  );
}
