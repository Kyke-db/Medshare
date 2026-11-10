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
import DoctorMessages from "./pages/DoctorMessages";

export default function App() {
  const { user, ready } = useAuth();
  const [accepted, setAccepted] = useState(localStorage.getItem("legal") === "1");

  if (!ready) return <div className="min-h-screen grid place-items-center"><div className="w-8 h-8 border-[3px] border-brand border-t-transparent rounded-full animate-spin" /></div>;
  // RNF-03: no se puede usar la app sin aceptar el aviso legal
  if (!accepted) return <Legal onAccept={() => { localStorage.setItem("legal", "1"); setAccepted(true); }} />;
  if (!user) return <Login />;

  const home = user.role === "doctor" ? "/dashboard" : "/";
  return (
    <Routes>
      <Route element={<Layout />}>
        {user.role === "doctor" ? (
          <>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mensajes" element={<DoctorMessages />} />
            <Route path="/perfil" element={<Profile />} />
          </>
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
