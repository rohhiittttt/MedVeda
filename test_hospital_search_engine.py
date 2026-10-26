"""
Test & Verification Suite for Smart Care Navigator — Agent 2: Live Hospital Search Engine
Specification: docs/featureHospitalSearch.md
Connects with symptomsIntake.md Phase 4 Diagnostic Output
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
    HospitalSearchOutput
)

def run_test():
    print("=" * 80)
    print("MEDVEDA SMART CARE NAVIGATOR — AGENT 2: LIVE HOSPITAL SEARCH ENGINE TEST")
    print("=" * 80)

    # Simulated Phase 4 Output from symptomsIntake.md
    simulated_phase4_intake = {
        "session_id": "intake_cardiac_4bc441d6",
        "primary_suspected_condition": "Unstable Angina / Acute Coronary Syndrome",
        "required_department": "Cardiology",
        "care_setting": "emergency",
        "is_emergency": True,
        "severity": "critical"
    }

    print("\n[Step 1] Ingesting Phase 4 Diagnostic Contract from symptomsIntake.md:")
    print(json.dumps(simulated_phase4_intake, indent=2))

    # Test Location: Hazaribagh (Method A: GPS / Method B: Manual)
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
        radius_km=50
    )

    print("\n[Step 2] Executing Live Hospital Search & Deterministic Clinical Audit (temperature: 0.0)...")
    print("  * Resolving live geolocation via OpenStreetMap Nominatim...")
    print("  * Discovering real hospitals in 50-100km radius...")
    print("  * Querying live clinical citations and Wikipedia medical records...")
    print("  * Running Gemini Senior Clinical Auditor prompt at temperature=0.0...")

    output: HospitalSearchOutput = hospital_engine.execute_live_search(search_request)

    print("\n[Step 3] Execution Complete! Validating Clinical Safety Invariants:")
    print(f"  * Total Hospitals Discovered: {output.total_hospitals_discovered}")
    print(f"  * Suitable Emergency Cardiac Hospitals Found: {output.suitable_hospitals_count}")
    print(f"  * Search Radius: {output.search_radius_km} km (Radius Expanded: {output.radius_expanded})")
    if output.radius_expanded:
        print(f"  * Expansion Reason: {output.expansion_reason}")

    # Check Invariant INV-01: No OPD_ONLY facility can have care_setting_match = True for an emergency patient
    opd_violations = [
        h for h in output.hospitals
        if h.specialty_mode == "OPD_ONLY" and h.care_setting_match is True
    ]
    if opd_violations:
        print("  [FAIL] Clinical Safety Invariant INV-01 VIOLATED: OPD_ONLY facility marked as emergency match!")
    else:
        print("  [PASS] Clinical Safety Invariant INV-01: Zero OPD-only facilities routed for emergency care.")

    print("\n" + "=" * 80)
    print("FINAL STRUCTURED JSON CONTRACT (READY FOR AGENT 3 RECOMMENDATIONS):")
    print("=" * 80)
    output_dict = output.dict()
    print(json.dumps(output_dict, indent=2, ensure_ascii=False))

    # Also save to disk so it can be inspected
    output_path = Path("hospital_search_output.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_dict, f, indent=2, ensure_ascii=False)
    print(f"\n[Saved] Full output written to {output_path.resolve()}")

    return output

if __name__ == "__main__":
    run_test()
