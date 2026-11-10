import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api } from "../api";
import ChatBox from "../ChatBox";

export default function Messages() {
  const load = useCallback(() => api("/messages"), []);
  const send = useCallback((content) => api("/messages", { method: "POST", body: { content } }), []);
  return (
    <div className="max-w-2xl space-y-3">
      <Link to="/perfil" className="text-brand font-semibold flex items-center gap-1"><ChevronLeft size={18} />Perfil</Link>
      <h1 className="text-2xl font-extrabold text-brand-dark">Mensajes del médico</h1>
      <div className="h-[30rem]"><ChatBox load={load} send={send} /></div>
    </div>
  );
}
