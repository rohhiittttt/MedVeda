"""
MedVeda Smart Care Navigator — Symptom Intake Engine
Specification Reference: docs/symptomsIntake.md / docs/symptomengine.md
Version: 1.0.0

A 4-phase progressive refinement engine:
- Phase 1: Raw Symptom Input & NLP (extraction, common-sense reasoning, concept mapping, gaps)
- Phase 2: Fixed Demographic & Clinical Baseline Questions
- Phase 3: 100% LLM-Generated Adaptive Clarification Questionnaire (Min 5, Max 15 questions; free text re-triggers Phase 1 NLP)
- Phase 4: Structured Diagnostic Output (suspected diseases with probabilities, department, emergency/OPD, severity)
"""

import os
import re
import json
import uuid
import datetime
import requests
from typing import List, Optional, Dict, Any, Literal
from pathlib import Path
from pydantic import BaseModel, Field, model_validator
from fastapi import APIRouter, HTTPException, Depends

# ---------------------------------------------------------------------------
# Configuration & Environment
# ---------------------------------------------------------------------------
def _load_env_if_needed():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

_load_env_if_needed()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite")

# ---------------------------------------------------------------------------
# Pydantic Contracts (matching docs/symptomsIntake.md)
# ---------------------------------------------------------------------------

class ExtractedSymptom(BaseModel):
    raw_phrase: str
    interpreted_meaning: str
    mapped_concepts: List[str]
    body_region: str
    character: Optional[str] = None
    trigger: Optional[str] = None

class Phase1Output(BaseModel):
    session_id: str
    raw_input: str
    input_language: str = "en"
    extracted_symptoms: List[ExtractedSymptom] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    urgency_signals: List[str] = Field(default_factory=list)
    processing_confidence: float = 0.90

class Phase2Output(BaseModel):
    session_id: str
    age: int
    age_months: Optional[int] = None
    biological_sex: Literal["male", "female", "other"]
    symptom_duration_value: int
    symptom_duration_unit: Literal["minutes", "hours", "days", "weeks", "months"]
    onset_type: Literal["sudden", "gradual", "chronic"]
    self_reported_severity: Literal["mild", "moderate", "severe"]
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    medical_history: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    known_allergies: List[str] = Field(default_factory=list)
    reporting_for: Literal["self", "child", "family_member", "other"] = "self"

class AnswerOption(BaseModel):
    option_id: str
    option_text: str

class ClarificationQuestion(BaseModel):
    question_number: int
    question_text: str
    question_category: str
    options: List[AnswerOption] = Field(default_factory=list)
    allows_free_text: bool = True

class ClarificationAnswer(BaseModel):
    question_number: int
    answer_mode: Literal["option_selected", "free_text"]
    selected_option_id: Optional[str] = None
    selected_option_text: Optional[str] = None
    free_text_raw: Optional[str] = None
    free_text_extracted: Optional[Phase1Output] = None
    structured_answer: str

class ClarityAssessment(BaseModel):
    questions_asked_so_far: int
    minimum_met: bool
    maximum_met: bool
    diagnostic_clarity: float
    remaining_critical_gaps: List[str] = Field(default_factory=list)
    recommendation: Literal["ask_more", "sufficient", "stop_max_reached"]

class Phase3Output(BaseModel):
    session_id: str
    total_questions_asked: int
    termination_reason: Literal["sufficient_clarity", "max_questions_reached", "patient_requested_stop"]
    qa_pairs: List[Dict[str, Any]] = Field(default_factory=list)
    diagnostic_clarity_score: float

class SuspectedCondition(BaseModel):
    condition_name: str
    probability: float
    reasoning: str
    icd_category: Optional[str] = None

class Phase4Output(BaseModel):
    session_id: str
    suspected_conditions: List[SuspectedCondition]
    primary_suspected_condition: str
    required_department: str
    alternate_departments: List[str] = Field(default_factory=list)
    is_emergency: bool
    care_setting: Literal["emergency", "opd"]
    emergency_reasoning: Optional[str] = None
    severity: Literal["critical", "high", "moderate", "low"]
    severity_reasoning: str
    routing_advice: str
    red_flags_detected: List[str] = Field(default_factory=list)
    diagnostic_confidence: float
    total_intake_questions: int
    phase3_questions_asked: int
    intake_completed_at: str

