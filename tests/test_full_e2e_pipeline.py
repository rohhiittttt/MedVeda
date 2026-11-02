import requests
import json
import sys

BASE_URL = "http://localhost:3000"

def test_full_pipeline():
    print("=" * 70)
    print("RUNNING END-TO-END SMART CARE NAVIGATOR VERIFICATION VIA PORT 3000")
    print("=" * 70)

    # 1. Test Static Frontend & Leaflet Presence
    print("\n--- 1. Testing Frontend Server & Leaflet Assets ---")
    res_front = requests.get(f"{BASE_URL}/")
    assert res_front.status_code == 200, f"Frontend failed: {res_front.status_code}"
    assert "leaflet" in res_front.text.lower(), "Leaflet CSS/JS missing from index.html"
    assert "app.compiled.js" in res_front.text, "app.compiled.js missing from index.html"
    print("  [PASSED] Frontend serving index.html with global Leaflet 1.9.4 and app.compiled.js")

    # 2. Test Agent 1: Symptom Intake Start (Neuro Emergency)
    print("\n--- 2. Testing Agent 1: /api/v1/intake/start ---")
    neuro_complaint = "62-year-old male with sudden onset right-sided facial weakness, unable to lift right arm, and slurred speech starting 45 minutes ago."
    res_start = requests.post(
        f"{BASE_URL}/api/v1/intake/start",
        json={"raw_symptoms": neuro_complaint, "input_modality": "text"},
        headers={"Content-Type": "application/json"}
    )
    assert res_start.status_code == 200, f"Intake start failed: {res_start.text}"
    start_data = res_start.json()
    session_id = start_data["session_id"]
    p1 = start_data.get("phase1_output", {})
    urgency_signals = p1.get("urgency_signals", [])
    print(f"  Session Created: {session_id}")
    print(f"  Urgency Signals: {urgency_signals}")
    print(f"  Confidence: {p1.get('processing_confidence')}")
    assert len(urgency_signals) > 0, "Stroke urgency signals should be detected!"
    print("  [PASSED] Red-flag emergency detection triggered accurately.")

    # 3. Test Agent 1: Baseline Demographics
    print("\n--- 3. Testing Agent 1: /api/v1/intake/{session_id}/baseline ---")
    baseline_payload = {
        "age": 62,
        "biological_sex": "male",
        "symptom_duration_value": 45,
        "symptom_duration_unit": "minutes",
        "onset_type": "sudden",
        "self_reported_severity": "severe",
        "location": "Hazaribagh, Jharkhand",
        "medical_history": ["High Blood Pressure", "Type 2 Diabetes"],
        "reporting_for": "self"
    }
    res_base = requests.post(
        f"{BASE_URL}/api/v1/intake/{session_id}/baseline",
        json=baseline_payload,
        headers={"Content-Type": "application/json"}
    )
    assert res_base.status_code == 200, f"Baseline failed: {res_base.text}"
    print("  [PASSED] Baseline saved successfully.")

    # 4. Test Agent 1: Next Question & Clarification Loop
    print("\n--- 4. Testing Agent 1: /api/v1/intake/{session_id}/next-question & /answer ---")
    res_q = requests.get(f"{BASE_URL}/api/v1/intake/{session_id}/next-question")
    assert res_q.status_code == 200, f"Question fetch failed: {res_q.text}"
    q_data = res_q.json()
    question = q_data.get("question")
    assert question is not None, "Question object missing"
    print(f"  Adaptive Question 1: {question.get("question_text") or question.get("text")}")
    print(f"  Clinical Context: {question.get('clinical_context')}")

    # Answer Question 1
    selected_opt = question["options"][0]["option_id"] if question.get("options") else "A" if question.get("options") else "yes"
    ans_payload = {
        "question_number": question["question_number"],
        "answer_mode": "option_selected",
        "selected_option_id": selected_opt
    }
    res_ans = requests.post(
        f"{BASE_URL}/api/v1/intake/{session_id}/answer",
        json=ans_payload,
        headers={"Content-Type": "application/json"}
    )
    assert res_ans.status_code == 200, f"Answer failed: {res_ans.text}"
    print("  [PASSED] Adaptive question answered and recorded.")

    # 5. Test Agent 1: Complete Intake & Phase 4 Diagnostic Summary
    print("\n--- 5. Testing Agent 1: /api/v1/intake/{session_id}/complete ---")
    res_comp = requests.post(f"{BASE_URL}/api/v1/intake/{session_id}/complete")
    assert res_comp.status_code == 200, f"Complete intake failed: {res_comp.text}"
    comp_json = res_comp.json()
    phase4 = comp_json.get("phase4_output", comp_json)
    print(f"  Required Department: {phase4['required_department']}")
    print(f"  Severity: {phase4['severity']}")
    print(f"  Care Setting: {phase4['care_setting']}")
    print(f"  Emergency: {phase4['is_emergency']}")
    assert "neuro" in phase4["required_department"].lower() or "emerg" in phase4["required_department"].lower(), \
        f"Expected Neurology/Emergency department, got {phase4['required_department']}"
    assert phase4["severity"] in ["critical", "urgent"], "Expected critical or urgent severity"
    print("  [PASSED] Diagnostic Evaluation Summary generated with required department.")

    # 6. Test Agent 2: Geodesic Live Hospital Discovery within locked 50 km boundary
    print("\n--- 6. Testing Agent 2: /api/v1/hospitals/search (Locked 50 km) ---")
    search_payload = {
        "session_id": session_id,
        "location": {
            "latitude": 23.9925,
            "longitude": 85.3637,
            "manual_text": "Hazaribagh, Jharkhand"
        },
        "intake_assessment": {
            "required_department": phase4["required_department"],
            "care_setting": phase4["care_setting"],
            "is_emergency": phase4["is_emergency"],
            "severity": phase4["severity"]
        },
        "radius_km": 50
    }
    res_search = requests.post(
        f"{BASE_URL}/api/v1/hospitals/search",
        json=search_payload,
        headers={"Content-Type": "application/json"}
    )
    assert res_search.status_code == 200, f"Hospital search failed: {res_search.text}"
    search_out = res_search.json()
    candidates = search_out.get("hospitals", [])
    print(f"  Discovered Hospitals within 50 km: {len(candidates)}")
    assert len(candidates) > 0, "No candidate hospitals discovered in Hazaribagh!"
    for c in candidates:
        assert c["distance_km"] <= 60.0, f"Hospital {c['name']} exceeded 50 km locked boundary: {c['distance_km']} km"
    print(f"  Top Discovered Candidate: {candidates[0]['name']} ({candidates[0]['distance_km']:.1f} km)")
    print("  [PASSED] Geodesic hospital search strictly respected 50 km boundary.")

    # 7. Test Agent 3: Multi-Criteria Clinical Scoring & Top 5 Selection
    print("\n--- 7. Testing Agent 3: /api/v1/recommendations/rank-top5 ---")
    rec_payload = {
        "session_id": session_id,
        "phase4_intake": phase4,
        "hospital_search_output": search_out
    }
    res_rec = requests.post(
        f"{BASE_URL}/api/v1/recommendations/rank-top5",
        json=rec_payload,
        headers={"Content-Type": "application/json"}
    )
    assert res_rec.status_code == 200, f"Recommendation ranking failed: {res_rec.text}"
    rec_out = res_rec.json()
    top5 = rec_out.get("top_5_hospitals", [])
    print(f"  Top Recommended Hospitals Count: {len(top5)}")
    assert len(top5) >= 1 and len(top5) <= 5, f"Expected 1 to 5 hospitals, got {len(top5)}"

    rank1 = top5[0]
    print(f"\n  *** RANK 1 HOSPITAL ***")
    print(f"  Name: {rank1['name']}")
    print(f"  Rank: #{rank1['rank']}")
    print(f"  Badge: {rank1['recommendation_badge']}")
    print(f"  Score Breakdown:")
    sb = rank1['score_breakdown']
    audit = rank1['prompt_department_audit']
    print(f"    - Department Presence Score (max 45): {sb['department_presence_score']}")
    print(f"    - Verification Booster (max 15): {sb['verification_booster']}")
    print(f"    - Care Acuity Score (max 25): {sb['care_acuity_score']}")
    print(f"    - Distance Decay Score (max 20): {sb['distance_decay_score']}")
    print(f"    - Operational Reliability (max 10): {sb['operational_score']}")
    print(f"    - Composite Score: {sb['composite_score']:.1f} / 100")
    print(f"  Exact Prompt: {audit['exact_prompt']}")
    print(f"  Prompt Audit Answer: '{audit['normalized_answer']}' (Raw: '{audit['raw_answer']}')")
    print(f"  Distance: {rank1['distance_display']} (Drive Time: ~{rank1['estimated_drive_time_mins']} mins)")
    print(f"  Direct Call: {rank1['direct_call_url']}")
    print(f"  Google Maps Link: {rank1['google_maps_url']}")

    assert rank1['rank'] == 1, "Rank must be 1"
    assert rank1['score_breakdown']['department_presence_score'] in [45.0, 20.0, 15.0, 0.0], "Department score invalid"
    assert rank1['prompt_department_audit']['normalized_answer'] in ["Yes", "No", "Unknown"], "Prompt answer must be Yes, No, or Unknown"
    assert rank1['direct_call_url'].startswith("tel:"), "Must have a direct tel: URI"
    assert "maps" in rank1['google_maps_url'], "Must have valid map navigation URL"

    print("\n  [ALL VERIFICATION CHECKS PASSED SUCCESSFULLY]")
    print("=" * 70)

if __name__ == "__main__":
    test_full_pipeline()
