# -*- coding: utf-8 -*-
"""
End-to-End Verification Suite for Standalone Medical AI Assistant Agent (Feature 10).
Tests Python AI & Voice engine directly and via Node.js proxy on port 3000.
"""
import urllib.request
import json
import base64
import sys

BASE_URL = "http://localhost:3000"
PY_URL = "http://127.0.0.1:8001"

def test_request(endpoint, method="GET", body=None, host=BASE_URL):
    url = f"{host}{endpoint}"
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}
    except Exception as e:
        return 500, {"error": str(e)}

def run_tests():
    passed = 0
    total = 0

    print("==================================================")
    print("MEDVEDA STANDALONE MEDICAL AI ASSISTANT AGENT TESTS")
    print("==================================================")

    # Test 1: Doctor Roster Database
    total += 1
    print("\n[TEST 1] Doctors Roster via Node Proxy (GET /api/agent/doctors)...")
    code, res = test_request("/api/agent/doctors")
    if code == 200 and res.get("success") and len(res.get("data", [])) >= 5:
        print(f"  PASS: Retrieved {len(res['data'])} specialist doctors. Example: {res['data'][0]['name']}")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 2: Facilities Database
    total += 1
    print("\n[TEST 2] Facilities Database via Node Proxy (GET /api/agent/facilities)...")
    code, res = test_request("/api/agent/facilities")
    if code == 200 and res.get("success") and len(res.get("data", [])) >= 4:
        print(f"  PASS: Retrieved {len(res['data'])} district facilities. Example: {res['data'][0]['name']} ({res['data'][0]['emergencyBeds']} beds)")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 3: Doctor Booking Proposal & Confirmation Card (English)
    total += 1
    print("\n[TEST 3] Doctor Booking Proposal - English (POST /api/agent/chat)...")
    code, res = test_request("/api/agent/chat", "POST", {
        "query": "I want to book an appointment with Dr. Rajesh Verma (Cardiologist)",
        "language": "en",
        "patientId": "PAT-2026-1024"
    })
    data = res.get("data", {})
    action_cards = data.get("actionCards", [])
    has_confirm_card = any(c.get("type") == "CONFIRMATION_CARD" for c in action_cards)
    if code == 200 and res.get("success") and has_confirm_card:
        print("  PASS: Proposal Confirmation Card generated for Dr. Rajesh Verma.")
        print(f"  Answer Preview: {data.get('answer')[:80]}...")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 4: Multilingual Hindi Booking Proposal & Voice Synthesis (Devanagari)
    total += 1
    print("\n[TEST 4] Multilingual Hindi Booking Proposal & Voice Synthesis (POST /api/agent/chat)...")
    code, res = test_request("/api/agent/chat", "POST", {
        "query": "डॉ. प्रिया शर्मा से न्यूरोलॉजी का अपॉइंटमेंट बुक करें",
        "language": "hi",
        "patientId": "PAT-2026-1024"
    })
    data = res.get("data", {})
    has_audio = bool(data.get("audioBase64"))
    has_hi = data.get("detectedLanguage") == "hi"
    if code == 200 and res.get("success") and has_audio and has_hi:
        audio_len = len(data.get("audioBase64", ""))
        print(f"  PASS: Hindi response with Devanagari text & MP3 voice audio ({audio_len} chars base64).")
        safe_preview = data.get('answer', '')[:90].encode('ascii', errors='replace').decode('ascii')
        print(f"  Hindi Text Preview: {safe_preview}...")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 5: Human-in-the-Loop Booking Execution (POST /api/agent/action/execute)
    total += 1
    print("\n[TEST 5] Human-in-the-Loop Action Execution (POST /api/agent/action/execute)...")
    code, res = test_request("/api/agent/action/execute", "POST", {
        "actionType": "CONFIRM_BOOKING",
        "patientId": "PAT-2026-1024",
        "params": {
            "doctorId": "doc_2",
            "slotTime": "Tomorrow 10:00 AM",
            "patientName": "Ramesh Mahto",
            "urgencyTier": "ROUTINE",
            "mode": "teleconsult"
        },
        "language": "en"
    })
    data = res.get("data", {})
    apt = data.get("appointment", {})
    if code == 200 and res.get("success") and apt.get("id"):
        print(f"  PASS: Booking executed atomically! ID: {apt.get('id')} with {apt.get('doctorName')}")
        print(f"  Simulated SMS: {data.get('smsNotification', {}).get('text')}")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 6: Cross-Feature Appointment Synchronization
    total += 1
    print("\n[TEST 6] Cross-Feature Appointment Sync (GET /api/agent/appointments)...")
    code, res = test_request("/api/agent/appointments?patient_id=PAT-2026-1024")
    if code == 200 and res.get("success") and len(res.get("data", [])) >= 1:
        print(f"  PASS: Verified {len(res['data'])} active appointment(s) in patient store.")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 7: Emergency Red-Flag Guardrail (108 Emergency Ambulance Bypass)
    total += 1
    print("\n[TEST 7] Emergency Red-Flag Triage Guardrail (POST /api/agent/chat)...")
    code, res = test_request("/api/agent/chat", "POST", {
        "query": "I am experiencing severe crushing chest pain radiating to left arm with cold sweats",
        "language": "en",
        "patientId": "PAT-2026-1024"
    })
    data = res.get("data", {})
    is_red = data.get("urgencyLevel") == "RED"
    cards = data.get("actionCards", [])
    has_emergency_card = any(c.get("type") in ["EMERGENCY_ACTIONS", "URGENCY_ALERT"] for c in cards)
    if code == 200 and res.get("success") and is_red and has_emergency_card:
        print("  PASS: RED Urgency level triggered with 108 Emergency bypass.")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Urgency: {data.get('urgencyLevel')}")

    # Test 8: G-HON Guardrail (Out of Bounds Refusal)
    total += 1
    print("\n[TEST 8] G-HON Out of Bounds Refusal Guardrail (POST /api/agent/chat)...")
    code, res = test_request("/api/agent/chat", "POST", {
        "query": "Order a pizza for delivery and transfer money to my friend",
        "language": "en",
        "patientId": "PAT-2026-1024"
    })
    data = res.get("data", {})
    cards = data.get("actionCards", [])
    has_refusal_card = any(c.get("type") in ["CAPABILITY_FALLBACK", "OUT_OF_SCOPE_REFUSAL"] for c in cards)
    if code == 200 and res.get("success") and has_refusal_card:
        print("  PASS: G-HON triggered: refused external action and offered MedVeda healthcare alternatives.")
        passed += 1
    else:
        safe_msg = str(res).encode('ascii', errors='replace').decode('ascii')
        print(f"  FAIL: Status {code}, Response: {safe_msg[:120]}")

    # Test 9: Navigation Action Generation
    total += 1
    print("\n[TEST 9] Autonomous Navigation Command (POST /api/agent/chat)...")
    code, res = test_request("/api/agent/chat", "POST", {
        "query": "Take me to Feature 06 medicine stock",
        "language": "en",
        "patientId": "PAT-2026-1024"
    })
    data = res.get("data", {})
    cards = data.get("actionCards", [])
    has_nav = any(c.get("type") == "NAVIGATE_ACTION" for c in cards)
    if code == 200 and res.get("success") and has_nav:
        print("  PASS: Generated NAVIGATE_ACTION card pointing to Feature 06.")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    # Test 10: Medicine Dosage Reminder Proposal & Execution
    total += 1
    print("\n[TEST 10] Medicine Dosage Reminder Action (POST /api/agent/action/execute)...")
    code, res = test_request("/api/agent/action/execute", "POST", {
        "actionType": "SET_REMINDER",
        "patientId": "PAT-2026-1024",
        "params": {
            "medicineName": "Telmisartan 40mg",
            "dosage": "1 tablet",
            "time": "08:00 AM",
            "instruction": "After breakfast"
        },
        "language": "en"
    })
    data = res.get("data", {})
    rem = data.get("reminder", {})
    if code == 200 and res.get("success") and rem.get("id"):
        print(f"  PASS: Medicine reminder active! ID: {rem.get('id')} for {rem.get('medicineName')} at {rem.get('time')}")
        passed += 1
    else:
        print(f"  FAIL: Status {code}, Response: {res}")

    print("\n==================================================")
    print(f"RESULTS: {passed}/{total} TESTS PASSED")
    print("==================================================")
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
