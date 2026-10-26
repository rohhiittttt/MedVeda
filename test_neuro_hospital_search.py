"""
Test & Verification Suite for Smart Care Navigator — Agent 2: Live Hospital Search Engine
Specialty: NEUROLOGY / NEUROSURGERY (Emergency Case)
Strict 50 km Radius Lock (Max expansion +10 km to +15 km only; NO 100 km expansion)
Includes Hazaribagh Main Hospitals (Arogyam Superspeciality, Sheikh Bhikhari MCH, Sadar Hospital, Raj Hospital, etc.)
Active vs Dummy Verification
"""

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

from hospital_search_engine import (
    hospital_engine,
    HospitalSearchRequest,
    LocationInput,
    IntakeAssessmentInput,
    HospitalSearchOutput,
    DEFAULT_RADIUS_KM,
    MAX_ALLOWED_RADIUS_KM
)

def run_neuro_test():
    print("=" * 85)
    print("SMART CARE NAVIGATOR — AGENT 2: 50 KM LOCKED EMERGENCY NEUROLOGY SEARCH")
    print("=" * 85)

    # Simulated Phase 4 Output from symptomsIntake.md for an Acute Stroke / Neuro-Emergency Case
    simulated_phase4_intake = {
        "session_id": "intake_neuro_stroke_8f21bc",
        "primary_suspected_condition": "Acute Ischemic Stroke (Left MCA Occlusion)",
        "suspected_conditions": [
            {
                "condition_name": "Acute Ischemic Stroke",
                "probability": 0.75,
                "reasoning": "Sudden onset right-sided hemiplegia, facial droop, and expressive aphasia within 2 hours. High NIHSS score.",
                "icd_category": "I63"
            },
            {
                "condition_name": "Intracranial Hemorrhage",
                "probability": 0.20,
                "reasoning": "Severe headache accompanied by acute focal neurological deficit in patient with hypertension.",
                "icd_category": "I61"
            }
        ],
        "required_department": "Neurology",
        "alternate_departments": ["Neurosurgery", "Emergency Medicine"],
        "care_setting": "emergency",
        "is_emergency": True,
        "severity": "critical",
        "red_flags_detected": [
            "acute right-sided weakness",
            "expressive aphasia",
            "onset < 3.5 hours (within therapeutic window)"
        ]
    }

    print("\n[Step 1] Ingesting Phase 4 Diagnostic Contract from symptomsIntake.md:")
    print(json.dumps(simulated_phase4_intake, indent=2))

    # Patient GPS Location: Hazaribagh (23.9925, 85.3637)
    location_payload = LocationInput(
        latitude=23.9925,
        longitude=85.3637,
        manual_text="Hazaribagh"
    )

    intake_assessment = IntakeAssessmentInput(
        required_department=simulated_phase4_intake["required_department"],
        care_setting=simulated_phase4_intake["care_setting"],
        is_emergency=simulated_phase4_intake["is_emergency"],
        severity=simulated_phase4_intake["severity"]
    )

    search_request = HospitalSearchRequest(
        session_id=simulated_phase4_intake["session_id"],
        location=location_payload,
        intake_assessment=intake_assessment,
        radius_km=50  # STRICT 50 KM LOCK
    )

    print("\n[Step 2] Executing Live Search & Deterministic Clinical Audit (temperature: 0.0)...")
    print(f"  * Radius LOCKED to: {DEFAULT_RADIUS_KM} km (Max expansion cap: {MAX_ALLOWED_RADIUS_KM} km, ZERO 100km expansion)")
    print("  * Resolving live location via OpenStreetMap Nominatim...")
    print("  * Capturing ALL top Hazaribagh hospitals (Arogyam Superspeciality, SBMCH, Sadar, Raj, etc.)...")
    print("  * Verifying Active & Working Status vs Dummy/Defunct Listings...")
    print("  * Auditing 24x7 Stroke Code, ICU/CCU, and Neuro emergency capability at temp=0.0...")

    output: HospitalSearchOutput = hospital_engine.execute_live_search(search_request)

    print("\n[Step 3] Execution Complete! Summary Scorecard:")
    print(f"  * Total Hospitals Discovered within 50 km: {output.total_hospitals_discovered}")
    print(f"  * Suitable Emergency Neuro Hospitals Found: {output.suitable_hospitals_count}")
    print(f"  * Search Radius: {output.search_radius_km} km (Expanded: {output.radius_expanded})")

    # Invariant: Distance Lock Check (ALL hospitals must be <= search_radius_km, and search_radius_km <= 60 km)
    out_of_bounds = [h for h in output.hospitals if h.distance_km > output.search_radius_km]
    if out_of_bounds or output.search_radius_km > MAX_ALLOWED_RADIUS_KM:
        print(f"  ❌ [FAIL] Radius Lock VIOLATED! Radius is {output.search_radius_km} km, {len(out_of_bounds)} hospitals exceed radius.")
    else:
        print(f"  ✅ [PASS] Radius Lock Enforced: All hospitals strictly within {output.search_radius_km} km (No 100km extension).")

    # Invariant INV-01: No OPD_ONLY facility can be marked as emergency match
    opd_violations = [
        h for h in output.hospitals
        if h.specialty_mode == "OPD_ONLY" and h.care_setting_match is True
    ]
    if opd_violations:
        print("  ❌ [FAIL] Clinical Safety Invariant INV-01 VIOLATED: OPD_ONLY facility marked as emergency match!")
    else:
        print("  ✅ [PASS] Clinical Safety Invariant INV-01: Zero OPD-only facilities routed for emergency neuro care.")

    print("\n[Step 4] Hazaribagh & Surrounding 50 km Hospitals Breakdown:")
    for idx, h in enumerate(output.hospitals, 1):
        match_badge = "✅ [MATCH - EMERGENCY NEURO]" if h.care_setting_match else "⚠️ [LOCAL STABILIZATION / OPD ONLY]"
        op_badge = "🟢 ACTIVE" if h.is_operational else "🔴 DUMMY/DEFUNCT"
        print(f"  {idx}. {h.name} ({op_badge})")
        print(f"     Distance: {h.distance_display} | City: {h.city_district} | Phone: {h.contact_number}")
        print(f"     Operational Status: {h.operational_status} | Mode: {h.specialty_mode} | Routing: {match_badge}")
        print(f"     Audit Notes: {h.verification_notes[:140]}...")
        print()

    # Save to disk
    output_dict = output.model_dump() if hasattr(output, "model_dump") else output.dict()
    output_path = Path("neuro_hospital_search_output.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_dict, f, indent=2, ensure_ascii=False)
    print(f"[Saved] Full output written to {output_path.resolve()}")

    return output

if __name__ == "__main__":
    run_neuro_test()
