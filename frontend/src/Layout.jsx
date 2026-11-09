import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, BookOpen, Bell, Bot, Heart, Home, LogOut, TriangleAlert, User } from "lucide-react";
import { useAuth } from "./auth";
import { api } from "./api";
import Boberto from "./Boberto";

const PATIENT = [["/", "Hogar", Home], ["/aprender", "Aprender", BookOpen], ["/salud", "Salud", Heart], ["/recordatorios", "Recordatorios", Bell], ["/perfil", "Perfil", User]];
const DOCTOR = [["/dashboard", "Dashboard", BarChart3]];

export default function Layout() {
  const { user, logout } = useAuth();
  const [bot, setBot] = useState(false);
  const [unread, setUnread] = useState(0);
  const items = user.role === "doctor" ? DOCTOR : PATIENT;
  useEffect(() => { if (user.role === "patient") api("/messages/unread").then((r) => setUnread(r.count)).catch(() => {}); }, [user]);

  const link = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-soft text-brand" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="min-h-screen md:flex">
      {/* Menú lateral (computador) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-white border-r border-blue-100 p-4 sticky top-0 h-screen">
        <h1 className="text-2xl font-extrabold text-brand mb-6 px-2">MedShare</h1>
        <nav className="space-y-1 flex-1">
          {items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === "/"} className={link}><Icon size={20} />{label}</NavLink>)}
        </nav>
        <p className="text-xs text-slate-500 px-2 mb-2">{user.name}</p>
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:text-danger"><LogOut size={18} />Cerrar sesión</button>
      </aside>

      <main className="flex-1 pb-36 md:pb-10 min-w-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8"><Outlet context={{ unread }} /></div>
        <div className="fixed bottom-16 md:bottom-0 left-0 md:left-60 right-0 bg-blue-100 text-xs text-brand-dark px-4 py-2 flex gap-2 items-center">
          <TriangleAlert size={14} className="shrink-0" />
          <span><b>Importante:</b> la información de esta página es de carácter educacional. Consulte siempre a su médico.</span>
        </div>
      </main>

      {user.role === "patient" && (
        <button onClick={() => setBot(true)} className="fixed bottom-32 md:bottom-12 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-brand text-white grid place-items-center shadow-xl hover:bg-brand-dark" aria-label="Abrir Boberto"><Bot /></button>
      )}
      <Boberto open={bot} onClose={() => setBot(false)} />

      {/* Barra inferior (celular) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-blue-100 flex justify-around py-2 z-30">
        {items.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center text-[11px] ${isActive ? "text-brand" : "text-slate-400"}`}><Icon size={22} />{label}</NavLink>
        ))}
        <button onClick={logout} className="flex flex-col items-center text-[11px] text-slate-400"><LogOut size={22} />Salir</button>
      </nav>
    </div>
  );
}
