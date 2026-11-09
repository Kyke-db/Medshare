"""Genera data/pacientes.csv con datos FICTICIOS para el dashboard. Ejecutar: python generate_csv.py"""
import csv, random
from datetime import date, timedelta

random.seed(7)
SINT = ["Hinchazón", "Náuseas", "Fatiga extrema", "Poca orina", "Dificultad respiratoria", "Mareos"]
hoy = date(2026, 11, 8)
rows = []
for i in range(1, 13):
    base = random.uniform(0.7, 1.1)
    sube = i in (3, 7, 10)                    # pacientes con tendencia al alza
    dias = random.randint(8, 30) if i in (5, 9) else 30   # 5 y 9: dejaron de registrar
    peso = random.uniform(58, 90)
    for d in range(dias):
        f = hoy - timedelta(days=29 - d)
        crea = round(base + (d * 0.025 if sube else 0) + random.uniform(-0.08, 0.08), 2)
        sint = random.sample(SINT, k=random.choice([0, 0, 1, 2])) if crea < 1.3 else random.sample(SINT, k=random.randint(2, 3))
        riesgo = "Alto" if crea >= 1.5 else "Medio" if crea >= 1.2 else "Bajo"
        rows.append([f"PAC-{i:03d}", f.isoformat(), round(peso + random.uniform(-.6, .6), 1),
                     random.randint(108, 145), random.randint(68, 92), random.randint(3, 8) if crea < 1.3 else random.randint(1, 4),
                     crea, ";".join(sint), riesgo])
with open("data/pacientes.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["paciente", "fecha", "peso", "presion_sis", "presion_dia", "micciones", "creatinina", "sintomas", "riesgo"])
    w.writerows(rows)
print(len(rows), "filas generadas")
