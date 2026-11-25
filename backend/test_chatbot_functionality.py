"""Script para probar la funcionalidad del chatbot con detección de fechas."""
import requests
import json
from datetime import datetime

# URL del servidor (ajusta según tu configuración)
BASE_URL = "http://localhost:8000"

def test_chatbot_with_dates():
    """Prueba el chatbot con mensajes que contienen fechas."""

    # Mensajes de prueba que incluyen fechas
    test_messages = [
        {
            "messages": [
                {"role": "user", "content": "Hola, quiero una cita mañana"},
                {"role": "assistant", "content": "Hola, ¿en qué puedo ayudarte?"}
            ]
        },
        {
            "messages": [
                {"role": "user", "content": "Quiero una hora el viernes por la tarde"},
                {"role": "assistant", "content": "¿En qué puedo ayudarte?"}
            ]
        },
        {
            "messages": [
                {"role": "user", "content": "Tengo cita el lunes y el jueves"},
                {"role": "assistant", "content": "¿En qué puedo ayudarte?"}
            ]
        }
    ]

    print("=== Prueba del Chatbot con Detección de Fechas ===")

    for i, test_case in enumerate(test_messages, 1):
        try:
            response = requests.post(
                f"{BASE_URL}/api/chatbot",
                json=test_case,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                result = response.json()
                print(f"\nTest {i}:")
                print(f"Mensaje: {test_case['messages'][0]['content']}")
                print(f"Respuesta: {result.get('reply', 'Sin respuesta')}")
                print("✓ Éxito")
            else:
                print(f"\nTest {i} - Error {response.status_code}: {response.text}")

        except Exception as e:
            print(f"\nTest {i} - Error al ejecutar: {str(e)}")

    print("\n=== Prueba de funcionalidad completada ===")

def test_basic_functionality():
    """Prueba funcionalidades básicas del sistema."""

    try:
        # Probar endpoint de salud
        response = requests.get(f"{BASE_URL}/")
        print("Estado del servidor:", response.status_code)

        # Probar endpoint de usuario
        response = requests.get(f"{BASE_URL}/api/me")
        if response.status_code == 200:
            print("Usuario autenticado correctamente")
        else:
            print("Error al obtener información del usuario")

    except Exception as e:
        print(f"Error en prueba básica: {str(e)}")

if __name__ == "__main__":
    test_basic_functionality()
    test_chatbot_with_dates()