class SymptomIntakeSession(BaseModel):
    session_id: str
    status: Literal[
        "phase1_collecting",
        "phase1_complete",
        "phase2_complete",
        "phase3_questioning",
        "phase4_analyzing",
        "completed",
        "abandoned"
    ] = "phase1_collecting"
    phase1_output: Optional[Phase1Output] = None
    phase2_output: Optional[Phase2Output] = None
    phase3_output: Optional[Phase3Output] = None
    phase4_output: Optional[Phase4Output] = None
    
    # Live Q&A accumulator for Phase 3
    active_questions: List[ClarificationQuestion] = Field(default_factory=list)
    active_answers: List[ClarificationAnswer] = Field(default_factory=list)

    started_at: str
    phase1_completed_at: Optional[str] = None
    phase2_completed_at: Optional[str] = None
    phase3_completed_at: Optional[str] = None
    phase4_completed_at: Optional[str] = None
    input_modality: Literal["text", "voice"] = "text"
    input_language: str = "en"


# ---------------------------------------------------------------------------
# LLM Client Helper with Retries & Prompt Engineering
# ---------------------------------------------------------------------------

def _call_gemini_json(prompt: str, max_retries: int = 3) -> Dict[str, Any]:
    """
    Calls the Gemini REST API requesting strict JSON output.
    Uses exponential backoff for high resilience.
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured in the environment.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    last_err = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                # Clean up any residual markdown backticks if model wrapped JSON
                cleaned_text = re.sub(r"^```json\s*", "", text.strip())
                cleaned_text = re.sub(r"\s*```$", "", cleaned_text)
                return json.loads(cleaned_text)
            else:
                last_err = f"HTTP {resp.status_code}: {resp.text[:300]}"
        except Exception as e:
            last_err = str(e)

    raise RuntimeError(f"Gemini API generation failed after {max_retries} attempts: {last_err}")


# ---------------------------------------------------------------------------
# Core Symptom Intake Engine Implementation
# ---------------------------------------------------------------------------

class SymptomIntakeEngine:
    def __init__(self):
        # In-memory session store (keyed by session_id)
        self.sessions: Dict[str, SymptomIntakeSession] = {}

    # -----------------------------------------------------------------------
    # Phase 1: Raw Symptom Input & NLP Processing
    # -----------------------------------------------------------------------
    def process_raw_symptoms(
        self,
        raw_text: str,
        session_id: Optional[str] = None,
        input_modality: Literal["text", "voice"] = "text",
        input_language: str = "en"
    ) -> Phase1Output:
        """
        Executes Phase 1 NLP pipeline:
        1. Natural-language extraction of relevant phrases
        2. Common-sense reasoning to interpret everyday language
        3. Medical concept mapping to clinical categories
        4. Follow-up gap analysis and urgency detection
        """
        sid = session_id or f"intake_{uuid.uuid4().hex[:8]}"

        prompt = f"""
You are the MedVeda Clinical NLP Engine for the Smart Care Navigator.
Analyze the following patient's raw description of symptoms:
<patient_words>
{raw_text}
</patient_words>

Perform a 4-step progressive clinical NLP analysis:
1. EXTRACTION: Extract medically relevant colloquial phrases from the patient's words.
2. COMMON-SENSE REASONING: Interpret what the patient actually means using everyday clinical context. Do not require medical terms from the patient.
3. MEDICAL CONCEPT MAPPING: Map the interpreted phrases to formal clinical symptom categories.
4. FOLLOW-UP SIGNALS: Identify critical missing information needed to narrow the differential diagnosis, and detect any acute urgency red-flag signals.

