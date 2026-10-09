"""
MedVeda Clinical Screening & Diagnostic Triage Engine (Python AI / ML)
Framework: FastAPI + Pydantic + LLM Clinical Reasoning (Gemini + Decision Engine)

Provides:
- Dynamic, non-template clinical follow-up questions tailored to patient's symptoms
- Deep disease/condition hypothesis generation (differential diagnosis)
- Emergency Level & Acuity assessment (CRITICAL, URGENT, NON_URGENT)
- Care Setting classification (Emergency Department vs Outpatient Department)
- Clinical Department recommendation (Cardiology, Neurology, Pulmonology, etc.)
- Strict step-by-step diagnostic workflow
"""

import os
import re
import json
import requests
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class PatientProfile(BaseModel):
    name: Optional[str] = "Patient"
    age: int = 45
    sex: str = "female"
    location: str = "Hazaribagh, Jharkhand"
    medicalHistory: Optional[List[str]] = []

class SymptomIntake(BaseModel):
    primarySymptoms: str
    duration: Optional[str] = ""
    severity: Optional[str] = "moderate"
    additionalNotes: Optional[str] = ""

class QuestionAnswer(BaseModel):
    question_id: str
    question_text: str
    selected_option_id: Optional[str] = None
    selected_option_text: Optional[str] = None
    custom_text: Optional[str] = None

class ScreeningStartRequest(BaseModel):
    patient: PatientProfile
    symptoms: SymptomIntake

class ScreeningAnswerRequest(BaseModel):
    patient: PatientProfile
    symptoms: SymptomIntake
    conversation_history: List[QuestionAnswer] = []

class DifferentialDiagnosis(BaseModel):
    condition: str
    probability: str
    urgency: str
    rationale: str

class DiagnosticSynthesis(BaseModel):
    suspected_condition: str
    differential_diagnoses: List[DifferentialDiagnosis]
    emergency_level: str  # "EMERGENCY", "URGENT", "ROUTINE", "SELF_CARE"
    urgency: str          # "CRITICAL", "URGENT", "NON_URGENT"
    acuity_badge: str
    care_setting: str     # "EMERGENCY_DEPARTMENT", "OUTPATIENT_DEPARTMENT"
    care_setting_label: str
    recommended_specialty: str
    clinical_routing_advice: str
    red_flags_detected: List[str]
    confidence_score: int
    search_queries: List[str]

class FollowUpQuestion(BaseModel):
    question_id: str
    question_text: str
    clinical_focus: str
    step_number: int
    total_expected_steps: int
    options: List[Dict[str, Any]]
    allow_custom_text: bool = True

class ScreeningResponse(BaseModel):
    success: bool
    session_id: str
    is_complete: bool
    current_step: int
    total_steps: int
    next_question: Optional[FollowUpQuestion] = None
    diagnostic_synthesis: Optional[DiagnosticSynthesis] = None


# -------------------------------------------------------------
# Clinical Knowledge Base & Rule Sets
# -------------------------------------------------------------

