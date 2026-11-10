import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function Legal({ onAccept }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card max-w-lg w-full space-y-4 anim-pop">
        <div className="flex items-center gap-3 text-brand"><ShieldCheck size={32} className="heartbeat" /><h1 className="text-2xl font-extrabold">Aviso legal y términos de uso</h1></div>
        <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">
          <li>MedShare es una herramienta <b>informativa y educativa</b>. No emite diagnósticos médicos ni receta medicamentos.</li>
          <li>No reemplaza la evaluación de un profesional de la salud. Ante síntomas de alerta, acude a urgencias.</li>
          <li>Tus datos de salud se tratan de forma confidencial y solo con fines de seguimiento dentro de la plataforma.</li>
          <li>Este es un prototipo académico: usa datos ficticios.</li>
        </ul>
        <label className="flex gap-2 items-start text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          He leído y acepto los términos y el aviso legal.
        </label>
        <button className="btn w-full" disabled={!ok} onClick={onAccept}>Continuar</button>
      </div>
    </div>
  );
}