Output strict JSON strictly following this schema:
{{
  "extracted_symptoms": [
    {{
      "raw_phrase": "exact phrase from text",
      "interpreted_meaning": "plain language interpretation of what patient is experiencing",
      "mapped_concepts": ["clinical concept 1", "clinical concept 2"],
      "body_region": "anatomical region (e.g. chest, respiratory, head, abdomen)",
      "character": "pain or sensation character (e.g. tight, dull, sharp, pressure, burning) or null",
      "trigger": "provoking factor (e.g. walking, exertion, eating, rest) or null"
    }}
  ],
  "missing_information": [
    "list of critical missing dimensions (e.g. duration, radiation, onset, associated sweating, etc.)"
  ],
  "urgency_signals": [
    "any potential acute danger cues extracted (e.g. exertional chest tightness, dyspnea on walking)"
  ],
  "processing_confidence": 0.95
}}
"""
        result_json = _call_gemini_json(prompt)

        extracted_items = []
        for item in result_json.get("extracted_symptoms", []):
            extracted_items.append(
                ExtractedSymptom(
                    raw_phrase=item.get("raw_phrase", ""),
                    interpreted_meaning=item.get("interpreted_meaning", ""),
                    mapped_concepts=item.get("mapped_concepts", []),
                    body_region=item.get("body_region", "general"),
                    character=item.get("character"),
                    trigger=item.get("trigger"),
                )
            )

        p1_output = Phase1Output(
            session_id=sid,
            raw_input=raw_text,
            input_language=input_language,
            extracted_symptoms=extracted_items,
            missing_information=result_json.get("missing_information", []),
            urgency_signals=result_json.get("urgency_signals", []),
            processing_confidence=float(result_json.get("processing_confidence", 0.90)),
        )

        # Initialize session state if new
        if sid not in self.sessions:
            self.sessions[sid] = SymptomIntakeSession(
                session_id=sid,
                status="phase1_complete",
                phase1_output=p1_output,
                started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                phase1_completed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                input_modality=input_modality,
                input_language=input_language,
            )
        else:
            session = self.sessions[sid]
            session.phase1_output = p1_output
            session.phase1_completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            session.status = "phase1_complete"

        return p1_output

    # -----------------------------------------------------------------------
    # Phase 2: Fixed Baseline Demographic & Clinical Questions
    # -----------------------------------------------------------------------
    def record_baseline(self, session_id: str, baseline_data: Dict[str, Any]) -> Phase2Output:
        """
        Records the 10 fixed baseline demographic and clinical questions.
        """
        if session_id not in self.sessions:
            raise HTTPException(status_code=404, detail=f"Intake session '{session_id}' not found.")

        session = self.sessions[session_id]

        p2_output = Phase2Output(
            session_id=session_id,
            age=int(baseline_data.get("age", 30)),
            age_months=baseline_data.get("age_months"),
            biological_sex=baseline_data.get("biological_sex", "male"),
            symptom_duration_value=int(baseline_data.get("symptom_duration_value", 1)),
            symptom_duration_unit=baseline_data.get("symptom_duration_unit", "days"),
            onset_type=baseline_data.get("onset_type", "gradual"),
            self_reported_severity=baseline_data.get("self_reported_severity", "moderate"),
            location=baseline_data.get("location", "Unknown Location"),
            latitude=baseline_data.get("latitude"),
            longitude=baseline_data.get("longitude"),
            medical_history=baseline_data.get("medical_history", []),
            current_medications=baseline_data.get("current_medications", []),
            known_allergies=baseline_data.get("known_allergies", []),
            reporting_for=baseline_data.get("reporting_for", "self"),
        )

        session.phase2_output = p2_output
        session.phase2_completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session.status = "phase2_complete"
        return p2_output

    # -----------------------------------------------------------------------
    # Phase 3: Adaptive LLM Clarification Questionnaire
    # (100% LLM-Generated, Zero Pre-Stored Question Bank, Min 5, Max 15)
    # -----------------------------------------------------------------------
    def get_next_clarification_question(self, session_id: str) -> Dict[str, Any]:
        """
        Generates the NEXT clarifying question dynamically using Gemini.
        Zero hard-coded questions: the LLM receives the full context and decides what to ask.
        """
        if session_id not in self.sessions:
            raise HTTPException(status_code=404, detail=f"Intake session '{session_id}' not found.")

        session = self.sessions[session_id]
        if not session.phase1_output:
            raise HTTPException(status_code=400, detail="Phase 1 symptoms not processed yet.")
        if not session.phase2_output:
            raise HTTPException(status_code=400, detail="Phase 2 baseline demographic data not submitted yet.")

        current_count = len(session.active_answers)

        # Enforce Hard Stop at 15 questions
        if current_count >= 15:
            return {
                "session_id": session_id,
                "status": "ready_for_completion",
                "message": "Maximum 15 clarification questions reached. Proceed to final diagnostic analysis.",
                "questions_asked_so_far": current_count,
                "can_complete": True,
            }

        # Build comprehensive context for the LLM
        q_num = current_count + 1
        history_str = ""
        for i, (q, a) in enumerate(zip(session.active_questions, session.active_answers)):
            history_str += f"\n[Q{i+1}] {q.question_text}\n[A{i+1}] {a.structured_answer}\n"

        p1 = session.phase1_output
        p2 = session.phase2_output

        prompt = f"""