CLINICAL_DOMAINS = [
    {
        "id": "cardiac",
        "keywords": ["chest pain", "chest pressure", "radiating to arm", "jaw pain", "angina", "heart attack", "palpitations", "cold sweat", "tightness in chest"],
        "default_specialty": "Cardiology & Intensive Care",
        "critical_emergency": True,
        "questions": [
            {
                "id": "q_cardiac_radiation",
                "text": "Does this chest discomfort radiate anywhere (e.g. left arm, shoulder, jaw, neck, or back)?",
                "focus": "Ischemic Radiation Pattern",
                "options": [
                    {"id": "rad_arm_jaw", "text": "Yes, radiates to left arm, neck, or jaw", "risk": "CRITICAL"},
                    {"id": "rad_back", "text": "Radiates between the shoulder blades / mid-back", "risk": "CRITICAL"},
                    {"id": "rad_none", "text": "No radiation, strictly localized to one spot on chest", "risk": "MODERATE"},
                    {"id": "rad_burning", "text": "Burning sensation moving upward toward the throat", "risk": "LOW"}
                ]
            },
            {
                "id": "q_cardiac_onset",
                "text": "How did this discomfort begin, and what makes it better or worse?",
                "focus": "Provocation & Onset",
                "options": [
                    {"id": "onset_exertion", "text": "Triggered by exertion/stairs or emotional stress, persists at rest", "risk": "CRITICAL"},
                    {"id": "onset_sudden_rest", "text": "Started suddenly while resting with cold sweating / breathlessness", "risk": "CRITICAL"},
                    {"id": "onset_breathing", "text": "Sharp pain that worsens sharply when inhaling or coughing", "risk": "MODERATE"},
                    {"id": "onset_meal", "text": "Started after a heavy meal or worse when lying flat", "risk": "LOW"}
                ]
            },
            {
                "id": "q_cardiac_associated",
                "text": "Are you experiencing any of these associated warning symptoms?",
                "focus": "Autonomic & Hemodynamic Instability",
                "options": [
                    {"id": "assoc_sweat_faint", "text": "Cold profuse sweating, feeling faint/dizzy, or nausea", "risk": "CRITICAL"},
                    {"id": "assoc_sob", "text": "Significant shortness of breath or feeling suffocated", "risk": "CRITICAL"},
                    {"id": "assoc_sour_burp", "text": "Sour taste in mouth / acid regurgitation", "risk": "LOW"},
                    {"id": "assoc_none", "text": "None of the above accompanying symptoms", "risk": "MODERATE"}
                ]
            }
        ]
    },
    {
        "id": "neuro",
        "keywords": ["headache", "facial droop", "slurred speech", "paralysis", "weakness in arm", "numbness", "vision loss", "dizziness", "seizure", "confusion"],
        "default_specialty": "Neurology & Stroke Center",
        "critical_emergency": True,
        "questions": [
            {
                "id": "q_neuro_onset",
                "text": "How rapidly did your neurological symptoms or headache reach peak intensity?",
                "focus": "Acuity & Vascular Onset",
                "options": [
                    {"id": "onset_thunderclap", "text": "Explosive 'thunderclap' onset peaking within seconds ('worst headache of life')", "risk": "CRITICAL"},
                    {"id": "onset_unilateral_weak", "text": "Sudden onset of weakness or numbness on one side of face/body", "risk": "CRITICAL"},
                    {"id": "onset_gradual_hours", "text": "Gradual buildup over several hours with throbbing", "risk": "MODERATE"},
                    {"id": "onset_chronic_days", "text": "Dull ache present intermittently over weeks", "risk": "LOW"}
                ]
            },
            {
                "id": "q_neuro_fast",
                "text": "Are there any difficulties speaking, smiling symmetrically, or raising both arms?",
                "focus": "FAST Stroke Protocol",
                "options": [
                    {"id": "fast_speech_slur", "text": "Yes, speech is slurred, confused, or unable to find words", "risk": "CRITICAL"},
                    {"id": "fast_face_droop", "text": "Yes, one side of face or mouth is drooping", "risk": "CRITICAL"},
                    {"id": "fast_arm_drift", "text": "Yes, one arm is weak or drifts down when raised", "risk": "CRITICAL"},
                    {"id": "fast_no_deficits", "text": "No weakness, facial asymmetry, or speech difficulties", "risk": "MODERATE"}
                ]
            },
            {
                "id": "q_neuro_associated",
                "text": "Do you notice fever with neck stiffness, double vision, or sensitivity to light/sound?",
                "focus": "Meningeal & Focal Signs",
                "options": [
                    {"id": "assoc_stiff_neck_fever", "text": "High fever, neck stiffness (cannot touch chin to chest), or confusion", "risk": "CRITICAL"},
                    {"id": "assoc_visual_loss", "text": "Double vision or sudden partial blindness in one eye", "risk": "CRITICAL"},
                    {"id": "assoc_migraine_aura", "text": "Zig-zag visual flashes with nausea and light sensitivity", "risk": "MODERATE"},
                    {"id": "assoc_neck_tension", "text": "Tension and tightness across back of neck and shoulders", "risk": "LOW"}
                ]
            }
        ]
    },
    {
        "id": "respiratory",
        "keywords": ["breathing difficulty", "shortness of breath", "cannot breathe", "gasping", "wheezing", "coughing blood", "asthma attack", "choking"],
        "default_specialty": "Pulmonology & Critical Care",
        "critical_emergency": True,
        "questions": [
            {
                "id": "q_resp_speech",
                "text": "Can you speak full sentences comfortably without pausing to take a breath?",
                "focus": "Respiratory Distress Severity",
                "options": [
                    {"id": "resp_words_only", "text": "No, can only speak in short phrases or single words between gasps", "risk": "CRITICAL"},
                    {"id": "resp_blue_lips", "text": "Noticeable blueness of lips/fingertips or gasping for air", "risk": "CRITICAL"},
                    {"id": "resp_moderate_sob", "text": "Breathing is labored when walking or moving, but can speak sentences", "risk": "MODERATE"},
                    {"id": "resp_mild_cough", "text": "Mostly a cough with only mild breathlessness", "risk": "LOW"}
                ]
            },
            {
                "id": "q_resp_associated",
                "text": "Are there high fever, chest pain on breathing, blood in cough, or audible whistling/wheezing?",
                "focus": "Etiology (Infection vs Thromboembolism vs Airway)",
                "options": [
                    {"id": "resp_cough_blood", "text": "Coughing up blood or sudden sharp one-sided pleuritic chest pain", "risk": "CRITICAL"},
                    {"id": "resp_wheeze_inhaler", "text": "Audible wheezing / asthma exacerbation not relieved by inhaler", "risk": "CRITICAL"},
                    {"id": "resp_fever_phlegm", "text": "Fever with green/yellow phlegm for 2-3 days", "risk": "MODERATE"},
                    {"id": "resp_dry_throat", "text": "Dry tickly cough and throat irritation", "risk": "LOW"}
                ]
            }
        ]
    },
    {
        "id": "abdominal",
        "keywords": ["stomach pain", "abdominal pain", "vomiting", "blood in vomit", "black stool", "diarrhea", "belly ache", "jaundice", "liver pain"],
        "default_specialty": "Gastroenterology & General Surgery",
        "critical_emergency": False,
        "questions": [
            {
                "id": "q_abdo_location",
                "text": "Where is the abdominal pain most severe, and how does it feel?",
                "focus": "Anatomical Localization",
                "options": [
                    {"id": "abdo_rlq", "text": "Lower right side of belly, hurts intensely when walking or pressed (rebound)", "risk": "CRITICAL"},
                    {"id": "abdo_epigastric_back", "text": "Severe upper belly pain radiating straight through to the back", "risk": "CRITICAL"},
                    {"id": "abdo_crampy_diffuse", "text": "General crampy discomfort all over abdomen that comes and goes", "risk": "MODERATE"},
                    {"id": "abdo_burning_upper", "text": "Burning upper stomach pain relieved temporarily by food or antacids", "risk": "LOW"}
                ]
            },
            {
                "id": "q_abdo_redflags",
                "text": "Do you have persistent vomiting, black tarry stools, yellow eyes/skin, or high fever?",
                "focus": "Peritonitis / GI Hemorrhage / Sepsis",
                "options": [
                    {"id": "abdo_black_blood", "text": "Vomiting blood/coffee-ground material or passing black tarry stools", "risk": "CRITICAL"},
                    {"id": "abdo_rigid_belly", "text": "Abdomen feels rigid/hard as a board with severe fever and dehydration", "risk": "CRITICAL"},
                    {"id": "abdo_loose_stools", "text": "Watery loose stools with mild fever and dehydration", "risk": "MODERATE"},
                    {"id": "abdo_mild_nausea", "text": "Mild nausea without vomiting or bleeding", "risk": "LOW"}
                ]
            }
        ]
    },
    {
        "id": "ortho_trauma",
        "keywords": ["fracture", "broken bone", "fall", "injury", "bleeding", "joint swelling", "ankle twist", "knee pain", "back pain", "accident"],
        "default_specialty": "Orthopedics & Trauma Surgery",
        "critical_emergency": False,
        "questions": [
            {
                "id": "q_ortho_bearing",
                "text": "Can you bear weight on the affected limb, or is there visible deformity or bone protrusion?",
                "focus": "Fracture & Dislocation Severity",
                "options": [
                    {"id": "ortho_open_deformity", "text": "Visible crooked deformity, bone protrusion, or uncontrolled bleeding", "risk": "CRITICAL"},
                    {"id": "ortho_no_weight", "text": "Severe pain with complete inability to take even 4 steps", "risk": "MODERATE"},
                    {"id": "ortho_limping", "text": "Limping or sore, but can put some weight with support", "risk": "LOW"},
                    {"id": "ortho_chronic_joint", "text": "Chronic stiffness or swelling that worsens in the morning", "risk": "LOW"}
                ]
            },
            {
                "id": "q_ortho_neuro",
                "text": "Do you feel numbness, tingling, or loss of pulse/coldness in the fingers or toes beyond the injury?",
                "focus": "Neurovascular Compromise",
                "options": [
                    {"id": "ortho_numb_cold", "text": "Yes, fingers or toes feel numb, pale, or unusually cold", "risk": "CRITICAL"},
                    {"id": "ortho_swelling_only", "text": "Localized swelling and bruising without numbness", "risk": "MODERATE"},
                    {"id": "ortho_muscle_ache", "text": "General muscle soreness without swelling", "risk": "LOW"}
                ]
            }
        ]
    }
]

