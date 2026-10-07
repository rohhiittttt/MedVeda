"""
Comprehensive End-to-End Verification Suite for MedVeda Multilingual & Voice AI System
Tests Python Microservice (Port 8001) and Node Proxy (Port 3000)
"""

import sys
import json
import base64
import requests

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

PY_URL = "http://127.0.0.1:8001"
NODE_URL = "http://localhost:3000"

def run_test(name, func):
    print(f"\n==========================================", flush=True)
    print(f"RUNNING: {name}", flush=True)
    print(f"==========================================", flush=True)
    try:
        func()
        print(f"✅ PASSED: {name}", flush=True)
        return True
    except Exception as e:
        print(f"❌ FAILED: {name} -> {e}", flush=True)
        return False

def test_health():
    res = requests.get(f"{PY_URL}/api/health", timeout=10)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert data["status"] == "healthy"
    assert "hi" in data["languagesSupported"] and "en" in data["languagesSupported"]
    print("Health check data:", data, flush=True)

def test_hindi_rag_and_voice():
    payload = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "मेरी कौन सी दवाइयाँ चल रही हैं और कब खानी हैं?",
        "language": "hi"
    }
    res = requests.post(f"{NODE_URL}/api/records/chat", json=payload, timeout=60)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    body = res.json()
    assert body.get("success") is True, f"Success is false: {body}"
    data = body["data"]
    assert data["detectedLanguage"] == "hi", f"Expected 'hi', got {data['detectedLanguage']}"
    assert len(data.get("audioBase64", "")) > 5000, "Audio base64 was too small or missing"
    assert "दवा" in data["answer"] or "खुराक" in data["answer"] or "इकोस्प्रिन" in data["answer"] or "टेल्मीसार्टन" in data["answer"]
    print(f"Detected Lang: {data['detectedLanguage']}", flush=True)
    print(f"Audio size: {len(data['audioBase64'])} bytes", flush=True)
    print(f"Answer excerpt: {data['answer'][:150]}...", flush=True)

def test_english_rag_and_voice():
    payload = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "What medications am I taking and what are the doses?",
        "language": "en"
    }
    res = requests.post(f"{NODE_URL}/api/records/chat", json=payload, timeout=60)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    body = res.json()
    assert body.get("success") is True
    data = body["data"]
    assert data["detectedLanguage"] == "en", f"Expected 'en', got {data['detectedLanguage']}"
    assert len(data.get("audioBase64", "")) > 10000, "Audio base64 missing"
    assert "medication" in data["answer"].lower() or "mg" in data["answer"].lower()
    print(f"Detected Lang: {data['detectedLanguage']}")
    print(f"Audio size: {len(data['audioBase64'])} bytes")
    print(f"Answer excerpt: {data['answer'][:150]}...")

def test_emergency_hindi_bypass():
    payload = {
        "internalMedicalId": "MV-MED-2026-1024",
        "question": "मुझे सीने में बहुत तेज दर्द हो रहा है और बाएँ कंधे में दर्द जा रहा है",
        "language": "auto"
    }
    res = requests.post(f"{NODE_URL}/api/records/chat", json=payload, timeout=20)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["isEmergency"] is True, "Emergency was not detected"
    assert data["detectedLanguage"] == "hi"
    assert "108" in data["answer"] or "112" in data["answer"]
    assert len(data["audioBase64"]) > 10000
    print("Emergency Hindi response successfully triggered immediate 108/112 protocol & voice audio!")

def test_voice_synthesize_endpoint():
    payload = {
        "text": "नमस्ते, आपका स्वास्थ्य रिकॉर्ड पूरी तरह से सुरक्षित है।",
        "language": "hi"
    }
    res = requests.post(f"{NODE_URL}/api/records/voice/synthesize", json=payload, timeout=15)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["mimeType"] == "audio/mp3"
    assert data["language"] == "hi"
    assert len(data["audioBase64"]) > 5000
    print(f"Synthesized Hindi MP3 speech: {len(data['audioBase64'])} bytes")

if __name__ == "__main__":
    tests = [
        ("Python Service Health Check", test_health),
        ("Hindi RAG Query + Hindi Voice Audio via Node Proxy", test_hindi_rag_and_voice),
        ("English RAG Query + English Voice Audio via Node Proxy", test_english_rag_and_voice),
        ("Hindi Emergency Bypass with 108 Audio Guidance", test_emergency_hindi_bypass),
        ("Standalone Text-to-Speech Audio Synthesis (Hindi)", test_voice_synthesize_endpoint),
    ]

    passed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1

    print(f"\n==========================================")
    print(f"TOTAL TEST RESULTS: {passed} / {len(tests)} PASSED")
    print(f"==========================================")
    if passed == len(tests):
        print("ALL MULTILINGUAL & VOICE SUITES VERIFIED SUCCESSFULLY!")
    else:
        sys.exit(1)
