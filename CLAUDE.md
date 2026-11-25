# MedShare - Documentación del Sistema

## Descripción General

MedShare es una aplicación web diseñada para la prevención de la Lesión Renal Aguda (LRA) mediante el monitoreo continuo de pacientes. El sistema permite a pacientes y profesionales de la salud gestionar registros médicos, exámenes de laboratorio, citas médicas y comunicación en tiempo real.

## Arquitectura del Sistema

### Backend
- **Lenguaje:** Python 3.10+
- **Framework:** FastAPI
- **Base de datos:** SQLite (medshare.db)
- **Autenticación:** JWT con token de acceso y verificación 2FA
- **Estructura de archivos:**
  - `main.py`: Punto de entrada principal, rutas API y configuración
  - `chatbot.py`: Lógica del chatbot asistente (Boberto)
  - `citas.py`: Gestión de citas médicas
  - `examenes.py`: Procesamiento de exámenes de laboratorio en PDF
  - `generate_csv.py`: Generación de datos de ejemplo para el dashboard

### Frontend
- **Framework:** React con Vite
- **Estilos:** Tailwind CSS
- **Estructura de archivos:**
  - `src/pages/`: Páginas principales (Home, Dashboard, Messages, Profile, etc.)
  - `src/components/`: Componentes reutilizables
  - `src/api.js`: Cliente HTTP para llamadas API
  - `src/App.jsx`: Componente principal de la aplicación

## Funcionalidades Principales

### Para Pacientes
1. **Autenticación:** Registro e inicio de sesión con verificación 2FA
2. **Gestión de Perfil:** Datos personales, antecedentes médicos, foto de perfil
3. **Registro Diario:** Entrada de datos de salud (peso, presión arterial, micciones, etc.)
4. **Exámenes de Laboratorio:** Subida de PDFs y análisis automático de resultados
5. **Mensajes con Médico:** Chat en tiempo real para consultas médicas
6. **Recordatorios:** Sistemas de recordatorios personalizados
7. **Salud:** Visualización de datos históricos y alertas

### Para Médicos
1. **Dashboard:** Vista general de pacientes con KPIs y tendencias
2. **Mensajes con Pacientes:** Lista de pacientes, mensajes no leídos y chat individual
3. **Gestión de Exámenes:** Visualización de exámenes subidos por pacientes
4. **Citas Médicas:** Agendamiento y gestión de citas

## Estructura de la Base de Datos

### Tablas Principales
1. **users**: Usuarios del sistema (pacientes y médicos)
   - `id`: Identificador único
   - `clinical_id`: ID clínico único
   - `name`: Nombre completo
   - `role`: Rol ('patient' o 'doctor')
   - `password_hash`: Contraseña hasheada
   - `birth_date`, `weight`, `height`: Datos personales
   - `conditions`: Lista de condiciones médicas (JSON)
   - `photo`: Foto de perfil en base64

2. **patient_daily_logs**: Registros diarios de pacientes
   - `id`: Identificador único
   - `patient_id`: ID del paciente relacionado
   - `weight`, `systolic`, `diastolic`: Medidas de salud
   - `micturition_count`, `urine_amount`: Datos de micción
   - `symptoms_json`: Síntomas registrados (JSON)
   - `notes`: Notas adicionales
   - `created_at`: Fecha y hora del registro

3. **messages**: Mensajes entre usuarios
   - `id`: Identificador único
   - `sender_id`, `receiver_id`: IDs de los usuarios
   - `content`: Contenido del mensaje
   - `is_read`: Indicador de lectura (0/1)
   - `timestamp`: Fecha y hora del mensaje

4. **exams**: Exámenes de laboratorio
   - `id`: Identificador único
   - `patient_id`: ID del paciente relacionado
   - `exam_type`: Tipo de examen
   - `taken_at`: Fecha de toma de muestra
   - `uploaded_at`: Fecha de carga
   - `filename`: Nombre del archivo