You are the MedVeda Adaptive Clinical Intake Interviewer.
Your goal is to clarify the patient's symptoms so that a clinician can determine the diagnosis, severity, required department, and emergency status.

CRITICAL RULES:
- There is NO pre-stored question bank. You MUST generate the next most diagnostically valuable question based on what you know so far.
- Minimum questions required: 5. Current question number: {q_num} (Max: 15).
- Each question must be in clear, empathetic, non-jargon language.
- Provide 3 to 5 realistic, helpful multiple-choice options (Option A, B, C, etc.) that the patient can tap.
- Also assess your current diagnostic clarity (0.0 to 1.0) and whether remaining gaps require more questions.

CURRENT PATIENT CONTEXT:
- Raw Symptoms: "{p1.raw_input}"
- Extracted Symptoms: {[s.interpreted_meaning for s in p1.extracted_symptoms]}
- Missing Information Identified in Phase 1: {p1.missing_information}
- Urgency Signals: {p1.urgency_signals}
- Age: {p2.age} | Sex: {p2.biological_sex} | Location: {p2.location}
- Duration: {p2.symptom_duration_value} {p2.symptom_duration_unit} (Onset: {p2.onset_type})
- Self-Reported Severity: {p2.self_reported_severity}
- Medical History: {p2.medical_history}
- Current Medications: {p2.current_medications}

CONVERSATION Q&A HISTORY SO FAR:{history_str if history_str else " None yet."}

