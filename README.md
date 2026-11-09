# MedShare – versión web

Prototipo web de MedShare (prevención de Lesión Renal Aguda). **React + Vite + Tailwind** (frontend) y **FastAPI + SQLite** (backend). Datos ficticios.

```
medshare/
├── backend/            # API en Python
│   ├── main.py         # login/2FA, registros, mensajes, dashboard (lee el CSV)
│   ├── generate_csv.py # regenera data/pacientes.csv
│   └── data/pacientes.csv
└── frontend/           # React
    └── src/pages/      # Legal, Login, Home, Learn, Health, Reminders, Profile, Messages, Dashboard
```

## Usuarios de demo
| Rol | ID clínico | Contraseña |
|---|---|---|
| Paciente | PAC-001 | demo1234 |
| Médico (dashboard) | DOC-001 | doctor123 |

Código 2FA (simulado): **123456**. Los pacientes nuevos se registran desde la pantalla de login.

## Ejecutar (modo "entrega al cliente": un solo servidor)
Requisitos: Python 3.10+ y Node 18+.

```bash
# 1) Compilar el frontend (una vez, o cuando cambies algo)
cd frontend
npm install
npm run build

# 2) Levantar el backend (sirve también el frontend compilado)
cd ../backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
Abrir http://localhost:8000. La base `medshare.db` se crea sola con datos de ejemplo.

## Modo desarrollo (recarga en vivo)
Terminal 1: `cd backend && uvicorn main:app --reload`
Terminal 2: `cd frontend && npm run dev` → http://localhost:5173

## Compartir la URL con el cliente (con tu base de datos local)
Con el servidor corriendo en el puerto 8000, instala [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) y ejecuta:
```bash
cloudflared tunnel --url http://localhost:8000
```
Te entrega una URL `https://…trycloudflare.com` pública. Tu computador debe seguir encendido y con el servidor corriendo; la URL cambia cada vez. Alternativa: `ngrok http 8000`.

## Notas
- Cambia `MEDSHARE_SECRET` (variable de entorno) si lo publicas de verdad.
- Boberto responde con reglas predefinidas (contingencia del RF-04), sin IA real ni diagnósticos.
- La lista de síntomas y medicamentos debe validarla la contraparte médica (acta 11/10).
- Base local en SQLite; el modelo de tablas es el del informe, migrable a PostgreSQL.