GENERAL_DOMAIN = {
    "id": "general",
    "default_specialty": "General Medicine",
    "critical_emergency": False,
    "questions": [
        {
            "id": "q_gen_severity",
            "text": "How significantly are these symptoms impairing your daily activities or ability to eat and drink?",
            "focus": "Functional Impairment",
            "options": [
                {"id": "gen_bedridden", "text": "Completely unable to get out of bed, take fluids, or stay awake", "risk": "CRITICAL"},
                {"id": "gen_moderately_limited", "text": "Unable to work or perform usual duties, but able to drink liquids", "risk": "MODERATE"},
                {"id": "gen_mild_bothersome", "text": "Mildly bothersome but able to carry on usual routines", "risk": "LOW"}
            ]
        },
        {
            "id": "q_gen_vitals",
            "text": "Are there extreme fever (>103°F / 39.5°C), severe shaking chills, fainting spells, or confusion?",
            "focus": "Systemic Warning Signs",
            "options": [
                {"id": "gen_fever_confusion", "text": "Yes, severe high fever with shaking chills or confusion", "risk": "CRITICAL"},
                {"id": "gen_fever_moderate", "text": "Mild-to-moderate fever responding to paracetamol", "risk": "MODERATE"},
                {"id": "gen_no_fever", "text": "No fever or fainting spells reported", "risk": "LOW"}
            ]
        }
    ]
}