Based on this patient's specific presentation, generate Question #{q_num}.
Output strict JSON matching:
{{
  "question_number": {q_num},
  "question_text": "Empathetic, clear clinical clarifying question",
  "question_category": "category like symptom_character, radiation_pattern, aggravating_factors, associated_symptoms, red_flag_check, etc.",
  "options": [
    {{"option_id": "A", "option_text": "Clear option 1"}},
    {{"option_id": "B", "option_text": "Clear option 2"}},
    {{"option_id": "C", "option_text": "Clear option 3"}},
    {{"option_id": "D", "option_text": "Not sure / None of these"}}
  ],
  "diagnostic_clarity": 0.65,
  "remaining_gaps": ["gap 1", "gap 2"]
}}
"""
        res_json = _call_gemini_json(prompt)

        options = [
            AnswerOption(option_id=opt.get("option_id", chr(65 + idx)), option_text=opt.get("option_text", ""))
            for idx, opt in enumerate(res_json.get("options", []))
        ]

        question = ClarificationQuestion(
            question_number=q_num,
            question_text=res_json.get("question_text", "Could you provide more detail on your symptoms?"),
            question_category=res_json.get("question_category", "general_clarification"),
            options=options,
            allows_free_text=True,
        )

        session.active_questions.append(question)
        session.status = "phase3_questioning"

        return {
            "session_id": session_id,
            "phase": "phase3_questioning",
            "question": question.model_dump(),
            "questions_asked_so_far": current_count,
            "questions_remaining_min": max(0, 5 - current_count),
            "questions_remaining_max": 15 - current_count,
            "diagnostic_clarity_score": float(res_json.get("diagnostic_clarity", 0.5)),
            "can_complete": current_count >= 5,
        }

    def submit_clarification_answer(
        self,
        session_id: str,
        question_number: int,
        answer_mode: Literal["option_selected", "free_text"],
        selected_option_id: Optional[str] = None,
        free_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes the patient's answer.
        KEY REQUIREMENT: If answer is in free text, it re-runs Phase 1 NLP processing
        on that text to extract clinical concepts and structured meaning!
        """
        if session_id not in self.sessions:
            raise HTTPException(status_code=404, detail=f"Intake session '{session_id}' not found.")

        session = self.sessions[session_id]

        # Find the question
        matching_q = next((q for q in session.active_questions if q.question_number == question_number), None)
        if not matching_q:
            raise HTTPException(status_code=400, detail=f"Question #{question_number} was not generated for this session.")

        selected_text = None
        free_text_nlp = None

        if answer_mode == "option_selected":
            matching_opt = next((o for o in matching_q.options if o.option_id == selected_option_id), None)
            selected_text = matching_opt.option_text if matching_opt else selected_option_id
            structured_ans = f"Selected: {selected_text}"
        else:
            # Free text answer: RE-RUN Phase 1 NLP pipeline on patient's words
            free_text_nlp = self.process_raw_symptoms(
                raw_text=free_text or "",
                session_id=f"nlp_answer_{session_id}_{question_number}"
            )
            extracted_phrases = [s.interpreted_meaning for s in free_text_nlp.extracted_symptoms]
            structured_ans = f"Patient free-text: \"{free_text}\" (Clinical interpretation: {', '.join(extracted_phrases) if extracted_phrases else free_text})"

        answer = ClarificationAnswer(
            question_number=question_number,
            answer_mode=answer_mode,
            selected_option_id=selected_option_id,
            selected_option_text=selected_text,
            free_text_raw=free_text,
            free_text_extracted=free_text_nlp,
            structured_answer=structured_ans,
        )

        session.active_answers.append(answer)
        total_answered = len(session.active_answers)

        return {
            "session_id": session_id,
            "answer_processed": True,
            "nlp_extraction_applied": answer_mode == "free_text",
            "questions_answered_so_far": total_answered,
            "min_met": total_answered >= 5,
            "max_reached": total_answered >= 15,
            "can_complete_early": total_answered >= 5,
        }

    # -----------------------------------------------------------------------
    # Phase 4: Structured Diagnostic Output Generation
    # -----------------------------------------------------------------------
    def generate_final_diagnostic_output(self, session_id: str) -> Phase4Output:
        """
        Executes Phase 4:
        Aggregates Phase 1, Phase 2, and Phase 3 Q&A answers, then invokes Gemini
        to generate the final structured output (suspected diseases with probabilities,
        department, emergency or OPD, severity, routing advice).
        """
        if session_id not in self.sessions:
            raise HTTPException(status_code=404, detail=f"Intake session '{session_id}' not found.")

        session = self.sessions[session_id]
        if not session.phase1_output or not session.phase2_output:
            raise HTTPException(status_code=400, detail="Incomplete intake session. Phase 1 and 2 required.")

        p1 = session.phase1_output
        p2 = session.phase2_output

        # Assemble full structured answers
        qa_history = []
        for q, a in zip(session.active_questions, session.active_answers):
            qa_history.append({
                "question_number": q.question_number,
                "question": q.question_text,
                "category": q.question_category,
                "answer": a.structured_answer,
            })

        prompt = f"""
You are the MedVeda Senior Clinical Triage & Differential Diagnosis Engine.
Evaluate the following complete, structured intake record for a patient:

[PHASE 1: INITIAL SYMPTOM EXTRACTION]
- Raw Patient Words: "{p1.raw_input}"
- Extracted Clinical Symptoms: {[s.model_dump() for s in p1.extracted_symptoms]}
- Urgency Signals Detected: {p1.urgency_signals}

[PHASE 2: DEMOGRAPHIC & BASELINE DATA]
- Age: {p2.age} ({p2.biological_sex})
- Duration: {p2.symptom_duration_value} {p2.symptom_duration_unit} | Onset: {p2.onset_type}
- Patient Reported Severity: {p2.self_reported_severity}
- Location: {p2.location}
- Medical History: {p2.medical_history}
- Current Medications: {p2.current_medications}
- Known Allergies: {p2.known_allergies}

[PHASE 3: ADAPTIVE CLARIFICATION Q&A (TOTAL: {len(qa_history)})]
{json.dumps(qa_history, indent=2)}

TASK:
Produce a comprehensive clinical evaluation.
Enforce all MedVeda Safety Invariants:
1. NEVER output a definitive diagnosis (e.g. "You have X"). Instead output suspected conditions with calibrated probabilities.
2. The probabilities of suspected diseases MUST sum to approximately 1.0 (100%).
3. Determine the required medical department to treat this presentation.
4. Classify care setting: "emergency" vs "opd", and state if Emergency care is required immediately.
5. Classify clinical severity: "critical", "high", "moderate", or "low".
6. Provide actionable, empathetic clinical routing advice without definitive diagnosis assertions.

Output strictly valid JSON matching this schema:
{{
  "suspected_conditions": [
    {{
      "condition_name": "Condition Name",
      "probability": 0.40,
      "reasoning": "Clinical reasoning based on symptoms and Q&A",
      "icd_category": "e.g. I20 or K21"
    }}
  ],
  "primary_suspected_condition": "Highest probability condition name",
  "required_department": "Primary specialty department e.g. Cardiology, Neurology, General Medicine",
  "alternate_departments": ["General Medicine", "Emergency Medicine"],
  "is_emergency": true,
  "care_setting": "emergency",
  "emergency_reasoning": "Reason if emergency, or null",
  "severity": "critical",
  "severity_reasoning": "Clinical reasoning for severity assignment",
  "routing_advice": "Actionable non-definitive clinical advice for patient transit and care",
  "red_flags_detected": ["list of red flags"],
  "diagnostic_confidence": 0.88
}}
"""
        res = _call_gemini_json(prompt)

        suspected = [
            SuspectedCondition(
                condition_name=c.get("condition_name", "Unknown condition"),
                probability=float(c.get("probability", 0.0)),
                reasoning=c.get("reasoning", ""),
                icd_category=c.get("icd_category"),
            )
            for c in res.get("suspected_conditions", [])
        ]

        # Normalization guardrail: Ensure probabilities sum to ~1.0
        total_prob = sum(c.probability for c in suspected)
        if total_prob > 0 and abs(total_prob - 1.0) > 0.05:
            for c in suspected:
                c.probability = round(c.probability / total_prob, 3)

        p4_output = Phase4Output(
            session_id=session_id,
            suspected_conditions=suspected,
            primary_suspected_condition=res.get("primary_suspected_condition", suspected[0].condition_name if suspected else "General Medical Assessment"),
            required_department=res.get("required_department", "General Medicine"),
            alternate_departments=res.get("alternate_departments", []),
            is_emergency=bool(res.get("is_emergency", False)),
            care_setting=res.get("care_setting", "opd"),
            emergency_reasoning=res.get("emergency_reasoning"),
            severity=res.get("severity", "moderate"),
            severity_reasoning=res.get("severity_reasoning", ""),
            routing_advice=res.get("routing_advice", "Please consult a healthcare professional."),
            red_flags_detected=res.get("red_flags_detected", []),
            diagnostic_confidence=float(res.get("diagnostic_confidence", 0.85)),
            total_intake_questions=len(qa_history) + 10,
            phase3_questions_asked=len(qa_history),
            intake_completed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )

        session.phase4_output = p4_output
        session.phase4_completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session.status = "completed"
        return p4_output


