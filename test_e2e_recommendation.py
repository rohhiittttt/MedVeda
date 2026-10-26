import sys
import os
import json
from pathlib import Path

# Fix Windows console UTF-8 output encoding
if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add python_service to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent / "python_service"))

from recommendation_engine import (
    recommendation_engine,
    RecommendationRequest,
    RecommendationEngineOutput
)

def run_e2e_test():
    print("=" * 85)
    print("SMART CARE NAVIGATOR — AGENT 3: FACILITY RECOMMENDATION & TOP 5 RANKING TEST")
    print("=" * 85)

    # 1. Load the live output from Agent 2 (neuro_hospital_search_output.json)
    search_file = Path("neuro_hospital_search_output.json")
    if not search_file.exists():
        print("ERROR: neuro_hospital_search_output.json not found!")
        return

    with open(search_file, "r", encoding="utf-8") as f:
        hospital_search_output = json.load(f)

    # 2. Simulated Phase 4 Output from Agent 1 (symptomsIntake.md)
    phase4_intake = {
        "session_id": hospital_search_output.get("session_id", "session_stroke_test"),
        "primary_suspected_condition": "Acute Ischemic Stroke (Left MCA Occlusion)",
        "required_department": "Neurology",
        "alternate_departments": ["Neurosurgery", "Emergency Medicine"],
        "care_setting": "emergency",
        "is_emergency": True,
        "severity": "critical",
        "red_flags_detected": ["acute hemiplegia", "aphasia", "onset < 3.5 hrs"]
    }

    print("\n[Step 1] Ingesting Upstream Diagnostic Contract (Agent 1 Phase4Output):")
    print(f"  * Suspected Condition: {phase4_intake['primary_suspected_condition']}")
    print(f"  * Required Department: {phase4_intake['required_department']}")
    print(f"  * Care Setting: {phase4_intake['care_setting']} (is_emergency={phase4_intake['is_emergency']})")
    print(f"  * Severity: {phase4_intake['severity']}")

    print("\n[Step 2] Ingesting Discovered Hospital Universe (Agent 2 HospitalSearchOutput):")
    total_candidates = len(hospital_search_output.get("hospitals", []))
    radius = hospital_search_output.get("search_radius_km", 50)
    print(f"  * Total Hospitals Discovered within {radius} km: {total_candidates}")

    # 3. Formulate Recommendation Request
    req = RecommendationRequest(
        session_id=phase4_intake["session_id"],
        phase4_intake=phase4_intake,
        hospital_search_output=hospital_search_output
    )

    print("\n[Step 3] Executing Independent Prompt Department Audits & Multi-Criteria Scoring...")
    print("  * Prompt: 'Is the Neurology present in the {hospital} for emergency care setting as patient in critical condition? Answer: Yes, No, or Unknown.'")
    print("  * Temperature: 0.0 (Deterministic)")
    print("  * Parameter Weights: Dept = 45 pts (Highest), Booster = +15 pts, Acuity = 25 pts, Distance = 20 pts, Op = 10 pts")

    output: RecommendationEngineOutput = recommendation_engine.rank_top_5_hospitals(req)

    print("\n[Step 4] Execution Complete! Summary Scorecard:")
    print(f"  * Total Candidates Evaluated: {output.total_candidates_evaluated}")
    print(f"  * Top Ranked Hospitals Count: {len(output.top_5_hospitals)}")
    print(f"  * Advisory: {output.routing_advisory_note}")

    print("\n[Step 5] Top 5 Ranked Hospitals Breakdown:")
    print("-" * 85)
    for h in output.top_5_hospitals:
        audit = h.prompt_department_audit
        scores = h.score_breakdown
        print(f"Rank {h.rank}: {h.name}")
        print(f"  Distance: {h.distance_display} (~{h.estimated_drive_time_mins} mins drive) | City: {h.city_district} | Phone: {h.contact_number}")
        print(f"  Badge: {h.recommendation_badge}")
        print(f"  Prompt Audit: \"{audit.normalized_answer}\" (raw: '{audit.raw_answer}')")
        print(f"  Score Breakdown: Dept={scores.department_presence_score}/45 | Booster=+{scores.verification_booster} | Acuity={scores.care_acuity_score}/25 | Dist={scores.distance_decay_score}/20 | Op={scores.operational_score}/10")
        print(f"  TOTAL COMPOSITE SCORE: {scores.composite_score} / 100")
        print(f"  Clinical Rationale: {h.clinical_routing_rationale}")
        print(f"  Transit Guidance: {h.transit_guidance}")
        print(f"  Direct Actions: Call -> {h.direct_call_url} | Maps -> {h.google_maps_url}")
        print("-" * 85)

    # 4. Invariant Checks
    assert len(output.top_5_hospitals) <= 5, "Must select at most 5 hospitals!"
    rank1 = output.top_5_hospitals[0]
    assert rank1.recommendation_badge == "TOP_RECOMMENDED_EMERGENCY", "Rank 1 must be TOP_RECOMMENDED_EMERGENCY for critical emergency!"
    assert rank1.prompt_department_audit.normalized_answer == "Yes", "Rank 1 must have confirmed department!"
    for h in output.top_5_hospitals:
        assert h.distance_km <= 60.0, f"Hospital {h.name} exceeds locked radius: {h.distance_km} km!"

    print("\n[VERIFICATION PASSED] All Clinical Invariants and Scoring Rules Verified!")

    # Save output contract
    out_dict = output.model_dump()
    with open("top5_recommendations_output.json", "w", encoding="utf-8") as f:
        json.dump(out_dict, f, indent=2, ensure_ascii=False)
    print("Full output written to top5_recommendations_output.json")

if __name__ == "__main__":
    run_e2e_test()
