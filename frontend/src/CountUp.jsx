import { useEffect, useState } from "react";

// Número que "sube" desde 0 hasta su valor (respeta "reducir movimiento")
export default function CountUp({ value, decimals = 0, duration = 1100, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(value); return; }
    let raf, t0;
    const step = (t) => {
      if (t0 === undefined) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      setV(value * (1 - Math.pow(1 - p, 3))); // ease-out
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{v.toLocaleString("es-CL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}