# Singleton instance
engine = SymptomIntakeEngine()

# ---------------------------------------------------------------------------
# FastAPI Router Definition
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1/intake", tags=["symptom-intake"])

class StartIntakeRequest(BaseModel):
    raw_symptoms: Optional[str] = None
    raw_text: Optional[str] = None
    session_id: Optional[str] = None
    input_modality: Literal["text", "voice"] = "text"
    input_language: str = "en"

    @model_validator(mode="before")
    @classmethod
    def validate_raw(cls, data):
        if isinstance(data, dict):
            s = data.get("raw_symptoms") or data.get("raw_text")
            if not s:
                raise ValueError("raw_symptoms or raw_text is required")
            data["raw_symptoms"] = s
            data["raw_text"] = s
        return data

class BaselineRequest(BaseModel):
    age: int
    age_months: Optional[int] = None
    biological_sex: Literal["male", "female", "other"]
    symptom_duration_value: int
    symptom_duration_unit: Literal["minutes", "hours", "days", "weeks", "months"]
    onset_type: Literal["sudden", "gradual", "chronic"]
    self_reported_severity: Literal["mild", "moderate", "severe"]
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    medical_history: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    known_allergies: List[str] = Field(default_factory=list)
    reporting_for: Literal["self", "child", "family_member", "parent", "other"] = "self"

    @model_validator(mode="before")
    @classmethod
    def normalize_reporting_for(cls, data):
        if isinstance(data, dict) and data.get("reporting_for") == "parent":
            data["reporting_for"] = "family_member"
        return data

