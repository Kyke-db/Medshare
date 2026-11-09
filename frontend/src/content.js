// Contenido educativo (basado en los prototipos de Figma). La contraparte médica debe validarlo.
export const ARTICLES = [
  {
    id: "que-es", title: "¿Qué es la Lesión Renal Aguda?", emoji: "🫘", read: "2 min",
    intro: "La Lesión Renal Aguda (LRA) es una disminución rápida de la función renal que puede desarrollarse en cuestión de horas o días. Los riñones pierden temporalmente la capacidad de filtrar productos de desecho y regular el agua corporal.",
    heading: "Puntos clave",
    items: [
      ["Un proceso silencioso", "En sus etapas iniciales puede no presentar síntomas evidentes."],
      ["¿Cómo se detecta?", "Principalmente mediante el aumento de la creatinina en sangre y la disminución en el volumen de orina."],
      ["Frecuencia", "Afecta a 1 de cada 5 adultos hospitalizados, pero también puede ser provocada en casa por episodios severos de deshidratación o infecciones."],
    ],
  },
  {
    id: "senales", title: "Señales de alerta: ¿cuándo buscar atención?", emoji: "⚠️", read: "2 min",
    intro: "Reconocer a tiempo los cambios físicos del cuerpo permite reaccionar antes de que exista un daño renal grave.",
    heading: "Síntomas a monitorear",
    items: [
      ["Cambios en la orina", "Disminución drástica del volumen de orina (oliguria) o ausencia total de la misma (anuria)."],
      ["Retención de líquidos", "Hinchazón (edema) notable en piernas, tobillos o rostro."],
      ["Síntomas urémicos", "Náuseas, vómitos, pérdida del apetito y debilidad general."],
      ["Dificultad para respirar", "Disnea por acumulación de líquido en los pulmones, o estado de confusión."],
    ],
  },
  {
    id: "causas", title: "Causas y factores que afectan tu riñón", emoji: "🔍", read: "2 min",
    intro: "La LRA suele ocurrir por causas clasificadas según el origen del problema:",
    heading: "Tipos de causas",
    items: [
      ["Falta de flujo sanguíneo (Prerrenal, ~60% de los casos)", "Deshidratación por vómitos, diarrea severa, calor extremo o presión arterial muy baja por infecciones."],
      ["Daño directo al tejido (Intrínseca, ~35%)", "Inflamación o daño en los filtros del riñón por infecciones graves, sepsis o sustancias nefrotóxicas."],
      ["Obstrucción (Posrenal)", "Bloqueos en las vías urinarias que impiden el paso de la orina."],
    ],
  },
  {
    id: "medicamentos", title: "Medicamentos de riesgo y salud renal", emoji: "💊", read: "2 min", warn: true,
    intro: "El uso inadvertido o la automedicación con ciertos fármacos es una de las causas más frecuentes y prevenibles de daño renal.",
    heading: "Guía de precaución",
    items: [
      ["Antiinflamatorios (AINEs)", "Ibuprofeno, naproxeno, ketorolaco y diclofenaco pueden reducir el flujo de sangre a los riñones, especialmente si estás deshidratado."],
      ["Antihipertensivos (IECAs y ARA-II)", "Enalapril, captopril, lisinopril, losartán y valsartán requieren vigilancia médica especial durante episodios de diarrea, vómito o fiebre alta."],
      ["Diuréticos", "Furosemida e hidroclorotiazida: consulta a tu médico si presentas deshidratación."],
      ["Regla de oro", "Nunca suspendas tu tratamiento por cuenta propia, pero evita la automedicación y consulta siempre a tu médico si experimentas síntomas de deshidratación."],
    ],
  },
];

export const SYMPTOMS = ["Hinchazón / Edema", "Náuseas / Vómito", "Fatiga extrema", "Poca orina", "Dificultad respiratoria", "Mareos", "Dolor de espalda baja", "Ninguno"];
export const CONDITIONS = ["Hipertensión arterial", "Diabetes", "Enfermedad renal previa", "Insuficiencia cardíaca", "Toma analgésicos o antiinflamatorios sin receta", "Toma medicamentos para la presión"];
