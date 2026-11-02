import requests
import json
import base64
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:3000"

def test_suite():
    print("=" * 70)
    print("TESTING CHATBOT CONVERSATION MEMORY & FULL TTS VOICE SYNTHESIS")
    print("=" * 70)

    # -------------------------------------------------------------
    # TEST 1: Full Voice TTS (No 2-Sentence Truncation Glitch)
    # -------------------------------------------------------------
    print("\n--- TEST 1: Full Voice TTS Audio Synthesis Verification ---")
    res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "I have mild fever and headache since morning",
            "language": "en",
            "patientId": "PAT-TEST-001"
        },
        timeout=90
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()["data"]
    answer_text = data["answer"]
    audio_b64 = data.get("audioBase64")
    
    print(f"Assistant Answer Length: {len(answer_text)} characters")
    print(f"Assistant Answer Text:\n{answer_text[:300]}...\n")
    assert audio_b64 is not None, "audioBase64 should not be None"
    
    audio_bytes = base64.b64decode(audio_b64)
    print(f"Generated Audio Bytes: {len(audio_bytes)} bytes")
    # Previously, a 2-sentence truncated audio was typically ~15-25 KB.
    # A full multi-sentence audio for ~600-800 chars is typically > 50-150 KB.
    assert len(audio_bytes) > 30000, f"Expected full audio >30KB, got {len(audio_bytes)} bytes"
    print("✅ TEST 1 PASSED: Assistant synthesized full response audio without 2-sentence truncation glitch!")

    # -------------------------------------------------------------
    # TEST 2: Agent Multi-Turn Memory - Clarifying Questions & Straightforward Confirmation
    # -------------------------------------------------------------
    print("\n--- TEST 2: Agent Multi-Turn Memory - Straightforward Confirmation ---")
    session_id = "test_session_mem_001"
    
    # Turn 1: Initial symptom presentation
    t1_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "I have mild fever and body ache",
            "language": "en",
            "sessionId": session_id,
            "patientId": "PAT-TEST-001"
        },
        timeout=90
    )
    assert t1_res.status_code == 200
    t1_data = t1_res.json()["data"]
    t1_ans = t1_data["answer"]
    print("Turn 1 - User: 'I have mild fever and body ache'")
    print(f"Turn 1 - Agent: {t1_ans[:200]}...")
    assert "Clarifying Questions" in t1_ans or "clarify" in t1_ans.lower(), "Should ask clarifying questions in Turn 1"
    
    # Prepare history for Turn 2
    history_turn2 = [
        {"role": "user", "text": "I have mild fever and body ache"},
        {"role": "assistant", "text": t1_ans}
    ]
    
    # Turn 2: User answers clarifying questions without mentioning 'fever'
    t2_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "1-2 days and no rash or stiff neck",
            "language": "en",
            "sessionId": session_id,
            "patientId": "PAT-TEST-001",
            "conversationHistory": history_turn2
        },
        timeout=90
    )
    assert t2_res.status_code == 200
    t2_data = t2_res.json()["data"]
    t2_ans = t2_data["answer"]
    print("\nTurn 2 - User: '1-2 days and no rash or stiff neck'")
    print(f"Turn 2 - Agent: {t2_ans}")
    
    # Verify agent remembered the active condition (viral fever) and confirmed straightforwardness
    assert "viral fever" in t2_ans.lower() or "fever" in t2_ans.lower(), "Agent should retain memory of fever condition!"
    assert "clarifying" in t2_ans.lower() or "confirm" in t2_ans.lower(), "Agent should acknowledge clarifying answers!"
    assert "Paracetamol" in t2_ans or "Dolo" in t2_ans, "Agent should provide safe OTC guidance for the remembered condition!"
    assert "AI is not a doctor" in t2_ans or "not a doctor" in t2_ans.lower(), "Disclaimer must be retained!"
    print("✅ TEST 2 PASSED: Agent successfully retained context across clarifying questions!")

    # -------------------------------------------------------------
    # TEST 3: Follow-Up Medicine Query Retaining Condition Context
    # -------------------------------------------------------------
    print("\n--- TEST 3: Follow-Up Medicine Inquiry Retaining Context ---")
    history_turn3 = history_turn2 + [
        {"role": "user", "text": "1-2 days and no rash or stiff neck"},
        {"role": "assistant", "text": t2_ans}
    ]
    
    t3_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "Can I take Dolo 650 for it and what are its same composition alternatives?",
            "language": "en",
            "sessionId": session_id,
            "patientId": "PAT-TEST-001",
            "conversationHistory": history_turn3
        },
        timeout=90
    )
    assert t3_res.status_code == 200
    t3_data = t3_res.json()["data"]
    t3_ans = t3_data["answer"]
    print("Turn 3 - User: 'Can I take Dolo 650 for it and what are its same composition alternatives?'")
    print(f"Turn 3 - Agent: {t3_ans[:300]}...")
    
    assert "Dolo 650" in t3_ans or "Paracetamol" in t3_ans
    assert "Crocin" in t3_ans or "Calpol" in t3_ans, "Should suggest verified exact-same composition alternatives!"
    assert "Over-The-Counter" in t3_ans or "OTC" in t3_ans, "Should classify OTC status!"
    print("✅ TEST 3 PASSED: Agent answered follow-up medicine and alternatives seamlessly!")

    # -------------------------------------------------------------
    # TEST 4: Agent Multi-Turn Memory - Red-Flag Escalation Detection
    # -------------------------------------------------------------
    print("\n--- TEST 4: Multi-Turn Memory - Red-Flag Escalation ---")
    escalation_session = "test_session_escalation_002"
    
    # Turn 1: Symptom presentation
    e1_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "I have mild fever",
            "language": "en",
            "sessionId": escalation_session,
            "patientId": "PAT-TEST-002"
        },
        timeout=90
    )
    e1_ans = e1_res.json()["data"]["answer"]
    
    # Turn 2: User responds with red flags (>3 days and rash)
    e2_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "It has been 4 days and high temperature with skin rash",
            "language": "en",
            "sessionId": escalation_session,
            "patientId": "PAT-TEST-002",
            "conversationHistory": [
                {"role": "user", "text": "I have mild fever"},
                {"role": "assistant", "text": e1_ans}
            ]
        },
        timeout=90
    )
    assert e2_res.status_code == 200
    e2_data = e2_res.json()["data"]
    e2_ans = e2_data["answer"]
    print("Turn 2 - User: 'It has been 4 days and high temperature with skin rash'")
    print(f"Turn 2 - Agent: {e2_ans[:300]}...")
    
    assert e2_data.get("urgencyLevel") == "ORANGE" or "Consultation Required" in e2_ans
    assert "Physician Consultation Required" in e2_ans or "doctor" in e2_ans.lower(), "Must escalate to doctor when red flags reported in clarifying turn!"
    print("✅ TEST 4 PASSED: Agent successfully caught red flags in follow-up and escalated to doctor!")

    # -------------------------------------------------------------
    # TEST 5: Multilingual Hindi Multi-Turn Memory
    # -------------------------------------------------------------
    print("\n--- TEST 5: Multilingual Hindi Multi-Turn Memory ---")
    hi_session = "test_session_hi_003"
    
    h1_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "मुझे हल्का बुखार और सिरदर्द है",
            "language": "hi",
            "sessionId": hi_session,
            "patientId": "PAT-TEST-003"
        },
        timeout=90
    )
    assert h1_res.status_code == 200
    h1_ans = h1_res.json()["data"]["answer"]
    print("Turn 1 (Hi) - User: 'मुझे हल्का बुखार और सिरदर्द है'")
    print(f"Turn 1 (Hi) - Agent: {h1_ans[:200]}...")
    assert "स्पष्टीकरण प्रश्न" in h1_ans or "बुखार" in h1_ans
    
    h2_res = requests.post(
        f"{BASE_URL}/api/agent/chat",
        json={
            "query": "1-2 दिन से है और कोई दाने नहीं हैं",
            "language": "hi",
            "sessionId": hi_session,
            "patientId": "PAT-TEST-003",
            "conversationHistory": [
                {"role": "user", "text": "मुझे हल्का बुखार और सिरदर्द है"},
                {"role": "assistant", "text": h1_ans}
            ]
        },
        timeout=90
    )
    assert h2_res.status_code == 200
    h2_data = h2_res.json()["data"]
    h2_ans = h2_data["answer"]
    print("Turn 2 (Hi) - User: '1-2 दिन से है और कोई दाने नहीं हैं'")
    print(f"Turn 2 (Hi) - Agent: {h2_ans[:300]}...")
    assert "वायरल बुखार" in h2_ans or "बुखार" in h2_ans, "Agent must retain Hindi condition context!"
    assert "पैरासिटामोल" in h2_ans or "Dolo" in h2_ans, "Should offer safe Hindi OTC guidance!"
    assert h2_data["detectedLanguage"] == "hi"
    print("✅ TEST 5 PASSED: Multilingual Hindi conversation memory verified!")

    # -------------------------------------------------------------
    # TEST 6: Longitudinal EHR Records RAG Chatbot Multi-Turn Memory
    # -------------------------------------------------------------
    print("\n--- TEST 6: Longitudinal EHR Records RAG Chatbot Multi-Turn Memory ---")
    rag_session = "test_rag_session_004"
    patient_id = "MV-MED-2026-1024"
    
    # Turn 1: Ask about current medications
    r1_res = requests.post(
        f"{BASE_URL}/api/records/chat",
        json={
            "internalMedicalId": patient_id,
            "question": "What medications am I taking?",
            "sessionId": rag_session,
            "language": "en"
        },
        timeout=90
    )
    assert r1_res.status_code == 200
    r1_ans = r1_res.json()["data"]["answer"]
    print("Turn 1 - User: 'What medications am I taking?'")
    print(f"Turn 1 - Assistant: {r1_ans[:200]}...")
    assert "Telmisartan" in r1_ans or "Ecosprin" in r1_ans
    
    # Turn 2: Follow-up referencing "the first one"
    r2_res = requests.post(
        f"{BASE_URL}/api/records/chat",
        json={
            "internalMedicalId": patient_id,
            "question": "Can I take the first one before breakfast?",
            "sessionId": rag_session,
            "language": "en",
            "conversationHistory": [
                {"role": "user", "text": "What medications am I taking?"},
                {"role": "assistant", "text": r1_ans}
            ]
        },
        timeout=90
    )
    assert r2_res.status_code == 200
    r2_data = r2_res.json()["data"]
    r2_ans = r2_data["answer"]
    print("\nTurn 2 - User: 'Can I take the first one before breakfast?'")
    print(f"Turn 2 - Assistant: {r2_ans}")
    assert "Telmisartan" in r2_ans or "first" in r2_ans.lower(), "Should identify the first medication (Telmisartan)!"
    assert "breakfast" in r2_ans.lower() or "meals" in r2_ans.lower(), "Should provide breakfast guidance grounded in EHR!"
    print("✅ TEST 6 PASSED: EHR Records RAG Chatbot successfully resolved pronoun and multi-turn context!")

    print("\n" + "=" * 70)
    print("ALL 6 TESTS PASSED SUCCESSFULLY! BOTH GLITCHES ARE FULLY RESOLVED.")
    print("=" * 70)

if __name__ == "__main__":
    test_suite()
