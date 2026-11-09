// Pequeño cliente para hablar con el backend (FastAPI)
export async function api(path, { method = "GET", body, token } = {}) {
  const t = token ?? localStorage.getItem("token");
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Revisa los datos ingresados");
  return data;
}
