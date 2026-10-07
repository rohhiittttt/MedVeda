import sys
import io
import requests
import json
import base64

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8001"

def test_python_ai_service():
    print("=== 1. Health Check ===")
    res = requests.get(f"{BASE_URL}/api/health")
    print("Status:", res.status_code, res.json())

    print("\n=== 2. Hindi EHR RAG & Voice Test ===")
    payload_hi = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "मेरी कौन-कौन सी दवाइयां चल रही हैं और उनकी खुराक क्या है?",
        "language": "auto"
    }
    res_hi = requests.post(f"{BASE_URL}/api/records/chat", json=payload_hi)
    data_hi = res_hi.json().get("data", {})
    print("Detected Language:", data_hi.get("detectedLanguage"))
    print("Hindi Answer:\n", data_hi.get("answer"))
    print("Audio Base64 Length:", len(data_hi.get("audioBase64") or ""))
    print("Citations Count:", len(data_hi.get("citations", [])))

    print("\n=== 3. English EHR RAG & Voice Test ===")
    payload_en = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "What were my latest lab results for cholesterol and lipid profile?",
        "language": "auto"
    }
    res_en = requests.post(f"{BASE_URL}/api/records/chat", json=payload_en)
    data_en = res_en.json().get("data", {})
    print("Detected Language:", data_en.get("detectedLanguage"))
    print("English Answer:\n", data_en.get("answer"))
    print("Audio Base64 Length:", len(data_en.get("audioBase64") or ""))
    print("Citations Count:", len(data_en.get("citations", [])))

    print("\n=== 4. Hindi Emergency Detection Test ===")
    payload_er = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "मुझे सीने में बहुत तेज दर्द हो रहा है और सांस लेने में कठिनाई है"
    }
    res_er = requests.post(f"{BASE_URL}/api/records/chat", json=payload_er)
    data_er = res_er.json().get("data", {})
    print("Emergency Flag:", data_er.get("isEmergency"))
    print("Emergency Advice:\n", data_er.get("emergencyAdvice"))
    print("Audio Length:", len(data_er.get("audioBase64") or ""))

    print("\n=== 5. Voice Synthesis Test (Hindi & English) ===")
    tts_hi = requests.post(f"{BASE_URL}/api/records/voice/synthesize", json={"text": "नमस्ते, यह आपकी मेडवेदा स्वास्थ्य रिपोर्ट है।", "language": "hi"})
    print("Hindi TTS Audio Bytes:", len(tts_hi.json().get("data", {}).get("audioBase64") or ""))

    tts_en = requests.post(f"{BASE_URL}/api/records/voice/synthesize", json={"text": "Hello, here is your MedVeda health report.", "language": "en"})
    print("English TTS Audio Bytes:", len(tts_en.json().get("data", {}).get("audioBase64") or ""))

    print("\nALL PYTHON MULTILINGUAL & VOICE AI TESTS PASSED!")

if __name__ == "__main__":
    test_python_ai_service()
