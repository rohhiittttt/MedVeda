import urllib.request
import json

def test_api():
    base = "http://localhost:3000"
    print("1. Testing GET /api/schemes")
    with urllib.request.urlopen(f"{base}/api/schemes") as res:
        data = json.loads(res.read().decode())
        assert data["success"] is True
        print(f"PASS: {data['count']} schemes returned via proxy.")

    print("\n2. Testing POST /api/schemes/assess")
    payload = {
        "age": 58,
        "state": "Jharkhand",
        "district": "Hazaribagh",
        "family_income_annual": 85000,
        "occupation": "Agricultural Laborer",
        "ration_card_status": "BPL",
        "gender": "female",
        "diagnosis": "Acute Ischemic Stroke",
        "treatment_required": "Emergency Thrombectomy & ICU Hospitalization",
        "hospital_type": "government",
        "existing_documents": ["Aadhaar Card", "Ration Card"]
    }
    req = urllib.request.Request(
        f"{base}/api/schemes/assess",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        assess_data = json.loads(res.read().decode())["data"]
        assessment_id = assess_data["assessment_id"]
        recommendations = assess_data["ranked_recommendations"]
        clarifications = assess_data["pending_clarifications"]
        print(f"PASS: Assessment {assessment_id} created.")
        print(f"Top Recommendation: {recommendations[0]['scheme_name']} ({recommendations[0]['match_score_pct']}%)")
        print(f"Pending Clarifications count: {len(clarifications)}")

    if clarifications:
        q = clarifications[0]
        print(f"\n3. Testing POST /api/schemes/assessment/{assessment_id}/clarify")
        clarify_payload = {
            "question_id": q["question_id"],
            "answer": "yes"
        }
        req_clarify = urllib.request.Request(
            f"{base}/api/schemes/assessment/{assessment_id}/clarify",
            data=json.dumps(clarify_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_clarify) as res:
            clarified = json.loads(res.read().decode())["data"]
            print(f"PASS: Clarification submitted. Status: {clarified['clarification_status']}")

    print(f"\n4. Testing POST /api/schemes/assessment/{assessment_id}/explain")
    explain_payload = {
        "scheme_id": recommendations[0]["scheme_id"],
        "perspective": "why_eligible"
    }
    req_explain = urllib.request.Request(
        f"{base}/api/schemes/assessment/{assessment_id}/explain",
        data=json.dumps(explain_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_explain) as res:
        explained = json.loads(res.read().decode())["data"]
        print(f"PASS: Traceable explanation received:")
        print(f"      {explained['explanation'][:100]}...")

    print(f"\n5. Testing GET /api/admin/schemes/ingestion-log")
    with urllib.request.urlopen(f"{base}/api/admin/schemes/ingestion-log") as res:
        logs = json.loads(res.read().decode())["data"]
        print(f"PASS: {len(logs)} ingestion audit records retrieved.")

    print("\nALL END-TO-END GATEWAY INTEGRATION TESTS PASSED!")

if __name__ == "__main__":
    test_api()