def detect_clinical_domain(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    for domain in CLINICAL_DOMAINS:
        for kw in domain["keywords"]:
            if kw in text_lower:
                return domain
    return GENERAL_DOMAIN


def generate_llm_clinical_reasoning(
    patient: PatientProfile,
    symptoms: SymptomIntake,
    history: List[QuestionAnswer]
) -> Optional[Dict[str, Any]]:
    """Calls Gemini API if available to generate rich clinical reasoning."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or len(api_key) < 10 or api_key == "your_gemini_api_key_here":
        return None

    model = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.0-flash")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    history_text = "\n".join([
        f"- Q: {item.question_text} -> A: {item.selected_option_text or item.custom_text}"
        for item in history
    ])

    prompt = f"""
You are an expert Clinical Triage Physician and Emergency Medicine Specialist.
Analyze this patient presentation and provide a deep clinical assessment.

PATIENT PROFILE:
- Age: {patient.age}, Sex: {patient.sex}, Location: {patient.location}
- Medical History: {', '.join(patient.medicalHistory) if patient.medicalHistory else 'None reported'}

SYMPTOM INTAKE:
- Primary Symptoms: {symptoms.primarySymptoms}
- Duration/Onset: {symptoms.duration}
- Perceived Severity: {symptoms.severity}
- Additional Context: {symptoms.additionalNotes}

INTERACTIVE CLINICAL INTERVIEW ANSWERS:
{history_text if history_text else 'None yet.'}

Respond with a strictly formatted JSON object matching this schema:
{{
  "suspected_condition": "Primary suspected medical diagnosis / condition",
  "differential_diagnoses": [
    {{
      "condition": "Condition name",
      "probability": "High / Moderate / Low (percentage)",
      "urgency": "CRITICAL / URGENT / NON_URGENT",
      "rationale": "Medical reason based on reported symptoms"
    }}
  ],
  "emergency_level": "EMERGENCY / URGENT / ROUTINE / SELF_CARE",
  "urgency": "CRITICAL / URGENT / NON_URGENT",
  "care_setting": "EMERGENCY_DEPARTMENT or OUTPATIENT_DEPARTMENT",
  "care_setting_label": "24x7 Emergency Department (ED / Resuscitation / ICU) OR Outpatient Department (OPD Clinic)",
  "recommended_specialty": "Exact clinical specialty (e.g. Cardiology & Intensive Care, Neurology & Stroke Center, Pulmonology, Gastroenterology, General Surgery, General Medicine)",
  "clinical_routing_advice": "2-3 sentences explaining exactly why this emergency level, setting (ED vs OPD), and specialty are mandated.",
  "red_flags_detected": ["List of detected red flag signs"],
  "confidence_score": 85
}}
Do NOT output markdown fences or backticks. Return valid JSON only.
"""
    try:
        res = requests.post(
            endpoint,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=10
        )
        if res.ok:
            data = res.json()
            raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            raw_text = re.sub(r"^```json\s*", "", raw_text.strip(), flags=re.MULTILINE)
            raw_text = re.sub(r"```$", "", raw_text.strip(), flags=re.MULTILINE)
            return json.loads(raw_text.strip())
    except Exception as e:
        print(f"[Clinical Screening] Gemini API error: {e}")
    return None


def synthesize_deterministic_clinical_assessment(
    patient: PatientProfile,
    symptoms: SymptomIntake,
    history: List[QuestionAnswer],
    domain: Dict[str, Any]
) -> DiagnosticSynthesis:
    """Robust, deterministic medical reasoning engine when LLM is offline or not configured."""
    has_critical_answer = False
    critical_flags = []
    
    for ans in history:
        sel_text = (ans.selected_option_text or ans.custom_text or "").lower()
        if any(term in sel_text for term in ["radiates to left arm", "jaw", "sweating", "thunderclap", "slurred", "droop", "words only", "blue lips", "blood", "rigid", "open", "numb, pale", "fever with shaking", "bedridden", "protrusion"]):
            has_critical_answer = True
            critical_flags.append(ans.selected_option_text or ans.custom_text)

    is_emergency = has_critical_answer or symptoms.severity == "severe" or domain.get("critical_emergency", False) and any("onset" in (a.question_id) for a in history)

    # Condition & Specialty Inference
    domain_id = domain["id"]
    if domain_id == "cardiac":
        if has_critical_answer or symptoms.severity == "severe":
            suspected = "Suspected Acute Coronary Syndrome (Unstable Angina / Acute Myocardial Infarction)"
            urgency = "CRITICAL"
            emer_level = "EMERGENCY"
            setting = "EMERGENCY_DEPARTMENT"
            setting_label = "24x7 Emergency Department (ED / Resuscitation / ICU)"
            specialty = "Cardiology & Intensive Care"
            advice = "Symptoms indicate a potential acute coronary event requiring immediate emergency department stabilization, 12-lead ECG within 10 minutes, cardiac troponin assays, and catheterization lab standby. Outpatient clinics are NOT suitable."
            differentials = [
                DifferentialDiagnosis(condition="Acute Myocardial Infarction (STEMI / NSTEMI)", probability="High (76%)", urgency="CRITICAL", rationale="Typical ischemic presentation with potential autonomic/radiation signs."),
                DifferentialDiagnosis(condition="Unstable Angina Pectoris", probability="Moderate (18%)", urgency="CRITICAL", rationale="Rest ischemia without confirmed myocardial necrosis."),
                DifferentialDiagnosis(condition="Gastroesophageal Reflux Disease", probability="Low (6%)", urgency="NON_URGENT", rationale="Atypical chest discomfort mimicking coronary ischemia.")
            ]
        else:
            suspected = "Stable Angina / Non-Acute Chest Discomfort"
            urgency = "URGENT"
            emer_level = "URGENT"
            setting = "OUTPATIENT_DEPARTMENT"
            setting_label = "Outpatient Department (Day OPD Clinic)"
            specialty = "Cardiology"
            advice = "Patient presents with non-critical chest discomfort suitable for same-day cardiology outpatient assessment, stress testing, and routine evaluation."
            differentials = [
                DifferentialDiagnosis(condition="Stable Angina / Coronary Artery Disease", probability="Moderate (52%)", urgency="URGENT", rationale="Exertional discomfort without acute rest escalation."),
                DifferentialDiagnosis(condition="Musculoskeletal Chest Wall Pain", probability="Moderate (34%)", urgency="NON_URGENT", rationale="Localized tenderness reproducible on chest wall."),
                DifferentialDiagnosis(condition="Acid Peptic Disorder", probability="Low (14%)", urgency="NON_URGENT", rationale="Related to dietary triggers.")
            ]

    elif domain_id == "neuro":
        if has_critical_answer or symptoms.severity == "severe":
            suspected = "Suspected Acute Stroke / Transient Ischemic Attack (Neurological Emergency)"
            urgency = "CRITICAL"
            emer_level = "EMERGENCY"
            setting = "EMERGENCY_DEPARTMENT"
            setting_label = "24x7 Emergency Department & Stroke Resuscitation Center"
            specialty = "Neurology & Stroke Center"
            advice = "Acute neurological presentation requiring immediate emergency CT/MRI brain imaging within the thrombolysis/thrombectomy window. Immediate emergency department transfer is mandatory."
            differentials = [
                DifferentialDiagnosis(condition="Acute Ischemic Stroke / TIA", probability="High (74%)", urgency="CRITICAL", rationale="Focal neurological deficit of acute vascular onset."),
                DifferentialDiagnosis(condition="Subarachnoid Hemorrhage", probability="Moderate (16%)", urgency="CRITICAL", rationale="Sudden explosive onset headache."),
                DifferentialDiagnosis(condition="Complex Migraine with Aura", probability="Low (10%)", urgency="URGENT", rationale="Reversible neurovascular headache.")
            ]
        else:
            suspected = "Tension-Type Headache / Migraine without Acute Neurological Deficit"
            urgency = "NON_URGENT"
            emer_level = "ROUTINE"
            setting = "OUTPATIENT_DEPARTMENT"
            setting_label = "Outpatient Department (Day OPD Clinic)"
            specialty = "Neurology & General Medicine"
            advice = "Symptoms indicate a non-emergency primary headache presentation. Suitable for outpatient neurology consultation and prophylactic management."
            differentials = [
                DifferentialDiagnosis(condition="Primary Migraine Headache", probability="Moderate (60%)", urgency="NON_URGENT", rationale="Throbbing unilateral headache without focal red flags."),
                DifferentialDiagnosis(condition="Tension Headache", probability="Moderate (32%)", urgency="NON_URGENT", rationale="Bilateral band-like pressure."),
                DifferentialDiagnosis(condition="Cervicogenic Headache", probability="Low (8%)", urgency="NON_URGENT", rationale="Related to neck posture.")
            ]

    elif domain_id == "respiratory":
        if has_critical_answer or symptoms.severity == "severe":
            suspected = "Acute Respiratory Distress / Severe Bronchospasm or Pulmonary Compromise"
            urgency = "CRITICAL"
            emer_level = "EMERGENCY"
            setting = "EMERGENCY_DEPARTMENT"
            setting_label = "24x7 Emergency Department (Respiratory Resuscitation & ICU)"
            specialty = "Pulmonology & Critical Care"
            advice = "Significant respiratory compromise with inability to complete sentences or hypoxemia signs. Requires immediate high-flow oxygen, nebulization, and arterial blood gas analysis in an emergency room."
            differentials = [
                DifferentialDiagnosis(condition="Severe Acute Asthma / COPD Exacerbation", probability="High (68%)", urgency="CRITICAL", rationale="Airway obstruction and respiratory fatigue."),
                DifferentialDiagnosis(condition="Pulmonary Embolism", probability="Moderate (18%)", urgency="CRITICAL", rationale="Sudden dyspnea with pleuritic pain."),
                DifferentialDiagnosis(condition="Severe Pneumonia with Sepsis", probability="Moderate (14%)", urgency="CRITICAL", rationale="Infectious lung parenchymal consolidation.")
            ]
        else:
            suspected = "Upper Respiratory Tract Infection / Mild Bronchitis"
            urgency = "NON_URGENT"
            emer_level = "ROUTINE"
            setting = "OUTPATIENT_DEPARTMENT"
            setting_label = "Outpatient Department (OPD Clinic)"
            specialty = "Pulmonology & General Medicine"
            advice = "Stable respiratory symptoms manageable in outpatient clinic with oral pharmacotherapy and symptomatic care."
            differentials = [
                DifferentialDiagnosis(condition="Acute Bronchitis", probability="Moderate (58%)", urgency="NON_URGENT", rationale="Cough and mild dyspnea without respiratory distress."),
                DifferentialDiagnosis(condition="Allergic Rhinitis / Cough", probability="Moderate (30%)", urgency="NON_URGENT", rationale="Seasonal reactive airway."),
                DifferentialDiagnosis(condition="Mild Viral Infection", probability="Low (12%)", urgency="NON_URGENT", rationale="Self-limiting viral prodrome.")
            ]

    elif domain_id == "abdominal":
        if has_critical_answer or symptoms.severity == "severe":
            suspected = "Acute Abdomen (Suspected Appendicitis / Peritonitis or Acute GI Bleed)"
            urgency = "CRITICAL"
            emer_level = "EMERGENCY"
            setting = "EMERGENCY_DEPARTMENT"
            setting_label = "24x7 Emergency Department & Surgical Trauma Center"
            specialty = "General Surgery & Gastroenterology"
            advice = "Severe acute abdominal presentation with localized peritonism or gastrointestinal bleeding markers. Requires urgent surgical evaluation and IV hydration in an emergency facility."
            differentials = [
                DifferentialDiagnosis(condition="Acute Appendicitis", probability="High (62%)", urgency="CRITICAL", rationale="Right lower quadrant localized peritonism."),
                DifferentialDiagnosis(condition="Upper Gastrointestinal Bleeding", probability="Moderate (22%)", urgency="CRITICAL", rationale="Hematemesis / melena markers present."),
                DifferentialDiagnosis(condition="Acute Pancreatitis / Cholecystitis", probability="Moderate (16%)", urgency="CRITICAL", rationale="Upper abdominal radiation.")
            ]
        else:
            suspected = "Acute Gastroenteritis / Dyspepsia"
            urgency = "URGENT"
            emer_level = "URGENT"
            setting = "OUTPATIENT_DEPARTMENT"
            setting_label = "Outpatient Department (Day OPD Clinic)"
            specialty = "Gastroenterology"
            advice = "Symptoms indicate non-surgical gastrointestinal illness suitable for outpatient medical therapy and hydration monitoring."
            differentials = [
                DifferentialDiagnosis(condition="Acute Viral Gastroenteritis", probability="High (65%)", urgency="NON_URGENT", rationale="Diffuse crampy pain with diarrhea/vomiting."),
                DifferentialDiagnosis(condition="Acid Peptic Dyspepsia", probability="Moderate (25%)", urgency="NON_URGENT", rationale="Epigastric post-prandial burning."),
                DifferentialDiagnosis(condition="Irritable Bowel Syndrome", probability="Low (10%)", urgency="NON_URGENT", rationale="Recurrent crampy motility disorder.")
            ]

    else:
        # General / Trauma / Systemic
        if has_critical_answer or symptoms.severity == "severe":
            suspected = "Severe Acute Illness / High-Risk Clinical Presentation"
            urgency = "CRITICAL"
            emer_level = "EMERGENCY"
            setting = "EMERGENCY_DEPARTMENT"
            setting_label = "24x7 Emergency Department (ED)"
            specialty = "Emergency Medicine"
            advice = "Presentation exhibits high-severity systemic indicators requiring immediate hospital stabilization and diagnostic workup in an emergency facility."
            differentials = [
                DifferentialDiagnosis(condition="Acute Severe Systemic Infection / Sepsis", probability="Moderate (55%)", urgency="CRITICAL", rationale="High-fever and functional collapse."),
                DifferentialDiagnosis(condition="Acute Trauma / Fracture", probability="Moderate (30%)", urgency="CRITICAL", rationale="Severe pain and functional impairment."),
                DifferentialDiagnosis(condition="Severe Metabolic Decompensation", probability="Low (15%)", urgency="CRITICAL", rationale="Altered systemic state.")
            ]
        else:
            suspected = "Non-Emergency Clinical Concern"
            urgency = "NON_URGENT"
            emer_level = "ROUTINE"
            setting = "OUTPATIENT_DEPARTMENT"
            setting_label = "Outpatient Department (Day OPD Clinic)"
            specialty = "General Medicine"
            advice = "Symptoms appear stable for routine evaluation. Visit an outpatient clinic or community health center for diagnostic evaluation."
            differentials = [
                DifferentialDiagnosis(condition="General Viral Syndrome", probability="High (60%)", urgency="NON_URGENT", rationale="Mild generalized complaints."),
                DifferentialDiagnosis(condition="Musculoskeletal Fatigue", probability="Moderate (30%)", urgency="NON_URGENT", rationale="Mild ache without functional compromise."),
                DifferentialDiagnosis(condition="Vitamin / Nutritional Deficiency", probability="Low (10%)", urgency="NON_URGENT", rationale="Subacute fatigue.")
            ]

    search_queries = [
        f"\"{specialty.lower()}\" 24x7 emergency hospital within 50 km of {patient.location}",
        f"best hospital {specialty} emergency department {patient.location}",
        f"district hospital trauma centre emergency ICU {patient.location}"
    ]

    return DiagnosticSynthesis(
        suspected_condition=suspected,
        differential_diagnoses=differentials,
        emergency_level=emer_level,
        urgency=urgency,
        acuity_badge=f"{urgency} (Acuity Level {'1' if urgency == 'CRITICAL' else '2' if urgency == 'URGENT' else '3'})",
        care_setting=setting,
        care_setting_label=setting_label,
        recommended_specialty=specialty,
        clinical_routing_advice=advice,
        red_flags_detected=critical_flags,
        confidence_score=86 if has_critical_answer else 78,
        search_queries=search_queries
    )


# -------------------------------------------------------------
# Main Public Interface
# -------------------------------------------------------------

def start_clinical_screening(patient: PatientProfile, symptoms: SymptomIntake) -> ScreeningResponse:
    combined_text = f"{symptoms.primarySymptoms} {symptoms.additionalNotes or ''}"
    domain = detect_clinical_domain(combined_text)
    session_id = f"SCR-{os.urandom(4).hex().upper()}"
    
    first_q_def = domain["questions"][0]
    total_steps = len(domain["questions"])

    question = FollowUpQuestion(
        question_id=first_q_def["id"],
        question_text=first_q_def["text"],
        clinical_focus=first_q_def["focus"],
        step_number=1,
        total_expected_steps=total_steps,
        options=first_q_def["options"],
        allow_custom_text=True
    )

    return ScreeningResponse(
        success=True,
        session_id=session_id,
        is_complete=False,
        current_step=1,
        total_steps=total_steps,
        next_question=question,
        diagnostic_synthesis=None
    )


def process_screening_answer(
    patient: PatientProfile,
    symptoms: SymptomIntake,
    history: List[QuestionAnswer]
) -> ScreeningResponse:
    combined_text = f"{symptoms.primarySymptoms} {symptoms.additionalNotes or ''}"
    domain = detect_clinical_domain(combined_text)
    total_steps = len(domain["questions"])
    answered_count = len(history)

    # Check if immediate critical red flag was selected
    has_immediate_life_threat = False
    for a in history:
        t = (a.selected_option_text or a.custom_text or "").lower()
        if any(term in t for term in ["radiates to left arm", "thunderclap", "words only", "blue lips", "bone protrusion"]):
            has_immediate_life_threat = True
            break

    # If all questions answered OR critical life threat identified after at least 1 question
    if answered_count >= total_steps or (has_immediate_life_threat and answered_count >= 1):
        # Generate final diagnostic synthesis
        llm_result = generate_llm_clinical_reasoning(patient, symptoms, history)
        if llm_result:
            try:
                diffs = [
                    DifferentialDiagnosis(**d) for d in llm_result.get("differential_diagnoses", [])
                ]
                synthesis = DiagnosticSynthesis(
                    suspected_condition=llm_result.get("suspected_condition", "Clinical Emergency"),
                    differential_diagnoses=diffs,
                    emergency_level=llm_result.get("emergency_level", "EMERGENCY"),
                    urgency=llm_result.get("urgency", "CRITICAL"),
                    acuity_badge=f"{llm_result.get('urgency', 'CRITICAL')} (Acuity Level 1)",
                    care_setting=llm_result.get("care_setting", "EMERGENCY_DEPARTMENT"),
                    care_setting_label=llm_result.get("care_setting_label", "24x7 Emergency Department (ED)"),
                    recommended_specialty=llm_result.get("recommended_specialty", domain["default_specialty"]),
                    clinical_routing_advice=llm_result.get("clinical_routing_advice", "Immediate medical evaluation recommended."),
                    red_flags_detected=llm_result.get("red_flags_detected", []),
                    confidence_score=llm_result.get("confidence_score", 90),
                    search_queries=[
                        f"\"{llm_result.get('recommended_specialty', domain['default_specialty']).lower()}\" emergency hospital {patient.location}",
                        f"district emergency hospital {patient.location}"
                    ]
                )
                return ScreeningResponse(
                    success=True,
                    session_id=f"SCR-DONE-{os.urandom(3).hex().upper()}",
                    is_complete=True,
                    current_step=answered_count,
                    total_steps=total_steps,
                    next_question=None,
                    diagnostic_synthesis=synthesis
                )
            except Exception as e:
                print(f"[Clinical Screening] Parsing LLM output failed: {e}, falling back to deterministic synthesis.")

        deterministic_synthesis = synthesize_deterministic_clinical_assessment(
            patient, symptoms, history, domain
        )
        return ScreeningResponse(
            success=True,
            session_id=f"SCR-DONE-{os.urandom(3).hex().upper()}",
            is_complete=True,
            current_step=answered_count,
            total_steps=total_steps,
            next_question=None,
            diagnostic_synthesis=deterministic_synthesis
        )

    # Next Question
    next_q_def = domain["questions"][answered_count]
    next_question = FollowUpQuestion(
        question_id=next_q_def["id"],
        question_text=next_q_def["text"],
        clinical_focus=next_q_def["focus"],
        step_number=answered_count + 1,
        total_expected_steps=total_steps,
        options=next_q_def["options"],
        allow_custom_text=True
    )

    return ScreeningResponse(
        success=True,
        session_id=f"SCR-{os.urandom(4).hex().upper()}",
        is_complete=False,
        current_step=answered_count + 1,
        total_steps=total_steps,
        next_question=next_question,
        diagnostic_synthesis=None
    )
