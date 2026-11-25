"""Pruebas para la detección de fechas en el chatbot."""
import re
from datetime import datetime, timedelta
from chatbot import extract_dates

def test_extract_dates():
    """Prueba la extracción de fechas del texto."""

    # Prueba con fechas específicas
    text1 = "Quiero una cita el 15/06/2024"
    dates1 = extract_dates(text1)
    assert len(dates1) == 1
    assert dates1[0].year == 2024
    assert dates1[0].month == 6
    assert dates1[0].day == 15

    # Prueba con día de la semana
    text2 = "Quiero una cita el viernes"
    dates2 = extract_dates(text2)
    assert len(dates2) >= 1  # Debe encontrar un viernes

    # Prueba con palabras clave
    text3 = "Quiero una cita mañana"
    dates3 = extract_dates(text3)
    assert len(dates3) == 1
    tomorrow = (datetime.now() + timedelta(days=1)).date()
    assert dates3[0] == tomorrow

    # Prueba con múltiples fechas
    text4 = "Tengo citas el lunes y el viernes"
    dates4 = extract_dates(text4)
    assert len(dates4) >= 2

    print("Todas las pruebas de extracción de fechas pasaron")

if __name__ == "__main__":
    test_extract_dates()
    print("Todas las pruebas pasaron exitosamente")