5. **exam_values**: Valores individuales de exámenes
   - `id`: Identificador único
   - `exam_id`: ID del examen relacionado
   - `name`, `key`: Nombre y clave del valor
   - `value`: Valor numérico
   - `unit`: Unidad de medida
   - `ref_min`, `ref_max`: Valores de referencia

## Rutas API

### Autenticación
- `POST /api/auth/register` - Registro de nuevo usuario
- `POST /api/auth/login` - Inicio de sesión
- `POST /api/auth/2fa` - Verificación 2FA

### Perfil y Configuración
- `GET /api/me` - Obtener información del usuario actual
- `PUT /api/me/profile` - Actualizar perfil
- `PUT /api/me/photo` - Actualizar foto de perfil
- `POST /api/me/password` - Cambiar contraseña

### Registro Diario
- `POST /api/logs` - Agregar registro diario
- `GET /api/logs` - Listar registros diarios

### Mensajes
- `GET /api/messages` - Obtener mensajes con el médico
- `POST /api/messages` - Enviar mensaje al médico
- `GET /api/messages/unread` - Contar mensajes no leídos

### Exámenes de Laboratorio
- `POST /api/exams` - Subir examen PDF
- `GET /api/exams` - Listar exámenes del paciente
- `GET /api/exams/{id}` - Detalle de examen
- `GET /api/exams/{id}/comparison` - Comparación con examen anterior
- `DELETE /api/exams/{id}` - Eliminar examen

### Citas Médicas
- `GET /api/appointments/availability` - Disponibilidad de citas
- `GET /api/appointments` - Listar citas del paciente
- `POST /api/appointments` - Agendar cita
- `DELETE /api/appointments/{id}` - Cancelar cita

### Dashboard Médico
- `GET /api/dashboard` - Vista general para médicos

## Componentes Clave del Frontend

### Boberto (Chatbot)
- **Funcionalidad:** Asistente virtual con respuestas predefinidas
- **Reglas de respuesta:** 
  - Diagnósticos y recetas: "No puedo diagnosticar ni recetar"
  - Exámenes de laboratorio: Explicación automática de resultados
  - Medicamentos de riesgo: Advertencias sobre ibuprofeno, naproxeno, etc.
  - Citas médicas: Información sobre agendamiento
  - Hidratación: Consejos sobre hidratación renal

### Componentes Reutilizables
- `ChatBox.jsx`: Componente de chat para mensajes
- `Avatar.jsx`: Muestra avatares de usuarios
- `CountUp.jsx`: Animaciones de conteo
- `Layout.jsx`: Estructura general de la aplicación

## Configuración y Ejecución

### Requisitos
- Python 3.10+
- Node.js 18+

### Ejecución en Modo Producción
```bash
# Compilar frontend
cd frontend
npm install
npm run build

# Levantar backend
cd ../backend
python -m venv .venv
.venv\Scripts\activate  # Windows (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Modo Desarrollo
```bash
# Terminal 1: Backend con recarga en vivo
cd backend
uvicorn main:app --reload

# Terminal 2: Frontend con recarga en vivo
cd frontend
npm run dev
```

## Usuarios de Demostración

| Rol | ID clínico | Contraseña |
|---|---|---|
| Paciente | PAC-001 | demo1234 |
| Médico (dashboard) | DOC-001 | doctor123 |

**Código 2FA:** 123456

## Características de Seguridad

- Contraseñas hasheadas con PBKDF2
- Tokens JWT para autenticación
- Verificación 2FA simulada (para demostración)
- Validación de datos en el backend
- Protección contra inyección SQL

## Notas Importantes

1. **Boberto:** Responde con reglas predefinidas como contigencia del RF-04; no emite diagnósticos reales.
2. **Formato PDF:** Solo acepta PDFs con texto legible (no fotos ni escaneos).
3. **Base de datos:** Se crea automáticamente en SQLite con datos de ejemplo.
4. **Migración:** El modelo de base de datos es compatible con PostgreSQL.

## Archivos de Datos

- `data/pacientes.csv`: Archivo CSV con datos de pacientes para el dashboard
- `medshare.db`: Base de datos SQLite con todos los datos del sistema