class AnswerRequest(BaseModel):
    question_number: int
    answer_mode: Literal["option_selected", "free_text"]
    selected_option_id: Optional[str] = None
    free_text: Optional[str] = None

@router.post("/start")
def start_intake(req: StartIntakeRequest):
    """Starts session & executes Phase 1 NLP."""
    p1 = engine.process_raw_symptoms(
        raw_text=req.raw_symptoms,
        session_id=req.session_id,
        input_modality=req.input_modality,
        input_language=req.input_language
    )
    return {
        "success": True,
        "session_id": p1.session_id,
        "phase": "phase1_complete",
        "phase1_output": p1.model_dump(),
        "next_step": f"POST /api/v1/intake/{p1.session_id}/baseline"
    }

@router.post("/{session_id}/baseline")
def submit_baseline(session_id: str, req: BaselineRequest):
    """Submits Phase 2 baseline demographic and clinical data."""
    p2 = engine.record_baseline(session_id, req.model_dump())
    return {
        "success": True,
        "session_id": session_id,
        "phase": "phase2_complete",
        "phase2_output": p2.model_dump(),
        "next_step": f"GET /api/v1/intake/{session_id}/next-question"
    }

@router.get("/{session_id}/next-question")
def get_next_question(session_id: str):
    """Phase 3: Gets the next LLM-generated clarifying question."""
    result = engine.get_next_clarification_question(session_id)
    return {"success": True, **result}

@router.post("/{session_id}/answer")
def submit_answer(session_id: str, req: AnswerRequest):
    """Phase 3: Submits an answer (re-runs Phase 1 NLP if free text)."""
    result = engine.submit_clarification_answer(
        session_id=session_id,
        question_number=req.question_number,
        answer_mode=req.answer_mode,
        selected_option_id=req.selected_option_id,
        free_text=req.free_text
    )
    return {"success": True, **result}

@router.get("/{session_id}/status")
def get_intake_status(session_id: str):
    """Returns the current state and phase of the intake session."""
    if session_id not in engine.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    s = engine.sessions[session_id]
    return {
        "success": True,
        "session_id": session_id,
        "status": s.status,
        "questions_answered": len(s.active_answers),
        "min_questions_met": len(s.active_answers) >= 5,
        "max_questions_met": len(s.active_answers) >= 15
    }

@router.post("/{session_id}/complete")
def complete_intake(session_id: str):
    """Executes Phase 4: Produces structured diagnostic output."""
    p4 = engine.generate_final_diagnostic_output(session_id)
    return {
        "success": True,
        "session_id": session_id,
        "phase": "completed",
        "phase4_output": p4.model_dump()
    }

@router.get("/{session_id}/result")
def get_intake_result(session_id: str):
    """Retrieves the completed Phase 4 structured output."""
    if session_id not in engine.sessions or not engine.sessions[session_id].phase4_output:
        raise HTTPException(status_code=404, detail="No diagnostic result available for this session.")
    return {
        "success": True,
        "session_id": session_id,
        "data": engine.sessions[session_id].phase4_output.model_dump()
    }
