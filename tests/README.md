# MedVeda Automated Test Suites

This directory contains cross-cutting integration tests, contract verification suites, and end-to-end (E2E) test harnesses for MedVeda.

---

## Directory Contents

### 1. Python 3-Agent & Clinical AI Tests
- `test_full_e2e_pipeline.py`: Comprehensive 3-Agent journey (Intake → Search → Ranking).
- `test_symptom_intake_engine.py`: Agent 1 symptom intake, NLP entity extraction, and adaptive clarification.
- `test_hospital_search_engine.py`: Agent 2 OpenStreetMap Overpass discovery engine.
- `test_neuro_hospital_search.py`: Agent 2 emergency 50 km boundary-locked neurology search.
- `test_e2e_recommendation.py`: Agent 3 clinical ranking and facility scoring engine.
- `test_medical_assistant_agent.py`: Medibot autonomous medical assistant.
- `test_chatbot_memory_and_tts.py`: Multi-turn chat memory and Gemini TTS voice synthesis.
- `test_calibrated_features_e2e.py`: Calibrated clinical guardrails and safety invariants.
- `test_e2e_api.py`: Core system health and scheme endpoints.

### 2. Node.js & TypeScript E2E Tests
- `opd-booking-e2e.test.ts`: OPD Booking core workflow, SMS parsing, and queue management.

---

## How to Run Tests

### Running Python E2E Pipeline
```bash
python tests/test_full_e2e_pipeline.py
```

### Running Individual Agent Tests
```bash
python tests/test_symptom_intake_engine.py
python tests/test_hospital_search_engine.py
python tests/test_e2e_recommendation.py
```

### Running TypeScript Tests
```bash
node --test tests/opd-booking-e2e.test.ts
```
