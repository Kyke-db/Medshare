import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./Layout";
import Legal from "./pages/Legal";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { Learn, Article } from "./pages/Learn";
import Health from "./pages/Health";
import Reminders from "./pages/Reminders";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const { user, ready } = useAuth();
  const [accepted, setAccepted] = useState(localStorage.getItem("legal") === "1");

  if (!ready) return <p className="p-8 text-center text-slate-500">Cargando…</p>;
  // RNF-03: no se puede usar la app sin aceptar el aviso legal
  if (!accepted) return <Legal onAccept={() => { localStorage.setItem("legal", "1"); setAccepted(true); }} />;
  if (!user) return <Login />;

  const home = user.role === "doctor" ? "/dashboard" : "/";
  return (
    <Routes>
      <Route element={<Layout />}>
        {user.role === "doctor" ? (
          <Route path="/dashboard" element={<Dashboard />} />
        ) : (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/aprender" element={<Learn />} />
            <Route path="/aprender/:id" element={<Article />} />
            <Route path="/salud" element={<Health />} />
            <Route path="/recordatorios" element={<Reminders />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/mensajes" element={<Messages />} />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
