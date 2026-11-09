import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | 2fa
  const [f, setF] = useState({ clinical_id: "", password: "", name: "", birth_date: "", weight: "", height: "" });
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (mode === "2fa") {
        const r = await api("/auth/2fa", { method: "POST", body: { challenge, code }, token: "" });
        login(r.token, r.user);
      } else {
        const body = mode === "login" ? { clinical_id: f.clinical_id, password: f.password }
          : { ...f, weight: +f.weight || null, height: +f.height || null };
        const r = await api(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body, token: "" });
        setChallenge(r.challenge); setMode("2fa");
      }
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-brand to-brand-dark text-white p-12 text-center">
        <HeartPulse size={72} />
        <h1 className="text-5xl font-extrabold mt-4">MedShare</h1>
        <p className="mt-3 text-lg text-blue-100 max-w-sm">Vamos a priorizar tu salud renal. Aprende y monitorea.</p>
      </div>
      <div className="grid place-items-center p-4 min-h-screen md:min-h-0">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
          <h2 className="text-2xl font-extrabold text-brand-dark">
            {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Verificación en dos pasos"}
          </h2>
          {mode === "2fa" ? (
            <>
              <p className="text-sm text-slate-600">Ingresa el token de seguridad 2FA. <span className="text-slate-400">(Demo: 123456)</span></p>
              <input className="input text-center tracking-widest text-xl" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </>
          ) : (
            <>
              {mode === "register" && <input className="input" placeholder="Nombre completo" required value={f.name} onChange={set("name")} />}
              <input className="input" placeholder="ID clínico (ej. PAC-001)" required value={f.clinical_id} onChange={set("clinical_id")} />
              <input className="input" type="password" placeholder="Contraseña" required value={f.password} onChange={set("password")} />
              {mode === "register" && (
                <>
                  <label className="text-xs text-slate-500">Fecha de nacimiento</label>
                  <input className="input" type="date" required value={f.birth_date} onChange={set("birth_date")} />
                  <div className="flex gap-2">
                    <input className="input" type="number" placeholder="Peso (kg)" value={f.weight} onChange={set("weight")} />
                    <input className="input" type="number" placeholder="Estatura (cm)" value={f.height} onChange={set("height")} />
                  </div>
                </>
              )}
            </>
          )}
          {err && <p className="text-sm text-danger bg-red-50 rounded-lg p-2">{err}</p>}
          <button className="btn w-full" disabled={loading}>{mode === "2fa" ? "Verificar" : mode === "login" ? "Ingresar" : "Registrarme"}</button>
          {mode !== "2fa" && (
            <button type="button" className="text-sm text-brand w-full" onClick={() => { setErr(""); setMode(mode === "login" ? "register" : "login"); }}>
              {mode === "login" ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
            </button>
          )}
          {mode === "login" && (
            <p className="text-xs text-slate-400 border-t pt-2">Demo — Paciente: PAC-001 / demo1234 · Médico: DOC-001 / doctor123</p>
          )}
        </form>
      </div>
    </div>
  );
}
