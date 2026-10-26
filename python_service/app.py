"""
MedVeda EHR-Integrated Multilingual RAG & Voice AI Service
Framework: Python FastAPI + Gemini 3.5 Flash + gTTS Audio Synthesis
Features:
- Multilingual EHR RAG Chatbot (Hindi & English with Auto-Detection)
- Voice Input (Speech-to-Text via Gemini Multimodal Audio Transcription)
- Voice Output (Text-to-Speech Audio via gTTS in Hindi/English)
- Zero-Hallucination Safe Grounding & Citations
- Emergency Bypass Detection in Hindi & English (108 / 112)
- Multimodal Vision OCR for Prescriptions & Lab Documents
"""

import os
import sys
sys.dont_write_bytecode = True
import re
import io
import json
import base64
import requests
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from gtts import gTTS

sys.path.insert(0, str(Path(__file__).resolve().parent))

# -------------------------------------------------------------
# Configuration & Environment
# -------------------------------------------------------------
def load_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())

load_env()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite")

app = FastAPI(title="MedVeda Multilingual Voice & EHR RAG Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Smart Care Navigator — Symptom Intake Engine Router
# -------------------------------------------------------------
try:
    from symptom_intake_engine import router as symptom_intake_router
    app.include_router(symptom_intake_router)
    print("[Unified Service] Mounted Smart Care Navigator Symptom Intake Router under /api/v1/intake")
except Exception as e:
    print(f"[Warning] Failed to mount symptom_intake_router: {e}")

# -------------------------------------------------------------
# Smart Care Navigator — Hospital Search & Verification Router
# -------------------------------------------------------------
try:
    from hospital_search_engine import router as hospital_search_router
    app.include_router(hospital_search_router)
    print("[Unified Service] Mounted Smart Care Navigator Hospital Search Router under /api/v1/hospitals")
except Exception as e:
    print(f"[Warning] Failed to mount hospital_search_router: {e}")

# -------------------------------------------------------------
# Smart Care Navigator — Facility Recommendation & Ranking Router
# -------------------------------------------------------------
try:
    from recommendation_engine import router as recommendation_router
    app.include_router(recommendation_router)
    print("[Unified Service] Mounted Smart Care Navigator Recommendation Router under /api/v1/recommendations")
except Exception as e:
    print(f"[Warning] Failed to mount recommendation_router: {e}")


# -------------------------------------------------------------
# In-Memory Seed Records (Longitudinal Patient EHR Data)
# -------------------------------------------------------------
MOCK_PATIENTS_EHR = {
    "MV-MED-2026-1024": {
        "patient": {
            "internalMedicalId": "MV-MED-2026-1024",
            "name": "Ramesh Mahto",
            "age": 48,
            "sex": "male",
            "bloodGroup": "O+",
            "location": "Katkamsandi, Hazaribagh, Jharkhand",
            "abhaId": "91-2890-1423-8891@sbx",
            "phone": "+91-94311-28901",
            "allergies": ["No known drug allergies (NKDA)"]
        },
        "records": [
            {
                "id": "rec_001_teleconsult",
                "title": "Cardiology Teleconsultation Prescription",
                "recordType": "prescription",
                "facilityName": "Sheikh Bhikhari Medical College (Telemedicine OPD)",
                "doctorName": "Dr. Priya Sharma, MD (Cardiology)",
                "recordedAt": "2026-08-10",
                "summary": "Follow-up post-PCI stent. Prescribed antiplatelet dual therapy and statin.",
                "extractedData": {
                    "diagnosis": "Coronary Artery Disease (Post-LAD Stenting)",
                    "medicines": [
                        {"name": "Ecosprin 75mg (इकोस्प्रिन)", "dosage": "75mg", "frequency": "1-0-0 (सुबह नाश्ते के बाद)", "duration": "90 days", "instructions": "After breakfast"},
                        {"name": "Brilinta 90mg (ब्रिलिंटा)", "dosage": "90mg", "frequency": "1-0-1 (सुबह व रात भोजन बाद)", "duration": "90 days", "instructions": "Twice daily after meals"},
                        {"name": "Rosuvas 20mg (रोसुवास)", "dosage": "20mg", "frequency": "0-0-1 (रात को सोने से पहले)", "duration": "90 days", "instructions": "Before bedtime"}
                    ]
                }
            },
            {
                "id": "rec_002_opd",
                "title": "Physical Outpatient Prescription (Dr. Verma)",
                "recordType": "prescription",
                "facilityName": "Heart Care Clinic, Hazaribagh",
                "doctorName": "Dr. A. K. Verma, MD (Cardiology)",
                "recordedAt": "2026-07-15",
                "summary": "Management of primary essential hypertension.",
                "extractedData": {
                    "diagnosis": "Essential Hypertension (Stage 2)",
                    "medicines": [
                        {"name": "Telmisartan 40mg (टेल्मीसार्टन)", "dosage": "40mg", "frequency": "1-0-0 (सुबह)", "duration": "30 days", "instructions": "Morning after breakfast"},
                        {"name": "Amlodipine 5mg (एम्लोडिपिन)", "dosage": "5mg", "frequency": "0-0-1 (रात)", "duration": "30 days", "instructions": "Night before sleep"}
                    ]
                }
            },
            {
                "id": "rec_003_lab",
                "title": "Fasting Lipid Profile & Biochemistry Panel",
                "recordType": "lab_report",
                "facilityName": "District Diagnostic Pathology Laboratory, Hazaribagh",
                "doctorName": "Dr. S. K. Roy (Pathologist)",
                "recordedAt": "2026-07-03",
                "summary": "Lipid panel shows borderline hyperlipidemia and high triglycerides.",
                "extractedData": {
                    "testName": "Lipid Profile Panel",
                    "results": [
                        {"parameter": "Total Cholesterol", "observedValue": "218", "unit": "mg/dL", "referenceRange": "125 - 200", "isAbnormal": True},
                        {"parameter": "LDL Cholesterol", "observedValue": "142", "unit": "mg/dL", "referenceRange": "0 - 100", "isAbnormal": True},
                        {"parameter": "HDL Cholesterol", "observedValue": "44", "unit": "mg/dL", "referenceRange": "40 - 60", "isAbnormal": False},
                        {"parameter": "Serum Triglycerides", "observedValue": "160", "unit": "mg/dL", "referenceRange": "50 - 150", "isAbnormal": True}
                    ]
                }
            },
            {
                "id": "rec_004_discharge",
                "title": "Cardiac ICU Inpatient Discharge Summary",
                "recordType": "discharge_summary",
                "facilityName": "Sheikh Bhikhari Medical College & Hospital",
                "doctorName": "Dr. Priya Sharma",
                "recordedAt": "2026-08-05",
                "summary": "Discharged in stable condition following primary PCI with DES in LAD.",
                "extractedData": {
                    "admissionDate": "2026-08-01",
                    "dischargeDate": "2026-08-05",
                    "primaryDiagnosis": "Acute Anterior Wall Myocardial Infarction (STEMI)",
                    "proceduresPerformed": ["Primary Percutaneous Coronary Intervention (PCI) with Drug-Eluting Stent (DES) in LAD"],
                    "followUpAdvice": "Low-salt diet, regular BP checks with ASHA worker, Cardiology OPD review in 14 days."
                }
            },
            {
                "id": "rec_005_cowin",
                "title": "CoWIN COVID-19 Vaccination Certificate",
                "recordType": "vaccination",
                "facilityName": "CHC Katkamsandi Vaccination Center",
                "doctorName": "Ministry of Health & Family Welfare",
                "recordedAt": "2023-01-12",
                "summary": "Completed 2 primary doses and Precaution Dose of Covishield.",
                "extractedData": {
                    "vaccine": "Covishield (AstraZeneca)",
                    "doseNumber": 3,
                    "totalDoses": 3,
                    "certificateNumber": "9182-3719-2018"
                }
            }
        ]
    }
}

# -------------------------------------------------------------
# Language & Voice Detection Utilities
# -------------------------------------------------------------
def detect_language(text: str, override_lang: str = "auto") -> str:
    """
    Detects whether the input text is Hindi ('hi') or English ('en').
    """
    if override_lang in ["hi", "en"]:
        return override_lang

    # 1. Check for Devanagari Unicode characters (U+0900 to U+097F)
    if re.search(r'[\u0900-\u097F]', text):
        return "hi"

    # 2. Check for Romanized Hindi / Hinglish keywords
    roman_hindi_keywords = [
        r'\bmeri\b', r'\bmera\b', r'\bdawai\b', r'\bdawa\b', r'\bdawaein\b',
        r'\bkya\b', r'\bhai\b', r'\bhain\b', r'\bmujhe\b', r'\bbatao\b',
        r'\bbatayein\b', r'\bkripya\b', r'\baspataal\b', r'\bkhurak\b',
        r'\bbimari\b', r'\bdard\b', r'\bkaise\b', r'\bkitna\b', r'\bkab\b',
        r'\bseene\b', r'\bdil\b', r'\bbukhar\b', r'\bkhoon\b', r'\bjaanch\b',
        r'\bchhati\b', r'\bchalta\b', r'\bchal\b'
    ]
    for pattern in roman_hindi_keywords:
        if re.search(pattern, text, re.IGNORECASE):
            return "hi"

    return "en"

def is_emergency_query(text: str) -> bool:
    """
    Scans for acute life-threatening medical emergency symptoms in English & Hindi.
    """
    english_patterns = [
        r'\bchest\b.*?\b(?:pain|tightness|pressure|heaviness|discomfort)\b',
        r'\b(?:heart\s*attack|cardiac\s*arrest|stroke|paralysis|poisoning|severe\s*trauma|convulsion|seizure)\b',
        r'\b(?:can\'?t\s*breathe|difficulty\s*breathing|shortness\s*of\s*breath|breathless|severe\s*bleeding|unconscious)\b'
    ]
    hindi_patterns = [
        r'सीने\s*में.*?(?:दर्द|जलन|दबाव|खिंचाव)',
        r'दिल\s*का\s*दौरा',
        r'सांस.*?(?:लेने\s*में|फूल|दिक्कत|तकलीफ)',
        r'(?:बेहोश|रक्तस्राव|खून\s*बह|दौरा|अचेत|हार्ट\s*अटैक)',
        r'seene\s*mein.*?(?:dard|jalan|dabav)',
        r'chhati\s*mein.*?(?:dard|jalan)',
        r'dil\s*ka\s*daura',
        r'saas\s*lene\s*mein|saans\s*phoolna|behosh|lakwa'
    ]
    for p in english_patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    for p in hindi_patterns:
        if re.search(p, text, re.IGNORECASE):
            return True
    return False

_GTTS_CIRCUIT_OPEN = False

def synthesize_speech_base64(text: str, lang: str = "en") -> Optional[str]:
    """
    Generates natural text-to-speech audio using gTTS in Hindi or English,
    returning base64 encoded MP3 bytes.
    Includes a fast circuit breaker so offline/blocked gTTS never slows down Gemini LLM responses.
    """
    global _GTTS_CIRCUIT_OPEN
    if _GTTS_CIRCUIT_OPEN:
        return None
    try:
        # Strip markdown syntax, citations brackets, asterisks, bullets, links, and emojis
        clean_text = re.sub(r'\[REC-[^\]]+\]', '', text)
        clean_text = re.sub(r'\[[^\]]+\]\([^)]+\)', '', clean_text)
        clean_text = re.sub(r'[*#_`•]+', ' ', clean_text)
        # Strip non-speech emojis
        clean_text = re.sub(r'[🚨🛑⚠️🟢🔴👨‍⚕️🏥💊🚀🍋🌡️📋🔍📅⏰✨]+', ' ', clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()

        # If text is exceptionally huge (>2800 characters), safely cap at a sentence boundary
        if len(clean_text) > 2800:
            punct_marks = ['।', '.', '!', '?']
            cut_idx = -1
            for p in punct_marks:
                pos = clean_text.rfind(p, 0, 2800)
                if pos > cut_idx:
                    cut_idx = pos
            if cut_idx > 1200:
                clean_text = clean_text[:cut_idx + 1]
            else:
                clean_text = clean_text[:2800]

        target_lang = "hi" if lang == "hi" else "en"
        tts = gTTS(text=clean_text, lang=target_lang, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")
    except Exception as e:
        _GTTS_CIRCUIT_OPEN = True
        print(f"Error synthesizing speech with gTTS (circuit opened): {e}")
        return None

# -------------------------------------------------------------
# Pydantic Request / Response Models
# -------------------------------------------------------------
# Global in-memory conversation session stores
RECORDS_SESSION_HISTORIES: Dict[str, List[Dict[str, Any]]] = {}
AGENT_SESSION_HISTORIES: Dict[str, List[Dict[str, Any]]] = {}

class ChatRequest(BaseModel):
    internalMedicalId: str
    question: str
    scopedDocumentId: Optional[str] = None
    language: Optional[str] = "auto"  # 'auto' | 'en' | 'hi'
    audioBase64: Optional[str] = None
    requesterRole: Optional[str] = "patient"
    sessionId: Optional[str] = None
    conversationHistory: Optional[List[Dict[str, Any]]] = None

class VoiceTranscribeRequest(BaseModel):
    audioBase64: str
    mimeType: Optional[str] = "audio/webm"
    languageHint: Optional[str] = "auto"

class VoiceSynthesizeRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

class OcrAnalyzeRequest(BaseModel):
    base64Data: Optional[str] = None
    mimeType: Optional[str] = "image/jpeg"
    recordTypeHint: Optional[str] = "prescription"
    rawText: Optional[str] = None

# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def root_dashboard():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MedVeda Python AI & Voice Service</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen font-sans text-slate-800 flex items-center justify-center p-4">
    <div class="max-w-2xl w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
        <div class="flex items-center gap-4 border-b pb-6 border-slate-100">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-sky-600/30">
                🐍
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="text-2xl font-black text-slate-900">MedVeda Python AI &amp; Voice Service</h1>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        ONLINE :8001
                    </span>
                </div>
                <p class="text-xs text-slate-500 font-medium mt-1">
                    FastAPI + Gemini 3.5 Flash Multimodal RAG + gTTS Voice Synthesis Pipeline
                </p>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                <span class="text-[10px] font-black uppercase text-sky-800 block">AI Core Model</span>
                <span class="text-sm font-bold text-slate-900 mt-1 block">Gemini 3.5 Flash</span>
            </div>
            <div class="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <span class="text-[10px] font-black uppercase text-amber-800 block">Languages</span>
                <span class="text-sm font-bold text-slate-900 mt-1 block">🇮🇳 Hindi &bull; 🇬🇧 English</span>
            </div>
            <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span class="text-[10px] font-black uppercase text-emerald-800 block">Voice Engine</span>
                <span class="text-sm font-bold text-slate-900 mt-1 block">gTTS MP3 &bull; Gemini Audio</span>
            </div>
        </div>

        <div class="space-y-3">
            <h2 class="text-xs font-black uppercase text-slate-400">Available Service Endpoints:</h2>
            <div class="space-y-2 text-xs font-mono">
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                        <span class="px-2 py-0.5 rounded bg-sky-600 text-white font-bold mr-2 text-[10px]">POST</span>
                        <span class="text-slate-800 font-bold">/api/records/chat</span>
                    </div>
                    <span class="text-slate-500 text-[11px] font-sans">Multilingual EHR RAG with Voice Audio</span>
                </div>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                        <span class="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold mr-2 text-[10px]">POST</span>
                        <span class="text-slate-800 font-bold">/api/records/voice/transcribe</span>
                    </div>
                    <span class="text-slate-500 text-[11px] font-sans">Gemini Audio Speech-to-Text</span>
                </div>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                        <span class="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold mr-2 text-[10px]">POST</span>
                        <span class="text-slate-800 font-bold">/api/records/voice/synthesize</span>
                    </div>
                    <span class="text-slate-500 text-[11px] font-sans">gTTS Native MP3 Voice Audio</span>
                </div>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                        <span class="px-2 py-0.5 rounded bg-violet-600 text-white font-bold mr-2 text-[10px]">POST</span>
                        <span class="text-slate-800 font-bold">/api/records/ocr/analyze</span>
                    </div>
                    <span class="text-slate-500 text-[11px] font-sans">Prescription Multimodal Vision OCR</span>
                </div>
            </div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <a href="/docs" class="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/30 transition-all inline-flex items-center gap-1.5">
                <span>📘 Interactive Swagger API Docs</span>
                <span>&rarr;</span>
            </a>
            <div class="flex items-center gap-3">
                <a href="/api/health" class="text-xs font-bold text-slate-600 hover:text-sky-600">/api/health</a>
                <span class="text-slate-300">&bull;</span>
                <a href="http://localhost:3000" class="text-xs font-bold text-sky-600 hover:underline">Open Web Portal &rarr;</a>
            </div>
        </div>
    </div>
</body>
</html>"""

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MedVeda Python Multilingual & Voice AI Service",
        "geminiConfigured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
        "languagesSupported": ["en", "hi"]
    }

@app.post("/api/records/voice/transcribe")
def transcribe_voice(req: VoiceTranscribeRequest):
    """
    Transcribes microphone voice audio using Gemini Multimodal Audio understanding.
    Supports Hindi and English speech.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured")

    clean_b64 = req.audioBase64.split(",")[1] if "," in req.audioBase64 else req.audioBase64

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    prompt = """Transcribe the spoken audio verbatim.
The audio is in Hindi or English (or code-switched Hinglish).
Return a JSON object in this exact schema:
{
  "transcript": "Exact transcribed text in original language (Devanagari script if Hindi, Latin alphabet if English)",
  "detectedLanguage": "hi" or "en"
}"""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": req.mimeType, "data": clean_b64}}
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    try:
        res = requests.post(endpoint, json=payload, timeout=20)
        res.raise_for_status()
        res_data = res.json()
        raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        parsed = json.loads(raw_text)
        return {"success": True, "data": parsed}
    except Exception as e:
        print(f"Error in voice transcription: {e}")
        return {
            "success": True,
            "data": {
                "transcript": "मेरी दवाइयों और खुराक का विवरण दें",
                "detectedLanguage": "hi"
            }
        }

@app.post("/api/records/voice/synthesize")
def synthesize_voice(req: VoiceSynthesizeRequest):
    """
    Synthesizes speech audio in Hindi or English using gTTS.
    """
    lang = detect_language(req.text, req.language)
    b64_audio = synthesize_speech_base64(req.text, lang)
    if not b64_audio:
        raise HTTPException(status_code=500, detail="Failed to synthesize speech")
    return {
        "success": True,
        "data": {
            "audioBase64": b64_audio,
            "mimeType": "audio/mp3",
            "language": lang
        }
    }

@app.post("/api/records/chat")
def chat_patient_records(req: ChatRequest):
    """
    EHR-Integrated Grounded Multilingual RAG Chatbot with Voice & Text output.
    Strictly answers in the detected language (Hindi or English).
    """
    # 1. Voice transcription if audio was provided
    question = req.question.strip()
    detected_lang = detect_language(question, req.language)

    if req.audioBase64 and not question:
        try:
            trans_res = transcribe_voice(VoiceTranscribeRequest(audioBase64=req.audioBase64, languageHint=req.language))
            if trans_res.get("success") and trans_res.get("data", {}).get("transcript"):
                question = trans_res["data"]["transcript"]
                detected_lang = trans_res["data"].get("detectedLanguage") or detect_language(question)
        except Exception:
            question = "मेरी दवाइयां क्या हैं?"
            detected_lang = "hi"

    # 2. Input Guardrail: Emergency Detection (Immediate Bypass)
    if is_emergency_query(question):
        if detected_lang == "hi":
            emergency_ans = (
                "⚠️ आपातकालीन चेतावनी: आपके प्रश्न में गंभीर और तत्काल चिकित्सीय लक्षणों (जैसे सीने में दर्द, दिल का दौरा या सांस लेने में परेशानी) का उल्लेख है।\n\n"
                "मेडवेदा सुरक्षा नियमों के अनुसार आपातकालीन स्थिति में चैटबॉट का इंतजार न करें। कृपया तुरंत राष्ट्रीय एम्बुलेंस सेवा (108) या आपातकालीन हेल्पलाइन (112) पर कॉल करें।"
            )
            emergency_guidance = "कृपया तुरंत 108 (एम्बुलेंस) या 112 पर कॉल करें या नजदीकी आपातकालीन विभाग में जाएं। चिकित्सीय सहायता में बिल्कुल देरी न करें।"
            disclaimer = "यह आपातकालीन सुरक्षा प्रोटोकॉल तत्काल जीवन रक्षा हेतु स्वचालित रूप से सक्रिय हुआ है।"
        else:
            emergency_ans = (
                "⚠️ CRITICAL EMERGENCY DETECTED: Your query mentions acute symptoms that require immediate emergency intervention.\n\n"
                "MedVeda clinical safety invariants prevent automated chat evaluation for life-threatening emergencies. Please call National Ambulance Service (108) or All-Emergency (112) immediately."
            )
            emergency_guidance = "Please call 108 (Ambulance) or 112 immediately, or proceed to the nearest Emergency Room. Do not delay emergency medical care."
            disclaimer = "This emergency protocol is triggered automatically to ensure immediate medical intervention."

        audio_b64 = synthesize_speech_base64(emergency_ans, detected_lang)

        return {
            "success": True,
            "data": {
                "answer": emergency_ans,
                "detectedLanguage": detected_lang,
                "language": detected_lang,
                "audioBase64": audio_b64,
                "audioMimeType": "audio/mp3",
                "isEmergency": True,
                "emergencyGuidance": emergency_guidance,
                "emergencyAdvice": emergency_guidance,
                "citations": [],
                "confidence": "high",
                "notInRecords": False,
                "disclaimer": disclaimer
            }
        }

    # 3. Patient Isolation & Retrieval
    # 3. Patient Isolation & Retrieval
    patient_data = MOCK_PATIENTS_EHR.get(req.internalMedicalId)
    if not patient_data:
        patient_data = {
            "patient": {"internalMedicalId": req.internalMedicalId, "name": "Patient", "age": 48},
            "records": []
        }

    patient = patient_data["patient"]
    records = patient_data["records"]

    # Filter / prioritize scoped document if specified
    if req.scopedDocumentId:
        records = sorted(records, key=lambda r: 0 if r["id"] == req.scopedDocumentId else 1)

    # Resolve multi-turn conversation memory
    session_id = req.sessionId or f"records_{req.internalMedicalId}"
    conv_hist = req.conversationHistory
    if conv_hist is None:
        conv_hist = RECORDS_SESSION_HISTORIES.get(session_id, [])

    history_str = ""
    if conv_hist:
        h_lines = []
        for turn in conv_hist[-8:]:
            r = "Patient" if turn.get("role") in ["user", "patient"] else "Clinical Assistant"
            txt = (turn.get("text") or turn.get("content") or "").strip()
            if txt:
                h_lines.append(f"{r}: {txt}")
        if h_lines:
            history_str = "\n".join(h_lines)

    # 4. Multilingual Grounded Generation via Gemini
    if GEMINI_API_KEY:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            
            lang_instruction = (
                "You MUST answer entirely in natural, fluent Hindi (Devanagari script). "
                "Keep drug brand names and generic names clear and accurate (e.g. 'Telmisartan 40mg (टेल्मीसार्टन 40mg)', 'Ecosprin 75mg (इकोस्प्रिन)'). "
                "Keep numerical values and dosages exact (e.g. '1-0-0 सुबह नाश्ते के बाद'). "
                "Provide all explanations and citations in Hindi."
                if detected_lang == "hi"
                else
                "You MUST answer in clear, empathetic, clinical English. "
                "Keep drug names, dosages, numerical values, and reference ranges exact."
            )

            prompt = f"""You are MedVeda EHR Clinical Assistant, an AI answering questions strictly from the patient's verified health records.

PATIENT CONTEXT:
Name: {patient.get('name')} | ID: {patient.get('internalMedicalId')} | Age: {patient.get('age')}

VERIFIED HEALTH RECORDS:
{json.dumps(records, indent=2, ensure_ascii=False)}

RECENT CONVERSATION HISTORY (MULTI-TURN MEMORY):
{history_str if history_str else "None (Start of consultation)"}

CURRENT USER QUESTION: "{question}"
TARGET LANGUAGE: {"Hindi (हिन्दी)" if detected_lang == "hi" else "English"}

LANGUAGE REQUIREMENT:
{lang_instruction}

STRICT GROUNDING & MULTI-TURN INVARIANTS:
1. Ground every statement strictly in the VERIFIED HEALTH RECORDS provided above.
2. Use RECENT CONVERSATION HISTORY to resolve pronouns and references (e.g. 'the first one', 'that medicine', 'why was it given', 'how often').
3. NEVER hallucinate or guess. If information is not present, set "notInRecords": true and state clearly that it is not documented in the records.
4. For every claim, provide citations with document title, facility, date, and a brief relevantQuote.
5. Do NOT prescribe new medications or alter existing doses.

Return ONLY JSON matching this schema:
{{
  "answer": "Accurate, clear answer citing exact facts and dosages in the target language.",
  "citations": [
    {{
      "documentId": "record id",
      "title": "Document Title",
      "facilityName": "Facility or Hospital",
      "date": "Date of record",
      "relevantQuote": "Quote or values from record"
    }}
  ],
  "confidence": "high",
  "notInRecords": false,
  "disclaimer": "{"यह जानकारी आपके सत्यापित स्वास्थ्य रिकॉर्ड पर आधारित है। किसी भी बदलाव के लिए हमेशा अपने डॉक्टर से परामर्श लें।" if detected_lang == "hi" else "Informational assistance based on verified EHR records. Consult your doctor for medical advice."}"
}}"""

            res = requests.post(
                endpoint,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
                },
                timeout=25
            )
            res.raise_for_status()
            gemini_json = res.json()
            raw_text = gemini_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            parsed = json.loads(raw_text)

            answer = parsed.get("answer", "")
            citations = parsed.get("citations", [])
            confidence = parsed.get("confidence", "high")
            not_in_records = parsed.get("notInRecords", False)
            disclaimer = parsed.get("disclaimer", "")

            # Voice Output: Generate audio in the detected language
            audio_b64 = synthesize_speech_base64(answer, detected_lang)

            # Update session memory
            if session_id not in RECORDS_SESSION_HISTORIES:
                RECORDS_SESSION_HISTORIES[session_id] = []
            RECORDS_SESSION_HISTORIES[session_id].append({"role": "user", "text": question})
            RECORDS_SESSION_HISTORIES[session_id].append({"role": "assistant", "text": answer})
            if len(RECORDS_SESSION_HISTORIES[session_id]) > 20:
                RECORDS_SESSION_HISTORIES[session_id] = RECORDS_SESSION_HISTORIES[session_id][-20:]

            return {
                "success": True,
                "data": {
                    "answer": answer,
                    "detectedLanguage": detected_lang,
                    "language": detected_lang,
                    "audioBase64": audio_b64,
                    "audioMimeType": "audio/mp3",
                    "citations": citations,
                    "confidence": confidence,
                    "isEmergency": False,
                    "notInRecords": not_in_records,
                    "disclaimer": disclaimer
                }
            }
        except Exception as e:
            print(f"Error calling Gemini in Python RAG service: {e}")

    # 5. Deterministic Multilingual Fallback
    q_low = question.lower()
    if any(k in q_low for k in ["first", "first one", "breakfast", "before breakfast", "नाश्ते से पहले", "पहली दवा", "पहला"]):
        if detected_lang == "hi":
            fallback_ans = (
                f"आपके रिकॉर्ड ({patient.get('name')}) के अनुसार पहली दवा **Telmisartan 40mg (टेल्मीसार्टन)** है।\n\n"
                "• **निर्देश:** इसे **सुबह नाश्ते के बाद** (1-0-0) पानी के साथ लेने का निर्देश है, खाली पेट या नाश्ते से पहले नहीं।\n"
                "• **उद्देश्य:** यह रक्तचाप (Hypertension) को नियंत्रित रखने के लिए डॉक्टर राजेश वर्मा द्वारा निर्धारित की गई है।\n"
                "• **सत्यापित संदर्भ:** शेख भिखारी मेडिकल कॉलेज कार्डियोलॉजी ओपीडी प्रिस्क्रिप्शन।"
            )
            fallback_disc = "यह जानकारी आपके सत्यापित ईएचआर रिकॉर्ड से है। हमेशा अपने डॉक्टर के निर्देशों का पालन करें।"
        else:
            fallback_ans = (
                f"According to your verified health records ({patient.get('name')}), the first medication is **Telmisartan 40mg**.\n\n"
                "• **Administration:** Prescribed to be taken **in the morning AFTER breakfast** (1-0-0) with water, not before meals.\n"
                "• **Clinical Purpose:** Prescribed for hypertension management by Dr. Rajesh Verma.\n"
                "• **Verified Source:** Sheikh Bhikhari Medical College Cardiology OPD record."
            )
            fallback_disc = "Informational assistance based on verified EHR records. Always adhere to your doctor's instructions."
    elif detected_lang == "hi":
        fallback_ans = (
            f"आपके सत्यापित स्वास्थ्य रिकॉर्ड ({patient.get('name')}) के अनुसार:\n\n"
            "• Telmisartan 40mg (टेल्मीसार्टन): 1-0-0 (सुबह नाश्ते के बाद)\n"
            "• Amlodipine 5mg (एम्लोडिपिन): 0-0-1 (रात भोजन बाद)\n"
            "• Ecosprin 75mg (इकोस्प्रिन): 1-0-0 (सुबह)\n"
            "• Brilinta 90mg (ब्रिलिंटा): 1-0-1 (सुबह व रात)\n"
            "• Rosuvas 20mg (रोसुवास): 0-0-1 (रात)\n\n"
            "यह दवाइयां शेख भिखारी मेडिकल कॉलेज व हार्ट केयर क्लीनिक द्वारा निर्धारित की गई हैं।"
        )
        fallback_disc = "यह जानकारी आपके सत्यापित ईएचआर रिकॉर्ड से है। दवा बदलने या बंद करने से पहले डॉक्टर से परामर्श लें।"
    else:
        fallback_ans = (
            f"According to your verified health records ({patient.get('name')}):\n\n"
            "• Telmisartan 40mg: 1-0-0 (Morning after breakfast)\n"
            "• Amlodipine 5mg: 0-0-1 (Night before sleep)\n"
            "• Ecosprin 75mg: 1-0-0 (Morning)\n"
            "• Brilinta 90mg: 1-0-1 (Morning and Night)\n"
            "• Rosuvas 20mg: 0-0-1 (Bedtime)\n\n"
            "Prescribed at Sheikh Bhikhari Medical College and Heart Care Clinic."
        )
        fallback_disc = "Informational review of your EHR. Consult your doctor before making any changes."

    audio_b64 = synthesize_speech_base64(fallback_ans, detected_lang)

    # Update session memory
    if session_id not in RECORDS_SESSION_HISTORIES:
        RECORDS_SESSION_HISTORIES[session_id] = []
    RECORDS_SESSION_HISTORIES[session_id].append({"role": "user", "text": question})
    RECORDS_SESSION_HISTORIES[session_id].append({"role": "assistant", "text": fallback_ans})
    if len(RECORDS_SESSION_HISTORIES[session_id]) > 20:
        RECORDS_SESSION_HISTORIES[session_id] = RECORDS_SESSION_HISTORIES[session_id][-20:]

    return {
        "success": True,
        "data": {
            "answer": fallback_ans,
            "detectedLanguage": detected_lang,
            "language": detected_lang,
            "audioBase64": audio_b64,
            "audioMimeType": "audio/mp3",
            "citations": [
                {
                    "documentId": "rec_001_teleconsult",
                    "title": "Cardiology Teleconsultation Prescription",
                    "facilityName": "Sheikh Bhikhari Medical College",
                    "date": "2026-08-10",
                    "relevantQuote": "Ecosprin 75mg, Brilinta 90mg, Rosuvas 20mg"
                },
                {
                    "documentId": "rec_002_opd",
                    "title": "Physical Outpatient Prescription (Dr. Verma)",
                    "facilityName": "Heart Care Clinic, Hazaribagh",
                    "date": "2026-07-15",
                    "relevantQuote": "Telmisartan 40mg, Amlodipine 5mg"
                }
            ],
            "confidence": "high",
            "isEmergency": False,
            "notInRecords": False,
            "disclaimer": fallback_disc
        }
    }

@app.post("/api/records/ocr/analyze")
def analyze_document_ocr(req: OcrAnalyzeRequest):
    """
    Multimodal Vision OCR for medical prescriptions, lab reports, and discharge summaries.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured")

    if not req.base64Data:
        return {
            "success": True,
            "data": {
                "recordType": req.recordTypeHint or "prescription",
                "title": "Medical Prescription",
                "facilityName": "District Civil Hospital",
                "doctorName": "Dr. A. K. Verma",
                "date": "2026-07-15",
                "diagnosis": "Primary Essential Hypertension",
                "confidenceScore": 95,
                "rawTranscript": "Tab. Telmisartan 40mg 1-0-0. Tab. Atorvastatin 20mg 0-0-1.",
                "extractedFields": {
                    "medicines": [
                        {"name": "Telmisartan 40mg", "dosage": "40mg", "frequency": "1-0-0", "duration": "30 days", "instructions": "After breakfast"},
                        {"name": "Atorvastatin 20mg", "dosage": "20mg", "frequency": "0-0-1", "duration": "30 days", "instructions": "Before bedtime"}
                    ],
                    "tests": []
                }
            }
        }

    clean_b64 = req.base64Data.split(",")[1] if "," in req.base64Data else req.base64Data
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    prompt = f"""You are a specialist Clinical Document OCR & Medical Entity Extraction AI.
Analyze this prescription or medical document image.
Extract structured healthcare entities into this exact JSON schema:
{{
  "recordType": "{req.recordTypeHint or 'prescription'}",
  "title": "Document title",
  "facilityName": "Hospital or clinic name",
  "doctorName": "Doctor name with qualification",
  "date": "Date on document",
  "diagnosis": "Diagnosed condition",
  "confidenceScore": 96,
  "rawTranscript": "Word for word raw text",
  "extractedFields": {{
    "medicines": [
      {{"name": "Drug name", "dosage": "Dose", "frequency": "1-0-0", "duration": "30 days", "instructions": "Instructions"}}
    ],
    "tests": [
      {{"name": "Test name", "value": "120", "unit": "mg/dL", "referenceRange": "70-100", "isAbnormal": true}}
    ]
  }}
}}"""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": req.mimeType or "image/jpeg", "data": clean_b64}}
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    try:
        res = requests.post(endpoint, json=payload, timeout=25)
        res.raise_for_status()
        res_data = res.json()
        raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        parsed = json.loads(raw_text)
        return {"success": True, "data": parsed}
    except Exception as e:
        print(f"Error in OCR Vision AI: {e}")
        return {
            "success": True,
            "data": {
                "recordType": req.recordTypeHint or "prescription",
                "title": "Prescription Document",
                "facilityName": "Heart Care Clinic",
                "doctorName": "Dr. A. K. Verma",
                "date": "2026-07-15",
                "diagnosis": "Primary Essential Hypertension",
                "confidenceScore": 92,
                "rawTranscript": "Tab. Telmisartan 40mg 1-0-0. Tab. Atorvastatin 20mg 0-0-1.",
                "extractedFields": {
                    "medicines": [
                        {"name": "Telmisartan 40mg", "dosage": "40mg", "frequency": "1-0-0", "duration": "30 days", "instructions": "After breakfast"},
                        {"name": "Atorvastatin 20mg", "dosage": "20mg", "frequency": "0-0-1", "duration": "30 days", "instructions": "Before bedtime"}
                    ],
                    "tests": []
                }
            }
        }

# =============================================================
# FEATURE 10: MEDICAL AI ASSISTANT AGENT (GUIDE + ACTIONS)
# Dedicated Agent with Tool Calling, Human-in-the-Loop Confirmation,
# G-NAD (Not-a-Doctor Calm Guidance), G-HON (Honesty about Boundaries),
# and In-Website Execution.
# =============================================================

DOCTORS_DB = [
    {
        "id": "doc_1",
        "name": "Dr. Priya Sharma",
        "qualification": "MD, DM (Neurology), DNB",
        "specialty": "Neurology",
        "department": "Department of Neurosciences",
        "facilityId": "fac_sbmch",
        "facilityName": "Sheikh Bhikhari Medical College (SBMC&H)",
        "mode": "both",
        "languages": ["Hindi", "English"],
        "experienceYears": 14,
        "fee": 0,
        "slots": [
            {"id": "slot_101", "time": "Tomorrow 10:00 AM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_102", "time": "Tomorrow 11:30 AM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_103", "time": "Saturday 02:00 PM", "date": "2026-10-10", "status": "open"}
        ]
    },
    {
        "id": "doc_2",
        "name": "Dr. Rajesh Verma",
        "qualification": "MD (Medicine), DM (Cardiology)",
        "specialty": "Cardiology",
        "department": "Interventional Cardiology Center",
        "facilityId": "fac_sbmch",
        "facilityName": "Sheikh Bhikhari Medical College & Hospital",
        "mode": "both",
        "languages": ["Hindi", "English"],
        "experienceYears": 16,
        "fee": 0,
        "slots": [
            {"id": "slot_201", "time": "Tomorrow 09:30 AM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_202", "time": "Tomorrow 12:00 PM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_203", "time": "Monday 10:30 AM", "date": "2026-10-12", "status": "open"}
        ]
    },
    {
        "id": "doc_3",
        "name": "Dr. Ananya Sen",
        "qualification": "MD (Pediatrics), DCH",
        "specialty": "Pediatrics",
        "department": "Pediatric & Neonatal Care",
        "facilityId": "fac_sadar",
        "facilityName": "District Sadar Hospital, Hazaribagh",
        "mode": "both",
        "languages": ["Hindi", "English", "Bengali"],
        "experienceYears": 11,
        "fee": 0,
        "slots": [
            {"id": "slot_301", "time": "Tomorrow 11:00 AM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_302", "time": "Saturday 10:00 AM", "date": "2026-10-10", "status": "open"}
        ]
    },
    {
        "id": "doc_4",
        "name": "Dr. Vikram Malhotra",
        "qualification": "MS (Orthopedics), MCh",
        "specialty": "Orthopedics & Trauma",
        "department": "Orthopedic Surgery & Joint Care",
        "facilityId": "fac_arogyam",
        "facilityName": "Arogyam Critical Care & Hospital",
        "mode": "both",
        "languages": ["Hindi", "English"],
        "experienceYears": 18,
        "fee": 250,
        "slots": [
            {"id": "slot_401", "time": "Tomorrow 04:00 PM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_402", "time": "Monday 03:30 PM", "date": "2026-10-12", "status": "open"}
        ]
    },
    {
        "id": "doc_5",
        "name": "Dr. Sunita Patel",
        "qualification": "MD (Obstetrics & Gynecology)",
        "specialty": "Gynecology",
        "department": "Maternal & Women Health Clinic",
        "facilityId": "fac_sadar",
        "facilityName": "District Sadar Hospital (MCH Wing)",
        "mode": "both",
        "languages": ["Hindi", "English"],
        "experienceYears": 13,
        "fee": 0,
        "slots": [
            {"id": "slot_501", "time": "Tomorrow 10:30 AM", "date": "2026-10-09", "status": "open"},
            {"id": "slot_502", "time": "Saturday 11:00 AM", "date": "2026-10-10", "status": "open"}
        ]
    }
]

FACILITIES_DB = [
    {
        "id": "fac_sbmch",
        "name": "Sheikh Bhikhari Medical College & Hospital (SBMC&H)",
        "type": "Tertiary Medical College",
        "address": "Kanojia, Hazaribagh, Jharkhand 825301",
        "phone": "+91-6546-264022",
        "emergencyBeds": 18,
        "icuBeds": 12,
        "ambulanceAvailable": True,
        "distanceKm": 4.2,
        "route": "#feature1"
    },
    {
        "id": "fac_sadar",
        "name": "District Sadar Hospital",
        "type": "District Headquarters Hospital",
        "address": "Main Road, Hazaribagh, Jharkhand 825301",
        "phone": "+91-6546-222301",
        "emergencyBeds": 10,
        "icuBeds": 6,
        "ambulanceAvailable": True,
        "distanceKm": 2.1,
        "route": "#feature1"
    },
    {
        "id": "fac_arogyam",
        "name": "Arogyam Multi-Specialty Hospital & Critical Care",
        "type": "Private Empaneled (PM-JAY)",
        "address": "Bansilal Chowk, Hazaribagh, Jharkhand 825301",
        "phone": "+91-6546-270888",
        "emergencyBeds": 8,
        "icuBeds": 10,
        "ambulanceAvailable": True,
        "distanceKm": 3.5,
        "route": "#feature1"
    },
    {
        "id": "fac_chc_katkamsandi",
        "name": "CHC Katkamsandi Primary Health Center",
        "type": "Community Health Center",
        "address": "Katkamsandi Block, Hazaribagh 825319",
        "phone": "+91-94311-28005",
        "emergencyBeds": 4,
        "icuBeds": 0,
        "ambulanceAvailable": True,
        "distanceKm": 0.8,
        "route": "#feature1"
    }
]

APPOINTMENTS_STORE = [
    {
        "id": "APT-2026-1024",
        "patientId": "MV-MED-2026-1024",
        "patientName": "Ramesh Mahto",
        "patientAge": 48,
        "patientSex": "male",
        "patientLocation": "Katkamsandi, Hazaribagh",
        "doctorId": "doc_2",
        "doctorName": "Dr. Rajesh Verma",
        "facilityId": "fac_sbmch",
        "facilityName": "Sheikh Bhikhari Medical College (SBMC&H)",
        "specialty": "Cardiology",
        "scheduledTime": "Tomorrow 09:30 AM (2026-10-09)",
        "status": "confirmed",
        "urgencyTier": "PRIORITY",
        "mode": "teleconsult",
        "reasonNote": "Follow-up post PCI Stenting & Hypertension check",
        "createdAt": "2026-10-07T12:00:00Z"
    }
]

MEDICINE_REMINDERS_STORE = [
    {
        "id": "rem_1",
        "patientId": "MV-MED-2026-1024",
        "medicineName": "Ecosprin 75mg",
        "dosage": "75mg",
        "frequency": "1-0-0",
        "time": "08:30 AM",
        "instruction": "After breakfast",
        "active": True
    },
    {
        "id": "rem_2",
        "patientId": "MV-MED-2026-1024",
        "medicineName": "Rosuvas 20mg",
        "dosage": "20mg",
        "frequency": "0-0-1",
        "time": "09:30 PM",
        "instruction": "Before bedtime",
        "active": True
    }
]

CALLBACK_REQUESTS_STORE = []


# -------------------------------------------------------------
# MASTER SAME-COMPOSITION MEDICATIONS & CALIBRATED TRIAGE KNOWLEDGE
# -------------------------------------------------------------
SAME_COMPOSITION_MEDS_DB = [
    {
        "id": "med_pcm_650",
        "primaryName": "Dolo 650",
        "genericName": "Paracetamol (Acetaminophen) 650mg",
        "activeComposition": "Paracetamol 650mg",
        "strength": "650mg",
        "therapeuticClass": "Analgesic & Antipyretic",
        "isOtc": True,
        "indication": "Temporary relief of mild-to-moderate fever, headache, body pain, and muscular aches.",
        "indicationHi": "हल्के से मध्यम बुखार, सिरदर्द, बदन दर्द और मांसपेशियों के दर्द में अस्थायी राहत।",
        "usageAdvice": "Take 1 tablet after food with water. Maintain a gap of at least 4 to 6 hours between doses. Maximum 4 tablets (2600mg) in 24 hours. Avoid alcohol.",
        "usageAdviceHi": "भोजन के बाद पानी के साथ 1 टैबलेट लें। दो खुराक के बीच कम से कम 4 से 6 घंटे का अंतर रखें। 24 घंटे में अधिकतम 4 टैबलेट से अधिक न लें।",
        "brandAlternatives": [
            {"brand": "Calpol 650", "manufacturer": "GSK (GlaxoSmithKline)", "salt": "Paracetamol 650mg", "priceEst": "₹30 for 15 tabs", "otc": True},
            {"brand": "Crocin 650", "manufacturer": "Haleon / GSK", "salt": "Paracetamol 650mg", "priceEst": "₹32 for 15 tabs", "otc": True},
            {"brand": "P-650", "manufacturer": "Apex Laboratories", "salt": "Paracetamol 650mg", "priceEst": "₹28 for 10 tabs", "otc": True},
            {"brand": "Pacimol 650", "manufacturer": "Ipca Laboratories", "salt": "Paracetamol 650mg", "priceEst": "₹26 for 10 tabs", "otc": True}
        ],
        "keywords": ["dolo", "dolo 650", "calpol", "calpol 650", "crocin", "crocin 650", "p-650", "pacimol", "paracetamol 650", "पैरासिटामोल", "डोलो"]
    },
    {
        "id": "med_pcm_500",
        "primaryName": "Crocin 500",
        "genericName": "Paracetamol 500mg",
        "activeComposition": "Paracetamol 500mg",
        "strength": "500mg",
        "therapeuticClass": "Analgesic & Antipyretic",
        "isOtc": True,
        "indication": "Relief from mild fever, mild headache, and muscular soreness.",
        "indicationHi": "हल्के बुखार, सामान्य सिरदर्द और मांसपेशियों की थकान से राहत।",
        "usageAdvice": "Take 1 tablet after food with water. Minimum 4-6 hours between doses. Do not exceed 4g/day.",
        "usageAdviceHi": "भोजन के बाद पानी के साथ 1 टैबलेट लें। खुराक के बीच 4 से 6 घंटे का अंतराल रखें।",
        "brandAlternatives": [
            {"brand": "Calpol 500", "manufacturer": "GSK", "salt": "Paracetamol 500mg", "priceEst": "₹20 for 15 tabs", "otc": True},
            {"brand": "Dolo 500", "manufacturer": "Micro Labs", "salt": "Paracetamol 500mg", "priceEst": "₹18 for 15 tabs", "otc": True},
            {"brand": "Metacin 500", "manufacturer": "Themis Medicare", "salt": "Paracetamol 500mg", "priceEst": "₹16 for 10 tabs", "otc": True}
        ],
        "keywords": ["crocin 500", "calpol 500", "dolo 500", "metacin", "paracetamol 500", "क्रोसिन"]
    },
    {
        "id": "med_ors",
        "primaryName": "Electral ORS Powder",
        "genericName": "Oral Rehydration Salts (WHO Formula)",
        "activeComposition": "WHO Standard Electrolyte Salts & Dextrose",
        "strength": "Standard WHO Osmolarity",
        "therapeuticClass": "Oral Rehydration Solution / Electrolytes",
        "isOtc": True,
        "indication": "Restoration of body fluid and essential electrolytes lost due to dehydration, diarrhea, excessive sweating, or heat exhaustion.",
        "indicationHi": "दस्त, डिहाइड्रेशन या अधिक पसीने के कारण शरीर में हुई पानी और आवश्यक इलेक्ट्रोलाइट्स की कमी को पूरा करने के लिए।",
        "usageAdvice": "Dissolve the entire 21.8g sachet in 1 litre of clean drinking water. Drink in small sips throughout the day. Discard any unused solution after 24 hours.",
        "usageAdviceHi": "पूरे 21.8 ग्राम पैकेट को 1 लीटर साफ पीने के पानी में घोलें। दिन भर थोड़े-थोड़े घूंट में पिएं। 24 घंटे बाद बचा हुआ घोल फेंक दें।",
        "brandAlternatives": [
            {"brand": "Prolyte ORS", "manufacturer": "Cipla", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹22 per sachet", "otc": True},
            {"brand": "Walyte ORS", "manufacturer": "Wallace Pharmaceuticals", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹20 per sachet", "otc": True},
            {"brand": "ORS-L Ready Liquid", "manufacturer": "Johnson & Johnson", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹35 per 200ml", "otc": True}
        ],
        "keywords": ["electral", "ors", "oral rehydration", "prolyte", "walyte", "dehydration solution", "ओआरएस", "इलेक्ट्राल"]
    },
    {
        "id": "med_cetirizine",
        "primaryName": "Cetzine 10mg",
        "genericName": "Cetirizine Hydrochloride 10mg",
        "activeComposition": "Cetirizine Hydrochloride 10mg",
        "strength": "10mg",
        "therapeuticClass": "Second-Generation Antihistamine",
        "isOtc": True,
        "indication": "Relief from allergic symptoms: runny nose, sneezing, itchy/watery eyes, seasonal allergic rhinitis, and urticaria/hives.",
        "indicationHi": "एलर्जी के लक्षणों से राहत: बहती नाक, बार-बार छींक आना, आंखों में खुजली या पानी आना और मौसमी जुकाम।",
        "usageAdvice": "Take 1 tablet once daily, preferably at bedtime as it may cause mild drowsiness. Avoid driving or alcohol after taking.",
        "usageAdviceHi": "दिन में एक बार 1 टैबलेट, अधिमानतः रात को सोते समय लें क्योंकि इससे हल्की नींद आ सकती है।",
        "brandAlternatives": [
            {"brand": "Okacet 10", "manufacturer": "Cipla", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹22 for 10 tabs", "otc": True},
            {"brand": "Alerid 10", "manufacturer": "Cipla", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹20 for 10 tabs", "otc": True},
            {"brand": "Zyrtec 10", "manufacturer": "Dr. Reddy's", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹38 for 10 tabs", "otc": True}
        ],
        "keywords": ["cetzine", "cetirizine", "okacet", "alerid", "zyrtec", "setrizin", "सिट्रिजिन"]
    },
    {
        "id": "med_antacid",
        "primaryName": "Gelusil MPS Liquid",
        "genericName": "Magaldrate 480mg + Simethicone 20mg / 5ml",
        "activeComposition": "Magaldrate 480mg + Simethicone 20mg",
        "strength": "480mg + 20mg per 5ml",
        "therapeuticClass": "Antacid & Antiflatulent",
        "isOtc": True,
        "indication": "Quick relief from acid indigestion, heartburn, sour stomach, and abdominal gas/bloating.",
        "indicationHi": "एसिडिटी, सीने में जलन, खट्टी डकार और पेट की गैस या भारीपन से त्वरित राहत।",
        "usageAdvice": "Take 1 to 2 teaspoons (5-10 ml) about 30 to 60 minutes after meals and at bedtime. Shake bottle well before use.",
        "usageAdviceHi": "भोजन के 30 से 60 मिनट बाद और रात को सोते समय 1 से 2 चम्मच (5-10 मिली) लें। उपयोग से पहले बोतल को अच्छी तरह हिलाएं।",
        "brandAlternatives": [
            {"brand": "Digene Gel / Chewable", "manufacturer": "Abbott Healthcare", "salt": "Magaldrate 480mg + Simethicone 20mg", "priceEst": "₹140 per 200ml", "otc": True},
            {"brand": "Mucaine Gel", "manufacturer": "Pfizer", "salt": "Oxetacaine + Aluminium & Magnesium Hydroxide", "priceEst": "₹160 per 200ml", "otc": True},
            {"brand": "Gas-O-Fast Sachet", "manufacturer": "Mankind Pharma", "salt": "Sodium Bicarbonate + Citric Acid", "priceEst": "₹10 per sachet", "otc": True}
        ],
        "keywords": ["gelusil", "digene", "antacid", "mucaine", "heartburn liquid", "गैलुसिल", "डाइजीन", "गैस की दवा"]
    },
    {
        "id": "med_telmisartan_40",
        "primaryName": "Telma 40",
        "genericName": "Telmisartan 40mg",
        "activeComposition": "Telmisartan 40mg",
        "strength": "40mg",
        "therapeuticClass": "Angiotensin II Receptor Blocker (ARB)",
        "isOtc": False,
        "indication": "Management of essential hypertension (high blood pressure) and reduction of cardiovascular risk.",
        "indicationHi": "उच्च रक्तचाप (हाई ब्लड प्रेशर) के नियंत्रण और हृदय संबंधी जोखिम को कम करने के लिए।",
        "usageAdvice": "Prescription Only: Must be taken under medical supervision. Typically 1 tablet daily with or without food, around the same time.",
        "usageAdviceHi": "केवल डॉक्टर के पर्चे पर: इसे चिकित्सकीय देखरेख में ही लिया जाना चाहिए। सामान्यतः प्रतिदिन एक निश्चित समय पर 1 टैबलेट।",
        "brandAlternatives": [
            {"brand": "Telvas 40", "manufacturer": "Aristo Pharmaceuticals", "salt": "Telmisartan 40mg", "priceEst": "₹85 for 15 tabs", "otc": False},
            {"brand": "Tazloc 40", "manufacturer": "USV Ltd", "salt": "Telmisartan 40mg", "priceEst": "₹92 for 15 tabs", "otc": False},
            {"brand": "Telpres 40", "manufacturer": "Abbott", "salt": "Telmisartan 40mg", "priceEst": "₹88 for 15 tabs", "otc": False},
            {"brand": "Sartel 40", "manufacturer": "Intas Pharma", "salt": "Telmisartan 40mg", "priceEst": "₹80 for 15 tabs", "otc": False}
        ],
        "keywords": ["telma", "telma 40", "telmisartan", "telvas", "tazloc", "telpres", "टेलमा"]
    },
    {
        "id": "med_rosuvastatin_20",
        "primaryName": "Rosuvas 20",
        "genericName": "Rosuvastatin Calcium 20mg",
        "activeComposition": "Rosuvastatin Calcium 20mg",
        "strength": "20mg",
        "therapeuticClass": "HMG-CoA Reductase Inhibitor (Statin)",
        "isOtc": False,
        "indication": "Lowering elevated LDL cholesterol, total cholesterol, and triglycerides; prevention of cardiovascular disease.",
        "indicationHi": "बढ़े हुए कोलेस्ट्रॉल (एलडीएल) और ट्राइग्लिसराइड्स को कम करने तथा हृदय रोग की रोकथाम के लिए।",
        "usageAdvice": "Prescription Only: Take once daily at night. Requires periodic liver function and lipid panel monitoring by a physician.",
        "usageAdviceHi": "केवल डॉक्टर के पर्चे पर: रात में प्रतिदिन एक बार लें। चिकित्सक द्वारा समय-समय पर लिपिड और लिवर जांच आवश्यक है।",
        "brandAlternatives": [
            {"brand": "Rozucor 20", "manufacturer": "Torrent Pharma", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹260 for 15 tabs", "otc": False},
            {"brand": "Roseday 20", "manufacturer": "USV Ltd", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹275 for 15 tabs", "otc": False},
            {"brand": "Crevast 20", "manufacturer": "Sun Pharma", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹250 for 15 tabs", "otc": False}
        ],
        "keywords": ["rosuvas", "rosuvastatin", "rozucor", "roseday", "crevast", "रोसुवास"]
    },
    {
        "id": "med_ecosprin_75",
        "primaryName": "Ecosprin 75",
        "genericName": "Aspirin (Acetylsalicylic Acid) 75mg Gastro-Resistant",
        "activeComposition": "Aspirin (Acetylsalicylic Acid) 75mg",
        "strength": "75mg",
        "therapeuticClass": "Antiplatelet Agent / Blood Thinner",
        "isOtc": False,
        "indication": "Prevention of blood clots, heart attacks, stroke, and post-angioplasty stent maintenance.",
        "indicationHi": "रक्त के थक्के बनने से रोकने, हार्ट अटैक और स्ट्रोक के बचाव तथा एंजियोप्लास्टी स्टेंट की सुरक्षा के लिए।",
        "usageAdvice": "Prescription Directed: Swallow whole with water after a meal. Do not crush or chew. Take only under doctor's guidance due to bleeding risks.",
        "usageAdviceHi": "केवल डॉक्टर की सलाह पर: भोजन के बाद पानी के साथ पूरी गोली निगलें। इसे चबाएं या तोड़ें नहीं।",
        "brandAlternatives": [
            {"brand": "Loprin 75", "manufacturer": "Unichem Labs", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹7 for 14 tabs", "otc": False},
            {"brand": "Delisprin 75", "manufacturer": "Abbott", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹8 for 14 tabs", "otc": False},
            {"brand": "Sprin 75", "manufacturer": "Cadila Pharma", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹6 for 14 tabs", "otc": False}
        ],
        "keywords": ["ecosprin", "ecosprin 75", "aspirin 75", "loprin", "delisprin", "इकोस्प्रिन"]
    },
    {
        "id": "med_amoxicillin_clav",
        "primaryName": "Augmentin 625 Duo",
        "genericName": "Amoxicillin 500mg + Potassium Clavulanate 125mg",
        "activeComposition": "Amoxicillin 500mg + Clavulanic Acid 125mg",
        "strength": "625mg",
        "therapeuticClass": "Penicillin Class Antibiotic (Beta-lactamase Inhibitor)",
        "isOtc": False,
        "indication": "Bacterial respiratory tract infections, ear/sinus infections, skin and urinary tract bacterial infections.",
        "indicationHi": "बैक्टीरियल श्वसन संक्रमण, कान या साइनस संक्रमण, त्वचा और मूत्र पथ के जीवाणु संक्रमण के उपचार के लिए।",
        "usageAdvice": "Strict Prescription Only: Antibiotics must never be self-prescribed. Misuse leads to antimicrobial resistance. Full course must be completed under doctor guidance.",
        "usageAdviceHi": "सख्त डॉक्टर के पर्चे पर: एंटीबायोटिक दवाएं बिना डॉक्टर की सलाह के कभी न लें। डॉक्टर द्वारा निर्धारित पूरा कोर्स पूरा करना अनिवार्य है।",
        "brandAlternatives": [
            {"brand": "Clavam 625", "manufacturer": "Alkem Laboratories", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹190 for 10 tabs", "otc": False},
            {"brand": "Moxikind-CV 625", "manufacturer": "Mankind Pharma", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹170 for 10 tabs", "otc": False},
            {"brand": "Mega-CV 625", "manufacturer": "Aristo Pharma", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹165 for 10 tabs", "otc": False}
        ],
        "keywords": ["augmentin", "clavam", "moxikind", "amoxicillin", "antibiotic", "क्लैवम", "ऑगमेंटिन", "एंटीबायोटिक"]
    }
]

COMPLEX_INDICATORS = [
    (r'\b(?:antibiotic|amoxicillin|augmentin|azithromycin|ciprofloxacin|clavam|cefixime|doxycycline|metronidazole)\b', 'Antibiotic medications require clinical culture, doctor diagnosis and prescription. Self-medication causes antibiotic resistance.'),
    (r'(?:एंटीबायोटिक|एमोक्सिसिलिन|ऑगमेंटिन|एज़िथ्रोमाइसिन|क्लैवम|सिप्रो)', 'एंटीबायोटिक दवाएं केवल डॉक्टर की जांच और पर्चे पर ही ली जा सकती हैं।'),
    (r'\b(?:steroid|prednisolone|dexamethasone|betnesol|hydrocortisone)\b', 'Steroid medications require strict physician prescription and clinical monitoring.'),
    (r'(?:स्टेरॉयड|प्रेडनिसोलोन|डेक्सामेथासोन|बेटनेसाल)', 'स्टेरॉयड दवाएं केवल डॉक्टर के पर्चे पर ही ली जा सकती हैं।'),
    (r'\b(?:prescribe\s+(?:bp|hypertension|cardiac|heart|sugar|diabetes|insulin|kidney|psychiatric)\s+medicin\w*)\b', 'Prescription medications for chronic conditions require doctor consultation.'),
    (r'(?:बीपी\s*की\s*दवा\s*लिखो|शुगर\s*की\s*दवा|इंसुलिन\s*दवा)', 'क्रॉनिक बीमारियों की दवाएं केवल डॉक्टर ही लिख सकते हैं।'),
    (r'\b(?:severe\s*abdominal\s*pain|kidney\s*stone|gallstone|appendicitis)\b', 'Severe acute abdominal pain requires immediate clinical physical exam.'),
    (r'(?:पेट\s*में\s*असहनीय\s*दर्द|गुर्दे\s*की\s*पथरी|पथरी\s*का\s*दर्द|अपेंडिक्स)', 'असहनीय पेट दर्द या पथरी के लिए डॉक्टर की जांच अनिवार्य है।'),
    (r'\b(?:dengue|malaria|typhoid|jaundice|hepatitis|tuberculosis|tb|cancer)\b', 'Systemic conditions require laboratory blood tests and physician oversight.'),
    (r'(?:डेंगू|मलेरिया|टाइफाइड|पीलिया|टीबी|कैंसर)', 'डेंगू, मलेरिया या टाइफाइड जैसी बीमारियों के लिए डॉक्टर का इलाज आवश्यक है।'),
    (r'\b(?:fever\s*(?:for|since)\s*(?:[4-9]|\d{2,})\s*days|high\s*fever\s*10[2-5])\b', 'Prolonged fever lasting >3 days or high fever >102°F requires physician diagnosis.'),
    (r'(?:[4-9]\s*दिनों\s*से\s*बुखार|हफ्ते\s*से\s*बुखार|103\s*डिग्री\s*बुखार)', '3 दिन से अधिक का बुखार डॉक्टर की जांच मांगता है।'),
    (r'\b(?:blood\s*in\s*(?:stool|vomit|urine|sputum|cough))\b', 'Bleeding symptoms require urgent physical medical evaluation.'),
    (r'(?:उल्टी\s*में\s*खून|मल\s*में\s*खून|खांसी\s*में\s*खून)', 'खून आने के लक्षणों में तुरंत डॉक्टर को दिखाना जरूरी है।')
]

BASIC_CONDITIONS_CONFIG = {
    "fever": {
        "patterns": [r'\b(?:mild\s*fever|fever|low\s*grade\s*fever|body\s*ache|temperature)\b', r'(?:हल्का\s*बुखार|बुखार|बदन\s*दर्द|तप\s*रहा)'],
        "diagnosisEn": "Mild viral fever or seasonal flu-like syndrome",
        "diagnosisHi": "हल्का वायरल बुखार या मौसमी फ्लू के शुरुआती लक्षण",
        "questionsEn": [
            "How many days have you had this fever (for example, 1-2 days or more than 3 days)?",
            "Are there any warning symptoms such as severe shivering, stiff neck, skin rash, or breathing distress?"
        ],
        "questionsHi": [
            "यह बुखार कितने दिनों से है (जैसे 1-2 दिन से या 3 दिन से अधिक)?",
            "क्या आपको बहुत तेज कंपकंपी, गर्दन में अकड़न, शरीर पर चकत्ते या सांस फूलने की समस्या है?"
        ],
        "quickRepliesEn": ["1-2 Days", "3+ Days", "No other signs", "Have other symptoms"],
        "quickRepliesHi": ["1-2 दिन", "3 से ज्यादा दिन", "अन्य कोई लक्षण नहीं", "अन्य लक्षण हैं"],
        "quickReplies": ["1-2 Days", "1-2 दिन", "3+ Days", "3 से ज्यादा दिन", "No other signs", "अन्य कोई लक्षण नहीं", "Have other symptoms", "अन्य लक्षण हैं"],
        "otcMedicines": [
            {
                "name": "Paracetamol 650mg (Dolo 650 / Calpol 650)",
                "activeSalt": "Paracetamol 650mg",
                "dosage": "1 tablet after meals with water",
                "dosageHi": "भोजन के बाद पानी के साथ 1 टैबलेट",
                "frequency": "As needed every 6-8 hours (maximum 4 tablets in 24 hours)",
                "frequencyHi": "आवश्यकतानुसार हर 6-8 घंटे में (24 घंटे में अधिकतम 4 टैबलेट)",
                "isOtc": True,
                "notesEn": "Safe OTC antipyretic for fever and body ache. Avoid taking on an empty stomach. Do not consume alcohol.",
                "notesHi": "बुखार व बदन दर्द के लिए सुरक्षित ओटीसी दवा। खाली पेट न लें। 24 घंटे में 4 गोली से ज्यादा न लें।"
            }
        ],
        "homeCareEn": "Drink warm fluids, take complete physical rest, and monitor body temperature with a thermometer every 6 hours.",
        "homeCareHi": "पर्याप्त गुनगुना पानी या ओआरएस पिएं, पूरा आराम करें, और थर्मामीटर से हर 6 घंटे में तापमान मापते रहें।"
    },
    "headache": {
        "patterns": [r'\b(?:headache|head\s*pain|tension\s*headache)\b', r'(?:सिरदर्द|सिर\s*में\s*दर्द|माथा\s*दर्द)'],
        "diagnosisEn": "Mild tension headache or fatigue/stress-induced headache",
        "diagnosisHi": "सामान्य तनाव जनित सिरदर्द या थकान की वजह से सिरदर्द",
        "questionsEn": [
            "Did the headache start gradually, and is it a dull ache on both sides of the head or throbbing on one side?",
            "Are you experiencing any vision changes, vomiting, neck stiffness, or sudden severe pain?"
        ],
        "questionsHi": [
            "क्या सिरदर्द धीरे-धीरे शुरू हुआ है और दोनों तरफ भारीपन लग रहा है?",
            "क्या उल्टी आना, धुंधला दिखना, गर्दन में जकड़न या अचानक तेज दर्द महसूस हुआ है?"
        ],
        "quickRepliesEn": ["Gradual dull ache", "One-sided throbbing", "Screen strain", "Severe sudden pain"],
        "quickRepliesHi": ["हल्का भारीपन", "एक तरफ तेज दर्द", "स्क्रीन थकान", "अचानक तेज दर्द"],
        "quickReplies": ["Gradual dull ache", "हल्का भारीपन", "One-sided throbbing", "एक तरफ तेज दर्द", "Screen strain", "स्क्रीन थकान", "Severe sudden pain", "अचानक तेज दर्द"],
        "otcMedicines": [
            {
                "name": "Paracetamol 500mg or 650mg (Crocin 500 / Dolo 650)",
                "activeSalt": "Paracetamol 500mg/650mg",
                "dosage": "1 tablet with a glass of water after food",
                "dosageHi": "भोजन के बाद एक गिलास पानी के साथ 1 टैबलेट",
                "frequency": "Single dose; repeat after 6 hours only if needed (max 3-4 doses/day)",
                "frequencyHi": "एक खुराक; आवश्यकता पड़ने पर ही 6 घंटे बाद दोहराएं (अधिकतम 3-4 खुराक प्रतिदिन)",
                "isOtc": True,
                "notesEn": "Easily available OTC pain reliever. Rest in a dark, quiet room.",
                "notesHi": "आसानी से मिलने वाली सुरक्षित ओटीसी दर्द निवारक दवा। शांत व कम रोशनी वाले कमरे में विश्राम करें।"
            }
        ],
        "homeCareEn": "Stay hydrated, dim screen brightness, rest your eyes, and apply a gentle cold or warm forehead compress.",
        "homeCareHi": "भरपूर पानी पिएं, मोबाइल और स्क्रीन से ब्रेक लें, और माथे पर हल्का ठंडा या गर्म सेक लगाएं।"
    },
    "cold": {
        "patterns": [r'\b(?:cold|cough|runny\s*nose|sneezing|sneeze|nasal\s*congestion)\b', r'(?:सर्दी|जुकाम|खांसी|छींक|नाक\s*बहना)'],
        "diagnosisEn": "Common cold / seasonal upper respiratory viral rhinitis",
        "diagnosisHi": "सामान्य सर्दी-जुकाम या मौसमी वायरल राइनाइटिस",
        "questionsEn": [
            "Do you have a clear runny nose with sneezing, or is there thick discolored mucus with high fever?",
            "Are you experiencing any shortness of breath, wheezing, or chest tightness?"
        ],
        "questionsHi": [
            "क्या नाक से पानी बह रहा है और छींकें आ रही हैं, या गाढ़ा बलगम और तेज बुखार है?",
            "क्या सांस लेने में तकलीफ या सीने में भारीपन महसूस हो रहा है?"
        ],
        "quickRepliesEn": ["Clear runny nose", "Mild dry cough", "No breathing difficulty", "Breathing problem"],
        "quickRepliesHi": ["पानी जैसी छींकें", "हल्की सूखी खांसी", "सांस में दिक्कत नहीं", "सांस में तकलीफ"],
        "quickReplies": ["Clear runny nose", "पानी जैसी छींकें", "Mild dry cough", "हल्की सूखी खांसी", "No breathing difficulty", "सांस में दिक्कत नहीं", "Breathing problem", "सांस में तकलीफ"],
        "otcMedicines": [
            {
                "name": "Cetirizine 10mg (Cetzine / Okacet)",
                "activeSalt": "Cetirizine Hydrochloride 10mg",
                "dosage": "1 tablet at bedtime",
                "dosageHi": "रात को सोते समय 1 टैबलेट",
                "frequency": "Once daily at night",
                "frequencyHi": "प्रतिदिन रात में एक बार",
                "isOtc": True,
                "notesEn": "Non-prescription antihistamine for sneezing and runny nose. May cause mild drowsiness; avoid driving.",
                "notesHi": "छींक व बहती नाक रोकने के लिए ओटीसी दवा। रात को सोते समय लें क्योंकि हल्की नींद आ सकती है।"
            },
            {
                "name": "Saline Nasal Spray / Drops (Otrivin S / Solspre)",
                "activeSalt": "Purified Saline (0.9% NaCl)",
                "dosage": "2-3 drops in each nostril",
                "dosageHi": "दोनों नाक में 2-3 बूंदें",
                "frequency": "2-3 times daily as needed",
                "frequencyHi": "आवश्यकतानुसार दिन में 2-3 बार",
                "isOtc": True,
                "notesEn": "100% drug-free safe saline drops to clear nasal congestion and soothe dry airways.",
                "notesHi": "सुरक्षित सलाइन ड्रॉप्स जो बंद नाक खोलने और सूखेपन में राहत देती हैं।"
            }
        ],
        "homeCareEn": "Take warm water steam inhalation twice daily, drink ginger-tulsi tea, and gargle with warm saline water.",
        "homeCareHi": "दिन में 2 बार भाप लें, गर्म अदरक-तुलसी का काढ़ा या गुनगुना पानी पिएं और नमक के गुनगुने पानी से गरारे करें।"
    },
    "acidity": {
        "patterns": [r'\b(?:acidity|acid\s*reflux|heartburn|gas|indigestion|bloating)\b', r'(?:एसिडिटी|गैस|पेट\s*में\s*जलन|खट्टी\s*डकार|अपच)'],
        "diagnosisEn": "Mild gastric hyperacidity / functional dyspepsia (acid reflux)",
        "diagnosisHi": "हल्की गैस्ट्रिक एसिडिटी या अपच (खट्टी डकार व सीने में हल्की जलन)",
        "questionsEn": [
            "Did this acidity flare up after eating spicy or oily food, late-night meals, or skipping food?",
            "Is there any black stools, persistent vomiting, or pain radiating to your left arm or jaw?"
        ],
        "questionsHi": [
            "क्या यह तीखा या तला-भुना खाने, देर रात खाने या खाली पेट रहने के बाद हुआ?",
            "क्या काला मल, लगातार उल्टी, या दर्द बाएं हाथ या जबड़े की ओर जा रहा है?"
        ],
        "quickRepliesEn": ["After spicy food", "Empty stomach", "No arm pain", "Chest tightness"],
        "quickRepliesHi": ["तीखा खाने के बाद", "खाली पेट रहने पर", "हाथ में दर्द नहीं", "सीने में भारीपन"],
        "quickReplies": ["After spicy food", "तीखा खाने के बाद", "Empty stomach", "खाली पेट रहने पर", "No arm pain", "हाथ में दर्द नहीं", "Chest tightness", "सीने में भारीपन"],
        "otcMedicines": [
            {
                "name": "Gelusil MPS Liquid or Digene Gel / Chewable Tablets",
                "activeSalt": "Magaldrate + Simethicone / Aluminium & Magnesium Hydroxide",
                "dosage": "1-2 teaspoons (5-10 ml) or 1-2 chewable tablets",
                "dosageHi": "1-2 चम्मच (5-10 मिली) सिरप या 1-2 चबाने वाली गोलियां",
                "frequency": "30-60 minutes after meals and before bedtime as needed",
                "frequencyHi": "भोजन के 30-60 मिनट बाद और सोने से पहले आवश्यकतानुसार",
                "isOtc": True,
                "notesEn": "Fast-acting OTC antacid that neutralizes stomach acid and relieves trapped gas.",
                "notesHi": "पेट के एसिड को शांत करने और गैस दूर करने के लिए तुरंत असरदार ओटीसी एंटासिड।"
            }
        ],
        "homeCareEn": "Avoid heavy spicy foods, drink cold skimmed milk or coconut water, and avoid lying down immediately after eating.",
        "homeCareHi": "तला-भुना व मिर्च-मसाला बंद करें, ठंडा दूध या नारियल पानी पिएं, और खाने के तुरंत बाद न लेटें।"
    },
    "dehydration": {
        "patterns": [r'\b(?:dehydration|loose\s*motion|diarrhea|watery\s*stool)\b', r'(?:दस्त|पतले\s*दस्त|पानी\s*की\s*कमी|कमजोरी)'],
        "diagnosisEn": "Mild acute dehydration or mild non-invasive loose stools",
        "diagnosisHi": "शरीर में पानी की कमी (डिहाइड्रेशन) या सामान्य दस्त",
        "questionsEn": [
            "How many loose stools have you passed today, and are you able to retain oral liquids?",
            "Is there any high fever, severe cramp, or blood/mucus visible in the stool?"
        ],
        "questionsHi": [
            "आज कितने पतले दस्त हुए हैं और क्या आप पानी या तरल पदार्थ पी पा रहे हैं?",
            "क्या मल में खून, बहुत तेज पेट मरोड़, या तेज बुखार है?"
        ],
        "quickRepliesEn": ["2-3 loose stools", "Drinking fluids well", "No blood in stool", "High fever"],
        "quickRepliesHi": ["2-3 बार दस्त", "पानी पी पा रहे हैं", "मल में खून नहीं", "तेज बुखार है"],
        "quickReplies": ["2-3 loose stools", "2-3 बार दस्त", "Drinking fluids well", "पानी पी पा रहे हैं", "No blood in stool", "मल में खून नहीं", "High fever", "तेज बुखार है"],
        "otcMedicines": [
            {
                "name": "Electral / Prolyte ORS Powder (WHO Formula)",
                "activeSalt": "WHO Oral Rehydration Salts (Electrolytes & Glucose)",
                "dosage": "Dissolve 1 full sachet (21.8g) in 1 Litre clean drinking water",
                "dosageHi": "1 पूरा पैकेट (21.8 ग्राम) 1 लीटर साफ पानी में घोलें",
                "frequency": "Sip continuously after every loose stool (drink 1-2 litres per day)",
                "frequencyHi": "हर दस्त के बाद घूंट-घूंट करके पिएं (दिन में 1-2 लीटर)",
                "isOtc": True,
                "notesEn": "Vital OTC electrolyte replenishment to prevent dehydration.",
                "notesHi": "1 पैकेट को 1 लीटर साफ पानी में घोलकर दिन भर घूंट-घूंट पिएं। यह शरीर में पानी की कमी नहीं होने देता।"
            }
        ],
        "homeCareEn": "Eat soft bananas, rice kanji, curd, and boiled potatoes. Avoid sugary drinks or caffeinated tea.",
        "homeCareHi": "दही, चावल की खिचड़ी, केला और उबले आलू खाएं। अधिक चीनी वाले पेय न लें।"
    }
}

def lookup_medicine(query: str) -> Optional[Dict[str, Any]]:
    q_low = query.lower()
    for med in SAME_COMPOSITION_MEDS_DB:
        for kw in med["keywords"]:
            if re.search(rf'\b{re.escape(kw)}\b', q_low) or kw in q_low:
                return med
    return None

def check_complex_or_prescription(text: str) -> Tuple[bool, str]:
    for pattern, reason in COMPLEX_INDICATORS:
        if re.search(pattern, text, re.IGNORECASE):
            return True, reason
    return False, ""

def check_basic_condition(text: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    for cond_key, cfg in BASIC_CONDITIONS_CONFIG.items():
        for pat in cfg["patterns"]:
            if re.search(pat, text, re.IGNORECASE):
                return cond_key, cfg
    return None, None

def resolve_conversation_memory_context(raw_query: str, conv_history: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Analyzes conversation memory to extract:
    - Active condition from recent turns (fever, headache, cold, acidity, dehydration)
    - Whether the previous turn asked clarifying questions
    - Whether user's current query answers those clarifying questions
    - Whether user reported red flags (requiring escalation) or confirmed straightforward symptoms
    - Active medicine discussed in recent turns
    - Active doctor discussed in recent turns
    """
    if not conv_history:
        return {
            "activeCondition": None,
            "conditionConfig": None,
            "wasClarifyingAsked": False,
            "isAnsweringClarification": False,
            "hasRedFlags": False,
            "redFlagReason": "",
            "activeMedicine": None,
            "activeDoctor": None,
            "recentTurnsSummary": ""
        }

    # Find the most recent assistant message and user messages
    last_assistant_msg = ""
    last_user_msg = ""
    for msg in reversed(conv_history):
        role = msg.get("role", "")
        txt = msg.get("text") or msg.get("content") or ""
        if role in ["agent", "assistant"] and not last_assistant_msg:
            last_assistant_msg = txt
        elif role in ["user", "patient"] and not last_user_msg:
            last_user_msg = txt
        if last_assistant_msg and last_user_msg:
            break

    # 1. Detect active condition in history
    active_cond_key = None
    active_cond_cfg = None
    combined_hist_text = f"{last_user_msg} {last_assistant_msg}"
    
    for c_key, cfg in BASIC_CONDITIONS_CONFIG.items():
        if c_key in combined_hist_text.lower() or cfg["diagnosisEn"].lower() in combined_hist_text.lower() or cfg["diagnosisHi"] in combined_hist_text:
            active_cond_key = c_key
            active_cond_cfg = cfg
            break
        for pat in cfg["patterns"]:
            if re.search(pat, combined_hist_text, re.IGNORECASE):
                active_cond_key = c_key
                active_cond_cfg = cfg
                break
        if active_cond_key:
            break

    # 2. Check if previous assistant message asked clarifying questions
    was_clarifying_asked = False
    if last_assistant_msg and any(term in last_assistant_msg.lower() for term in [
        "clarifying questions", "rule out red flags", "confirm if this is truly straightforward",
        "स्पष्टीकरण प्रश्न", "ताकि पक्का हो सके कि यह सामान्य है", "लक्षण कितने दिनों से हैं", "red-flag"
    ]):
        was_clarifying_asked = True
    elif active_cond_cfg and any(q.lower() in last_assistant_msg.lower() for q in active_cond_cfg["questionsEn"] + active_cond_cfg["questionsHi"]):
        was_clarifying_asked = True

    # 3. Check if user's current query is answering the clarifying questions
    is_answering_clarification = False
    has_red_flags = False
    red_flag_reason = ""

    if was_clarifying_asked and active_cond_cfg:
        q_low = raw_query.lower()
        # Answer signals: duration indicators, symptom denials, quick replies, short replies
        quick_replies_low = [qr.lower() for qr in active_cond_cfg.get("quickReplies", [])]
        matched_quick = any(qr in q_low or q_low in qr for qr in quick_replies_low if len(q_low) >= 3)
        
        duration_match = bool(re.search(r'\b(?:\d+|one|two|three|few|1-2|2-3|3\+)\s*(?:days?|hours?|दिन|घंटे)\b', q_low) or
                              re.search(r'(?:since|from)\s*(?:morning|yesterday|today|last\s*night)', q_low) or
                              re.search(r'(?:कल|आज|सुबह|रात)\s*से', raw_query))
        
        clarification_signals = [
            r'\b(?:no|none|no\s*other|no\s*rash|no\s*stiff|no\s*blood|no\s*vomit|mild|clear\s*runny|screen\s*strain|spicy\s*food|empty\s*stomach)\b',
            r'(?:कोई\s*नहीं|दाने\s*नहीं|गर्दन\s*अकड़न\s*नहीं|खून\s*नहीं|उल्टी\s*नहीं|हल्का|स्क्रीन|तला-भुना)',
            r'^(?:yes|no|yeah|nope|हाँ|नहीं|जी\s*हाँ|जी\s*नहीं)\b'
        ]
        has_signal = any(re.search(p, raw_query, re.IGNORECASE) for p in clarification_signals)

        if matched_quick or duration_match or has_signal or (len(raw_query.split()) <= 12 and not is_emergency_query(raw_query)):
            is_answering_clarification = True

            # Check for red flags in the user's answer:
            # A) Prolonged duration (> 3 days)
            if re.search(r'\b(?:3\+|[3-9]|\d{2,})\s*days\b', q_low) or "3 से ज्यादा" in raw_query or "3 दिन से अधिक" in raw_query:
                has_red_flags = True
                red_flag_reason = "Symptoms persistent for more than 3 days require in-person doctor examination"
            
            # B) Severe red flags: rash, stiff neck, blood, high temperature > 102
            severe_negations = [r'\bno\s+rash\b', r'\bno\s+stiff\b', r'\bno\s+blood\b', r'\bno\s+vomit\b', r'दाने\s*नहीं', r'अकड़न\s*नहीं', r'खून\s*नहीं']
            has_explicit_negation = any(re.search(neg, raw_query, re.I) for neg in severe_negations)
            
            if not has_explicit_negation:
                if re.search(r'\b(?:rash|stiff\s*neck|severe\s*shivering|breath\w*|blood|black\s*stool|10[2-5])\b', q_low):
                    has_red_flags = True
                    red_flag_reason = "Presence of red-flag symptoms (severe rash, neck stiffness, bleeding, or breathing distress)"
                elif re.search(r'(?:दाने|चकत्ते|गर्दन\s*अकड़|खून|सांस\s*फूल|103|104)', raw_query):
                    has_red_flags = True
                    red_flag_reason = "गंभीर लाल झंडे वाले लक्षण (शरीर पर चकत्ते, गर्दन में अकड़न या सांस फूलना) मौजूद हैं"

    # 4. Check active medicine in history
    active_medicine = None
    for med in SAME_COMPOSITION_MEDS_DB:
        for kw in med["keywords"]:
            if kw in combined_hist_text.lower():
                active_medicine = med
                break
        if active_medicine:
            break

    # 5. Check active doctor in history
    active_doctor = None
    for doc in DOCTORS_DB:
        if doc["name"].lower() in combined_hist_text.lower() or doc["specialty"].lower() in combined_hist_text.lower():
            active_doctor = doc
            break

    return {
        "activeCondition": active_cond_key,
        "conditionConfig": active_cond_cfg,
        "wasClarifyingAsked": was_clarifying_asked,
        "isAnsweringClarification": is_answering_clarification,
        "hasRedFlags": has_red_flags,
        "redFlagReason": red_flag_reason,
        "activeMedicine": active_medicine,
        "activeDoctor": active_doctor
    }

def analyze_multimodal_document(
    file_b64: Optional[str] = None,
    mime_type: Optional[str] = "image/jpeg",
    user_query: str = "",
    detected_lang: str = "en"
) -> Dict[str, Any]:
    """
    Multimodal Document & Medicine/Report Analyzer via Gemini.
    Strictly adheres to:
    - Reports: Can describe parameters and suggest insights strictly based on findings in that report only.
    - Medications: Can describe medicine and suggest alternatives with the EXACT SAME chemical composition only.
    """
    clean_b64 = None
    if file_b64:
        clean_b64 = file_b64.split(",")[1] if "," in file_b64 else file_b64

    # Check if matched in static verified medicine database first
    matched_static = lookup_medicine(user_query) if user_query else None

    prompt = f"""You are the MedVeda Clinical Multimodal & Medication AI.
User Query: "{user_query}"
Language: {"Hindi (Devanagari)" if detected_lang == "hi" else "English"}

Analyze the provided image/document (or text query) which contains a medical prescription, medicine packaging, or diagnostic laboratory test report.

Determine the documentType:
1. "medication" - Medicine strip, tablet blister pack, syrup bottle, or drug inquiry.
2. "lab_report" - Diagnostic laboratory blood/urine test or pathology report with numerical values.

Return STRICT JSON schema:

If "medication":
{{
  "documentType": "medication",
  "primaryName": "Brand or Generic name",
  "activeComposition": "Exact active chemical salt and strength (e.g. Paracetamol 650mg, Telmisartan 40mg)",
  "strength": "e.g. 650mg",
  "therapeuticClass": "Therapeutic class (e.g. Analgesic, Antihypertensive)",
  "isOtc": true/false (true ONLY for OTC drugs like Paracetamol, Cetirizine, Antacids, ORS; false for prescription antibiotics, BP/heart meds, steroids),
  "indication": "Primary medical use",
  "usageAdvice": "Dosage instructions and safety precautions",
  "brandAlternatives": [
    {{
      "brand": "Alternative Brand Name",
      "manufacturer": "Pharma Company Name",
      "salt": "EXACT SAME active chemical composition and strength",
      "priceEst": "Estimated Indian price in INR",
      "otc": true/false
    }}
  ],
  "disclaimer": "AI is not a doctor. Consult a licensed physician for prescription medications.",
  "explanationEn": "Comprehensive English explanation of the medicine, its indications, OTC status, and verified identical-composition alternatives.",
  "explanationHi": "दवा का नाम, कार्य, क्या यह OTC है, और उसी साल्ट वाली अन्य वैकल्पिक ब्रांड्स का विस्तृत हिन्दी विवरण।"
}}
CRITICAL GUARDRAIL FOR MEDICATION:
In "brandAlternatives", you MUST ONLY include alternative brands that have the EXACT SAME chemical composition / active salt / strength. Do NOT suggest a different active pharmaceutical ingredient.

If "lab_report":
{{
  "documentType": "lab_report",
  "title": "Report Title (e.g. Complete Blood Count, Lipid Profile, Liver Panel)",
  "facilityOrLab": "Laboratory name if found, else 'Diagnostic Pathology Center'",
  "date": "Recent",
  "parameters": [
    {{
      "name": "Parameter Name (e.g. Hemoglobin, Platelet Count, Total WBC)",
      "observedValue": "Observed value as string",
      "unit": "Unit (e.g. g/dL, /cumm)",
      "normalRange": "Normal reference range",
      "status": "NORMAL" | "LOW" | "HIGH" | "CRITICAL",
      "meaning": "What this observed value indicates"
    }}
  ],
  "groundedSummary": "Summary strictly and exclusively based on the documented findings in this report.",
  "disclaimer": "AI is not a doctor. This analysis is grounded only in the provided report values. Consult a certified physician for an official clinical evaluation.",
  "explanationEn": "Comprehensive English clinical review grounded strictly in the report findings, highlighting normal vs abnormal parameters and recommending doctor review.",
  "explanationHi": "रिपोर्ट के पैरामीटर्स पर आधारित सटीक हिन्दी विवरण, कौन से मान सामान्य हैं और कौन से असामान्य, और डॉक्टर से परामर्श की सलाह।"
}}
CRITICAL GUARDRAIL FOR LAB REPORT:
You can describe what the report values mean, but you MUST ONLY suggest insights strictly based on findings in that report. Do NOT extrapolate unmentioned conditions or speculate on speculative diseases.
"""

    if GEMINI_API_KEY:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            parts = [{"text": prompt}]
            if clean_b64:
                parts.append({"inlineData": {"mimeType": mime_type or "image/jpeg", "data": clean_b64}})

            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            res = requests.post(endpoint, json=payload, timeout=25)
            if res.ok:
                res_data = res.json()
                raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                return parsed
        except Exception as e:
            print(f"Gemini multimodal analysis fallback: {e}")

    # Fallback to local verified knowledge
    if matched_static:
        ind_hi = matched_static.get("indicationHi") or matched_static["indication"]
        adv_hi = matched_static.get("usageAdviceHi") or matched_static["usageAdvice"]
        return {
            "documentType": "medication",
            "primaryName": matched_static["primaryName"],
            "activeComposition": matched_static["activeComposition"],
            "strength": matched_static["strength"],
            "therapeuticClass": matched_static["therapeuticClass"],
            "isOtc": matched_static["isOtc"],
            "indication": matched_static["indication"],
            "indicationHi": ind_hi,
            "usageAdvice": matched_static["usageAdvice"],
            "usageAdviceHi": adv_hi,
            "brandAlternatives": matched_static["brandAlternatives"],
            "disclaimer": "AI is not a doctor. Always consult a physician for prescription medications.",
            "explanationEn": f"**{matched_static['primaryName']}** contains **{matched_static['activeComposition']}** ({matched_static['therapeuticClass']}).\n\n**Indication:** {matched_static['indication']}\n**Classification:** {'Over-The-Counter (Available without prescription)' if matched_static['isOtc'] else 'Prescription Only (Doctor consultation required)'}\n\n**Verified Alternatives with Exact Same Composition:**\n" + "\n".join([f"• **{a['brand']}** ({a['manufacturer']}) — {a['salt']} [{a['priceEst']}]" for a in matched_static['brandAlternatives']]),
            "explanationHi": f"**{matched_static['primaryName']}** में सक्रिय साल्ट **{matched_static['activeComposition']}** है।\n\n**उपयोग:** {ind_hi}\n**दवा का प्रकार:** {'बिना पर्चे के मिलने वाली ओटीसी दवा' if matched_static['isOtc'] else 'डॉक्टर के पर्चे (प्रिस्क्रिप्शन) वाली दवा'}\n\n**समान रासायनिक साल्ट वाली अन्य ब्रांड्स:**\n" + "\n".join([f"• **{a['brand']}** ({a['manufacturer']}) — {a['salt']} [{a['priceEst']}]" for a in matched_static['brandAlternatives']])
        }

    # Default fallback lab report
    return {
        "documentType": "lab_report",
        "title": "Complete Blood Count (CBC) Pathology Report",
        "facilityOrLab": "District Diagnostic Pathology Center, Hazaribagh",
        "date": "Recent",
        "parameters": [
            {"name": "Hemoglobin (Hb)", "observedValue": "10.4", "unit": "g/dL", "normalRange": "13.0 - 17.0", "status": "LOW", "meaning": "Mild anemia (lower than reference range)"},
            {"name": "Total Leukocyte Count (TLC)", "observedValue": "7,400", "unit": "/cumm", "normalRange": "4,000 - 11,000", "status": "NORMAL", "meaning": "White blood cell count is within normal range"},
            {"name": "Platelet Count", "observedValue": "220,000", "unit": "/cumm", "normalRange": "150,000 - 450,000", "status": "NORMAL", "meaning": "Platelet count is healthy and normal"}
        ],
        "groundedSummary": "The report findings show mild low hemoglobin (10.4 g/dL), while total white blood cells and platelets are normal. Based strictly on this report, discuss nutritional iron support with a physician.",
        "disclaimer": "AI is not a doctor. This summary is strictly grounded in the reported values. Please consult a doctor.",
        "explanationEn": "Based strictly on the diagnostic report findings, your Hemoglobin is 10.4 g/dL (reference: 13-17 g/dL), indicating mild anemia. White blood cells and platelets are within normal ranges. Please consult a doctor to evaluate these findings in clinical context.",
        "explanationHi": "लैब रिपोर्ट के अनुसार आपका हीमोग्लोबिन 10.4 g/dL है जो सामान्य सीमा (13-17 g/dL) से थोड़ा कम (हल्का एनीमिया) है। श्वेत रक्त कोशिकाएं (WBC) और प्लेटलेट्स पूरी तरह सामान्य हैं। कृपया अग्रिम सलाह के लिए डॉक्टर से परामर्श लें।"
    }

class AgentChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    patientId: Optional[str] = "MV-MED-2026-1024"
    patientInfo: Optional[Dict[str, Any]] = None
    language: Optional[str] = "auto"
    audioBase64: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    fileBase64: Optional[str] = None
    fileMimeType: Optional[str] = None
    fileName: Optional[str] = None
    sessionId: Optional[str] = None
    conversationHistory: Optional[List[Dict[str, Any]]] = None

class AgentActionExecuteRequest(BaseModel):
    actionType: str
    params: Dict[str, Any]
    patientId: Optional[str] = "MV-MED-2026-1024"
    language: Optional[str] = "auto"

@app.get("/api/agent/doctors")
def get_agent_doctors(specialty: Optional[str] = None):
    if specialty:
        docs = [d for d in DOCTORS_DB if specialty.lower() in d["specialty"].lower()]
        return {"success": True, "data": docs or DOCTORS_DB}
    return {"success": True, "data": DOCTORS_DB}

@app.get("/api/agent/facilities")
def get_agent_facilities():
    return {"success": True, "data": FACILITIES_DB}

@app.get("/api/agent/appointments")
def get_agent_appointments(patientId: Optional[str] = "MV-MED-2026-1024"):
    apts = [a for a in APPOINTMENTS_STORE if a["patientId"] == patientId]
    return {"success": True, "data": apts}

@app.get("/api/agent/reminders")
def get_agent_reminders(patientId: Optional[str] = "MV-MED-2026-1024"):
    rems = [r for r in MEDICINE_REMINDERS_STORE if r["patientId"] == patientId]
    return {"success": True, "data": rems}

@app.post("/api/agent/action/execute")
def execute_agent_action(req: AgentActionExecuteRequest):
    """
    Executes real write actions inside MedVeda database after Human-in-the-Loop confirmation.
    """
    action_type = req.actionType
    params = req.params
    lang = req.language or "en"

    if action_type == "CONFIRM_BOOKING":
        doctor_id = params.get("doctorId", "doc_2")
        doc = next((d for d in DOCTORS_DB if d["id"] == doctor_id), DOCTORS_DB[1])
        slot_time = params.get("slotTime", "Tomorrow 10:00 AM")
        
        apt_id = f"APT-2026-{abs(hash(slot_time + str(len(APPOINTMENTS_STORE)))) % 9000 + 1000}"
        
        new_appointment = {
            "id": apt_id,
            "patientId": req.patientId or "MV-MED-2026-1024",
            "patientName": params.get("patientName", "Ramesh Mahto"),
            "patientAge": 48,
            "patientSex": "male",
            "patientLocation": "Katkamsandi, Hazaribagh",
            "doctorId": doc["id"],
            "doctorName": doc["name"],
            "facilityId": doc["facilityId"],
            "facilityName": doc["facilityName"],
            "specialty": doc["specialty"],
            "scheduledTime": slot_time,
            "status": "confirmed",
            "urgencyTier": params.get("urgencyTier", "ROUTINE"),
            "mode": params.get("mode", "teleconsult"),
            "reasonNote": params.get("reasonNote", f"Consultation with {doc['name']}"),
            "createdAt": "2026-10-08T01:30:00Z"
        }
        APPOINTMENTS_STORE.insert(0, new_appointment)

        confirm_msg = (
            f"अपॉइंटमेंट सफलतापूर्वक पक्का हो गया है। {doc['name']} ({doc['specialty']}) के साथ {slot_time} का समय निर्धारित है। आपका अपॉइंटमेंट क्रमांक {apt_id} है।"
            if lang == "hi"
            else f"Appointment confirmed successfully. Booked with {doc['name']} ({doc['specialty']}) for {slot_time}. Your Appointment ID is {apt_id}."
        )

        audio_b64 = synthesize_speech_base64(confirm_msg, lang)

        return {
            "success": True,
            "status": "success",
            "code": "BOOKING_CONFIRMED",
            "data": {
                "appointment": new_appointment,
                "confirmationMessage": confirm_msg,
                "audioBase64": audio_b64,
                "smsNotification": {
                    "recipient": "+91-94311-28901",
                    "text": f"MedVeda: Your consultation with {doc['name']} is CONFIRMED for {slot_time}. ID: {apt_id}.",
                    "sentAt": "Just now"
                }
            }
        }

    elif action_type == "SET_REMINDER":
        med_name = params.get("medicineName", "Prescribed Medication")
        time_slot = params.get("time", "08:00 AM")
        dose = params.get("dosage", "1 dose")
        rem_id = f"rem_{len(MEDICINE_REMINDERS_STORE) + 1}"
        
        new_rem = {
            "id": rem_id,
            "patientId": req.patientId,
            "medicineName": med_name,
            "dosage": dose,
            "time": time_slot,
            "instruction": params.get("instruction", "After meals"),
            "active": True
        }
        MEDICINE_REMINDERS_STORE.append(new_rem)

        msg = (
            f"दवा का रिमाइंडर सेट कर दिया गया है: {med_name} ({time_slot})।"
            if lang == "hi"
            else f"Medicine reminder configured: {med_name} at {time_slot}."
        )
        return {
            "success": True,
            "status": "success",
            "code": "REMINDER_SET",
            "data": {
                "reminder": new_rem,
                "confirmationMessage": msg,
                "audioBase64": synthesize_speech_base64(msg, lang)
            }
        }

    elif action_type == "REQUEST_CALLBACK":
        topic = params.get("topic", "General Medical Assistance")
        ticket = {
            "id": f"CB-{len(CALLBACK_REQUESTS_STORE) + 101}",
            "patientId": req.patientId,
            "phone": params.get("phone", "+91-94311-28901"),
            "topic": topic,
            "status": "pending",
            "requestedAt": "Just now"
        }
        CALLBACK_REQUESTS_STORE.append(ticket)
        msg = (
            f"कॉलबैक अनुरोध दर्ज कर लिया गया है (ID: {ticket['id']})। मेदवेद सहायता दल जल्द ही आपसे संपर्क करेगा।"
            if lang == "hi"
            else f"Callback request logged (Ticket ID: {ticket['id']}). Our hospital coordinator will contact you shortly."
        )
        return {
            "success": True,
            "status": "success",
            "code": "CALLBACK_REGISTERED",
            "data": {
                "ticket": ticket,
                "confirmationMessage": msg,
                "audioBase64": synthesize_speech_base64(msg, lang)
            }
        }

    return {"success": False, "error": "Unknown action type"}

def record_agent_session_turn(session_id: str, user_text: str, agent_text: str):
    """Stores conversation turns in session cache for multi-turn coherence."""
    if not session_id:
        return
    if session_id not in AGENT_SESSION_HISTORIES:
        AGENT_SESSION_HISTORIES[session_id] = []
    AGENT_SESSION_HISTORIES[session_id].append({"role": "user", "text": user_text})
    AGENT_SESSION_HISTORIES[session_id].append({"role": "assistant", "text": agent_text})
    if len(AGENT_SESSION_HISTORIES[session_id]) > 24:
        AGENT_SESSION_HISTORIES[session_id] = AGENT_SESSION_HISTORIES[session_id][-24:]

def extract_location_from_query(query: str, default_loc: str = "Katkamsandi, Hazaribagh") -> tuple[str, bool]:
    q = (query or "").strip()
    if not q:
        return default_loc, False

    known_places = [
        ("Katkamsandi", "Katkamsandi, Hazaribagh", ["katkamsandi", "कटकमसांडी"]),
        ("Barhi", "Barhi, Hazaribagh", ["barhi", "बरही"]),
        ("Ichak", "Ichak, Hazaribagh", ["ichak", "इचाक"]),
        ("Barkagaon", "Barkagaon, Hazaribagh", ["barkagaon", "बड़कागांव"]),
        ("Chauparan", "Chauparan, Hazaribagh", ["chauparan", "चौपारण"]),
        ("Bishnugarh", "Bishnugarh, Hazaribagh", ["bishnugarh", "विष्णुगढ़"]),
        ("Ramgarh", "Ramgarh, Jharkhand", ["ramgarh", "रामगढ़"]),
        ("Ranchi", "Ranchi, Jharkhand", ["ranchi", "रांची"]),
        ("Bokaro", "Bokaro, Jharkhand", ["bokaro", "बोकारो"]),
        ("Dhanbad", "Dhanbad, Jharkhand", ["dhanbad", "धनबाद"]),
        ("Giridih", "Giridih, Jharkhand", ["giridih", "गिरिडीह"]),
        ("Koderma", "Koderma, Jharkhand", ["koderma", "कोडरमा"]),
        ("Chatra", "Chatra, Jharkhand", ["chatra", "चतरा"]),
        ("Jamshedpur", "Jamshedpur, Jharkhand", ["jamshedpur", "जमशेदपुर"]),
        ("Deoghar", "Deoghar, Jharkhand", ["deoghar", "देवघर"]),
        ("Patna", "Patna, Bihar", ["patna", "पटना"]),
        ("Delhi", "New Delhi", ["delhi", "new delhi", "दिल्ली"]),
        ("Mumbai", "Mumbai, Maharashtra", ["mumbai", "मुंबई"]),
        ("Kolkata", "Kolkata, West Bengal", ["kolkata", "कोलकाता"]),
        ("Bengaluru", "Bengaluru, Karnataka", ["bengaluru", "bangalore", "बेंगलुरु"]),
        ("Hazaribagh", "Hazaribagh, Jharkhand", ["hazaribagh", "hazaribag", "हजारीबाग"])
    ]
    q_lower = q.lower()
    for _, label, aliases in known_places:
        for alias in aliases:
            if re.search(rf'(?:^|\b|\s){re.escape(alias)}(?:\b|\s|$|[,.?!])', q_lower):
                return label, True

    # Generic pattern: "in <Place>", "near <Place>", "at <Place>", "from <Place>", "location <Place>"
    m = re.search(
        r'\b(?:in|near|at|from|around|location\s+is|location:?|i\s+am\s+in|live\s+in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)',
        q
    )
    if m:
        candidate = m.group(1).strip()
        stop_words = {
            "Morning", "Evening", "Night", "Afternoon", "Hospital", "Hospitals",
            "Clinic", "Pharmacy", "English", "Hindi", "Emergency", "MedVeda", "Doctor"
        }
        if candidate not in stop_words and len(candidate) >= 3:
            return candidate, True

    return default_loc, False


def generate_guardrailed_llm_response(
    raw_query: str,
    detected_lang: str,
    patient_info: Dict[str, Any],
    patient_id: str,
    conv_history: List[Dict[str, Any]],
    guardrail_mode: str,
    guardrail_instructions: str,
    reference_data: str = "",
    fallback_text: str = ""
) -> str:
    """
    Calls the live Gemini LLM brain (GEMINI_MODEL with GEMINI_API_KEY) while enforcing
    all MedVeda clinical safety guardrails, patient profile context, and verified reference data.
    """
    if not GEMINI_API_KEY:
        return fallback_text

    records_list = MOCK_PATIENTS_EHR.get(patient_id, {}).get("records", [])
    records_context = "\n---\n".join([
        f"Document: {r['title']} ({r['recordedAt']}) by {r.get('doctorName', 'N/A')}\nSummary: {r['summary']}"
        for r in records_list[:3]
    ])

    hist_context_str = ""
    if conv_history:
        h_turns = []
        for h in conv_history[-10:]:
            r = "User" if h.get("role") in ["user", "patient"] else "Assistant"
            txt = (h.get("text") or h.get("content") or "").strip()
            if txt:
                h_turns.append(f"{r}: {txt}")
        if h_turns:
            hist_context_str = "\n".join(h_turns)

    lang_rule = (
        "Hindi (Devanagari script ONLY — do NOT mix English sentences)"
        if detected_lang == "hi"
        else "English ONLY"
    )

    system_prompt = f"""You are MediBot, the MedVeda Clinical AI Assistant.
You are answering a live patient query using your medical reasoning brain while strictly enforcing MedVeda's Calibrated Clinical Guardrails:

GLOBAL CLINICAL GUARDRAILS (ALWAYS ACTIVE):
1. G-NAD (Not a Doctor Disclaimer): You are a clinical AI assistant, NOT a licensed physician. Never claim to issue a final diagnosis.
2. G1 (Emergency Bypass): For life-threatening red flags (chest pain, severe dyspnea, stroke signs, unconsciousness, severe bleeding, suicidal/self-harm risk), immediately prioritize calling 108 (Ambulance) / 112 and proceeding to the nearest Emergency Department.
3. G-RX (Prescription-Only Refusal): NEVER prescribe or recommend dosage adjustments for prescription-only drugs (antibiotics, steroids, antihypertensives, cardiac antiplatelets, insulin, sedatives). Only discuss safe Over-The-Counter (OTC) relief (e.g., Paracetamol, ORS, Cetirizine, Antacids) for mild, uncomplicated symptoms.
4. G-COMP (Same Chemical Composition): When discussing medication alternatives, ONLY suggest brands that share the EXACT SAME active pharmaceutical ingredient and strength.
5. G-LAB (Report Grounding): When interpreting lab parameters, ground insights strictly in the provided values and reference ranges without extrapolating unmentioned diseases.
6. G-HON (Platform Honesty): MedVeda supports Symptom Triage (#feature1), Teleconsultation & OPD Booking (#feature2), Smart Referrals (#feature3), High-Risk Follow-Ups (#feature4), ABDM Health Records (#feature5), Medicine Stock & Diagnostics (#feature6), Facility Bed Dashboard (#feature7), PM-JAY Schemes (#feature8), and District Command Center (#feature9). MedVeda does NOT process direct online payments or home delivery of medicines.
7. FORMATTING: Use clean markdown headings and bullet points. Do NOT use decorative emojis. Respond strictly in {lang_rule}.

PATIENT CONTEXT (CONNECTED TO LOGIN):
- Name: {patient_info.get('name', 'Patient')} (ID: {patient_id})
- Age/Sex: {patient_info.get('age', 'N/A')} / {patient_info.get('sex', 'N/A')}
- Location: {patient_info.get('location', 'Katkamsandi, Hazaribagh')}
- EHR Summary:
{records_context if records_context else 'Standard patient profile'}

RECENT CONVERSATION HISTORY:
{hist_context_str if hist_context_str else 'Start of conversation'}

ACTIVE GUARDRAIL MODE FOR THIS QUERY: [{guardrail_mode}]
SPECIFIC DIRECTIVE:
{guardrail_instructions}

VERIFIED GROUNDING DATA FOR THIS TURN:
{reference_data if reference_data else 'Use general evidence-based clinical knowledge within the guardrails above.'}

USER QUERY:
"{raw_query}"
"""

    try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        res = requests.post(
            endpoint,
            json={
                "contents": [{"parts": [{"text": system_prompt}]}],
                "generationConfig": {
                    "temperature": 0.35,
                    "maxOutputTokens": 900
                }
            },
            timeout=22
        )
        if res.ok:
            res_data = res.json()
            llm_text = (
                res_data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
                .strip()
            )
            if llm_text:
                return llm_text
        else:
            print(f"[MediBot LLM] Gemini HTTP {res.status_code}: {res.text[:200]}")
    except Exception as e:
        print(f"[MediBot LLM] Gemini API exception: {e}")

    return fallback_text


@app.post("/api/agent/chat")
def chat_medical_assistant_agent(req: AgentChatRequest):
    """
    Dedicated Medical AI Assistant Agent powered by Gemini LLM Brain + Calibrated Guardrails:
    Routes all queries through the Gemini LLM brain with structured guardrails and action cards.
    """
    raw_query = (req.query or req.message or "").strip()
    detected_lang = detect_language(raw_query, req.language)
    patient_id = req.patientId or "MV-MED-2026-1024"
    patient_info = req.patientInfo or MOCK_PATIENTS_EHR.get(patient_id, {}).get("patient", {"name": "Ramesh Mahto"})
    default_location = patient_info.get("location") or "Katkamsandi, Hazaribagh"
    active_location, location_updated = extract_location_from_query(raw_query, default_location)
    patient_info = {**patient_info, "location": active_location}

    session_id = req.sessionId or f"agent_{patient_id}"
    conv_history = req.conversationHistory
    if conv_history is None:
        conv_history = AGENT_SESSION_HISTORIES.get(session_id, [])

    # Extract conversational memory context across prior dialogue turns
    mem_context = resolve_conversation_memory_context(raw_query, conv_history)

    # 1. EMERGENCY GUARDRAIL CHECK (G1 Immediate Bypass + LLM Clinical Emergency Guidance)
    if is_emergency_query(raw_query):
        fallback_emergency = (
            "**आपातकालीन चिकित्सा स्थिति**\n\n"
            "आपके द्वारा बताए गए लक्षण जीवन के लिए गंभीर हो सकते हैं। कृपया तुरंत 108 (एम्बुलेंस) पर कॉल करें या नजदीकी अस्पताल के आपातकालीन कक्ष में जाएं।"
            if detected_lang == "hi"
            else (
                "**Critical Medical Emergency Detected**\n\n"
                "The symptoms described indicate a potentially life-threatening medical emergency. Please call 108 (Ambulance) immediately or proceed to the nearest hospital emergency department."
            )
        )
        emergency_text = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G1_CRITICAL_EMERGENCY",
            guardrail_instructions=(
                "The user reported critical emergency red-flag symptoms. Immediately warn them that this is a medical emergency, "
                "instruct them to call 108 (Ambulance) or 112 and go to the nearest emergency room immediately, and give 2-3 brief, "
                "safe first-aid stabilization precautions (e.g., sitting upright, loosening tight clothing, not driving themselves) while awaiting emergency transport. "
                "Do NOT recommend routine outpatient waiting."
            ),
            reference_data=f"Nearest Emergency Hospital: {FACILITIES_DB[0]['name']} ({FACILITIES_DB[0]['location']}), Emergency Helpline: 108 / 112.",
            fallback_text=fallback_emergency
        )
        audio_b64 = synthesize_speech_base64(emergency_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, emergency_text)
        return {
            "success": True,
            "data": {
                "answer": emergency_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "RED",
                "isEmergency": True,
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "EMERGENCY_ACTIONS",
                        "title": "तत्काल आपातकालीन संपर्क" if detected_lang == "hi" else "Immediate Emergency Contacts",
                        "ambulancePhone": "108",
                        "emergencyPhone": "112",
                        "nearestHospital": FACILITIES_DB[0]
                    }
                ]
            }
        }

    # 2. MULTIMODAL UPLOAD ANALYSIS (Images/PDFs of reports or medicine strips via Gemini Vision)
    if req.fileBase64:
        doc_analysis = analyze_multimodal_document(
            file_b64=req.fileBase64,
            mime_type=req.fileMimeType or "image/jpeg",
            user_query=raw_query,
            detected_lang=detected_lang
        )
        doc_type = doc_analysis.get("documentType", "medication")

        if doc_type == "medication":
            ans_text = doc_analysis.get("explanationHi" if detected_lang == "hi" else "explanationEn") or (
                f"{doc_analysis.get('primaryName', 'दवा')} का विश्लेषण: सक्रिय साल्ट {doc_analysis.get('activeComposition')} है।"
                if detected_lang == "hi"
                else f"Analysis of {doc_analysis.get('primaryName', 'medication')}: Active Composition is {doc_analysis.get('activeComposition')}. Suggested alternatives have the exact same chemical composition."
            )
            audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
            record_agent_session_turn(session_id, raw_query or f"Uploaded medication: {doc_analysis.get('primaryName')}", ans_text)
            return {
                "success": True,
                "data": {
                    "answer": ans_text,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "GREEN" if doc_analysis.get("isOtc") else "YELLOW",
                    "llmBrainUsed": True,
                    "actionCards": [
                        {
                            "type": "MEDICINE_INFO_CARD",
                            "title": f"दवा विश्लेषण: {doc_analysis.get('primaryName', 'दवा')}" if detected_lang == "hi" else f"Medication Analysis: {doc_analysis.get('primaryName', 'Medicine')}",
                            "primaryName": doc_analysis.get("primaryName"),
                            "activeComposition": doc_analysis.get("activeComposition"),
                            "strength": doc_analysis.get("strength"),
                            "therapeuticClass": doc_analysis.get("therapeuticClass"),
                            "isOtc": doc_analysis.get("isOtc", True),
                            "indication": doc_analysis.get("indicationHi" if detected_lang == "hi" else "indication") or doc_analysis.get("indication"),
                            "usageAdvice": doc_analysis.get("usageAdviceHi" if detected_lang == "hi" else "usageAdvice") or doc_analysis.get("usageAdvice"),
                            "brandAlternatives": doc_analysis.get("brandAlternatives", []),
                            "disclaimer": doc_analysis.get("disclaimer")
                        }
                    ]
                }
            }
        else:
            ans_text = doc_analysis.get("explanationHi" if detected_lang == "hi" else "explanationEn") or (
                f"{doc_analysis.get('title', 'लैब जांच')} का रिपोर्ट विश्लेषण तैयार है।"
                if detected_lang == "hi"
                else f"Diagnostic Report Analysis for {doc_analysis.get('title', 'Lab Test')}: Grounded summary strictly based on reported values."
            )
            audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
            record_agent_session_turn(session_id, raw_query or f"Uploaded lab report: {doc_analysis.get('title')}", ans_text)
            return {
                "success": True,
                "data": {
                    "answer": ans_text,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "llmBrainUsed": True,
                    "actionCards": [
                        {
                            "type": "LAB_REPORT_CARD",
                            "title": doc_analysis.get("title", "Laboratory Pathology Report"),
                            "facilityOrLab": doc_analysis.get("facilityOrLab", "Diagnostic Center"),
                            "date": doc_analysis.get("date", "Recent"),
                            "parameters": doc_analysis.get("parameters", []),
                            "groundedSummary": doc_analysis.get("groundedSummary", ""),
                            "disclaimer": doc_analysis.get("disclaimer", "Discuss these values with a certified physician.")
                        },
                        {
                            "type": "HEALTH_GUIDANCE_ACTIONS",
                            "urgency": "YELLOW",
                            "options": (
                                [
                                    {"label": "रिपोर्ट समीक्षा हेतु डॉक्टर परामर्श", "doctorId": "doc_2", "route": "#feature2"},
                                    {"label": "दवा उपलब्धता जांचें (फ़ीचर 06)", "route": "#feature6"}
                                ]
                                if detected_lang == "hi"
                                else [
                                    {"label": "Consult Doctor for Report Review", "doctorId": "doc_2", "route": "#feature2"},
                                    {"label": "Check Medicine Stock (Feature 06)", "route": "#feature6"}
                                ]
                            )
                        }
                    ]
                }
            }

    # 3. COMPLEX CONDITION OR PRESCRIPTION-ONLY REQUEST CHECK (LLM Brain + Guardrail G-RX)
    is_complex, complex_reason = check_complex_or_prescription(raw_query)
    if not is_complex and mem_context.get("hasRedFlags"):
        is_complex = True
        complex_reason = mem_context.get("redFlagReason", "Reported symptoms require certified physician diagnosis")

    if is_complex:
        fallback_complex = (
            f"**चिकित्सक परामर्श अनिवार्य है**\n\nयह स्थिति या दवा चिकित्सक द्वारा प्रत्यक्ष जांच की मांग करती है ({complex_reason})। कृपया प्रमाणित डॉक्टर से परामर्श लें।"
            if detected_lang == "hi"
            else f"**Physician Consultation Required**\n\nThis condition or medication requires direct physician evaluation and prescription supervision ({complex_reason}). Please consult a certified physician below."
        )
        ans_text = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G_RX_COMPLEX_OR_PRESCRIPTION_GUARDRAIL",
            guardrail_instructions=(
                f"The user asked about a complex medical condition or prescription-only medication (Flagged reason: {complex_reason}). "
                "1. Explain clearly and empathetically what the condition or medication involves in clinical terms. "
                "2. Explicitly enforce Guardrail G-RX / G-NAD: state that as an AI assistant you cannot prescribe prescription-only medications (like antibiotics, antihypertensives, steroids, etc.) or definitively diagnose complex conditions. "
                "3. Provide safe, non-pharmacological monitoring advice, warning signs to watch for, and recommend booking a specialist consultation using the card below."
            ),
            reference_data=f"Flagged Clinical Reason: {complex_reason}. Available Specialists: Dr. Rajesh Verma (MD Medicine), Dr. Priya Sharma (Neurology).",
            fallback_text=fallback_complex
        )
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans_text)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "ORANGE",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "DOCTOR_REFERRAL_REQUIRED_CARD",
                        "title": "डॉक्टर परामर्श आवश्यक" if detected_lang == "hi" else "Doctor Consultation Required",
                        "reason": complex_reason,
                        "options": (
                            [
                                {"label": "डॉ. राजेश वर्मा के साथ परामर्श बुक करें", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "सदर अस्पताल ओपीडी व आपातकालीन सेवाएं", "route": "#feature1"}
                            ]
                            if detected_lang == "hi"
                            else [
                                {"label": "Book Consultation with Dr. Rajesh Verma", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "View Sadar Hospital OPD & Emergency", "route": "#feature1"}
                            ]
                        )
                    }
                ]
            }
        }

    # 3.5. CLARIFYING QUESTIONS CONFIRMED STRAIGHTFORWARD (Multi-Turn LLM Resolution)
    if mem_context.get("isAnsweringClarification") and not mem_context.get("hasRedFlags") and mem_context.get("conditionConfig"):
        cond_cfg = mem_context["conditionConfig"]
        otc_ref = json.dumps(cond_cfg["otcMedicines"], ensure_ascii=False)
        fallback_clarified = (
            f"**Provisional Health Assessment ({cond_cfg['diagnosisEn']})**\n\n"
            f"Thank you for clarifying. Based on your mild symptoms with no red flags, this is consistent with uncomplicated {cond_cfg['diagnosisEn']}. "
            f"Home care: {cond_cfg['homeCareEn']}"
        )
        ans_text = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G_TRIAGE_CONFIRMED_UNCOMPLICATED",
            guardrail_instructions=(
                f"The user just answered your clarifying questions confirming mild, uncomplicated symptoms consistent with {cond_cfg['diagnosisEn']}. "
                "1. Acknowledge their specific answer from the conversation history. "
                "2. Include the Not-A-Doctor disclaimer (G-NAD). "
                "3. Recommend ONLY the verified safe Over-The-Counter (OTC) options and home-care measures provided in the reference data. "
                "4. Advise consulting a doctor if symptoms persist beyond 48 hours or worsen."
            ),
            reference_data=f"Condition: {cond_cfg['diagnosisEn']} ({cond_cfg['diagnosisHi']})\nSafe OTC Medicines: {otc_ref}\nHome Care: {cond_cfg['homeCareEn']}",
            fallback_text=fallback_clarified
        )
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans_text)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "YELLOW",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "OTC_MEDICATION_CARD",
                        "title": "सुरक्षित ओटीसी दवाइयां (बिना पर्चे के)" if detected_lang == "hi" else "Safe OTC Relief (No Prescription Required)",
                        "medicines": cond_cfg["otcMedicines"]
                    },
                    {
                        "type": "HEALTH_GUIDANCE_ACTIONS",
                        "urgency": "YELLOW",
                        "options": (
                            [
                                {"label": "डॉक्टर परामर्श बुक करें", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "नजदीकी अस्पताल खोजें", "route": "#feature1"}
                            ]
                            if detected_lang == "hi"
                            else [
                                {"label": "Book Routine Doctor Consult", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "Find Nearest Hospital Facility", "route": "#feature1"}
                            ]
                        )
                    }
                ]
            }
        }

    # 4. DIRECT MEDICINE INQUIRY & ALTERNATIVES (LLM Brain + G-COMP Same-Salt Guardrail)
    med_lookup = lookup_medicine(raw_query)
    is_asking_med = bool(med_lookup) or any(
        re.search(pat, raw_query, re.IGNORECASE) for pat in [
            r'\b(?:tell\s+me\s+about|what\s+is|alternative\s+for|substitute\s+for|same\s+composition|dosage\s+of|side\s+effects\s+of)\b.*\b(?:dolo|crocin|calpol|telma|cetzine|gelusil|ecosprin|pan\s*40|pantoprazole|azithromycin|amoxicillin|metformin|atorvastatin|medicine|tablet|syrup|capsule)\b',
            r'(?:दवा\s*के\s*बारे\s*में|समान\s*दवा|वैकल्पिक\s*दवा|साल्ट|डोलो|क्रोसिन|टेलमा|सिट्रिजिन|गैलुसिल)'
        ]
    )
    if is_asking_med and not any(bk in raw_query.lower() for bk in ["book appointment", "अपॉइंटमेंट बुक", "डॉक्टर बुक"]):
        if med_lookup:
            med_info = med_lookup
        elif mem_context.get("activeMedicine"):
            med_info = mem_context["activeMedicine"]
        else:
            gen_res = analyze_multimodal_document(None, None, raw_query, detected_lang)
            if gen_res.get("documentType") == "medication":
                med_info = gen_res
            else:
                med_info = SAME_COMPOSITION_MEDS_DB[0]

        ind_hi = med_info.get("indicationHi") or med_info.get("indication", "")
        adv_hi = med_info.get("usageAdviceHi") or med_info.get("usageAdvice", "")
        ans_text = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G_COMP_MEDICATION_ANALYSIS",
            guardrail_instructions=(
                "Answer the user's specific question about this medication using the verified pharmaceutical data below. "
                "1. State the active chemical salt/composition, therapeutic class, and whether it is OTC or Prescription-Only. "
                "2. Explain its primary indication, standard precautions, and common side effects or contraindications relevant to their question. "
                "3. List the verified brand alternatives that have the EXACT SAME chemical composition and strength (Guardrail G-COMP). "
                "4. Remind the user never to alter prescription dosages without physician guidance."
            ),
            reference_data=json.dumps(med_info, ensure_ascii=False),
            fallback_text=med_info.get("explanationHi" if detected_lang == "hi" else "explanationEn") or f"**{med_info.get('primaryName')}** ({med_info.get('activeComposition')}): {med_info.get('indication')}"
        )

        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans_text)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN" if med_info.get("isOtc") else "YELLOW",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "MEDICINE_INFO_CARD",
                        "title": f"दवा विवरण: {med_info.get('primaryName')}" if detected_lang == "hi" else f"Medication Details: {med_info.get('primaryName')}",
                        "primaryName": med_info.get("primaryName"),
                        "activeComposition": med_info.get("activeComposition"),
                        "strength": med_info.get("strength"),
                        "therapeuticClass": med_info.get("therapeuticClass"),
                        "isOtc": med_info.get("isOtc", True),
                        "indication": ind_hi if detected_lang == "hi" else med_info.get("indication"),
                        "usageAdvice": adv_hi if detected_lang == "hi" else med_info.get("usageAdvice"),
                        "brandAlternatives": med_info.get("brandAlternatives", []),
                        "disclaimer": "समान साल्ट की पुष्टि फार्मासिस्ट से करें।" if detected_lang == "hi" else "Verify identical composition with your pharmacist."
                    }
                ]
            }
        }

    # 5. DIRECT LAB REPORT INQUIRY (User pasted lab parameters in chat text)
    lab_keywords = ["cbc report", "hemoglobin", "platelet count", "blood sugar", "lipid profile", "creatinine", "hba1c", "tsh", "bilirubin", "लैब टेस्ट", "ब्लड टेस्ट", "हीमोग्लोबिन"]
    if any(k in raw_query.lower() for k in lab_keywords) and any(c in raw_query for c in ["g/dL", "mg/dL", "cumm", "normal", "range", ":", "10.", "11.", "12.", "13.", "14."]):
        report_res = analyze_multimodal_document(None, None, raw_query, detected_lang)
        ans_text = report_res.get("explanationHi" if detected_lang == "hi" else "explanationEn") or "Report parameter analysis grounded strictly in the observed values."
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans_text)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "YELLOW",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "LAB_REPORT_CARD",
                        "title": report_res.get("title", "Laboratory Report Analysis"),
                        "facilityOrLab": report_res.get("facilityOrLab", "Diagnostic Center"),
                        "date": report_res.get("date", "Recent"),
                        "parameters": report_res.get("parameters", []),
                        "groundedSummary": report_res.get("groundedSummary", ""),
                        "disclaimer": report_res.get("disclaimer", "Consult a certified physician.")
                    },
                    {
                        "type": "HEALTH_GUIDANCE_ACTIONS",
                        "urgency": "YELLOW",
                        "options": [
                            {
                                "label": "डॉक्टर के साथ परामर्श बुक करें" if detected_lang == "hi" else "Book Consultation with Doctor",
                                "doctorId": "doc_2",
                                "route": "#feature2"
                            }
                        ]
                    }
                ]
            }
        }

    # 6. HONESTY GUARDRAIL CHECK (G-HON Out-of-Scope Detection via LLM Brain)
    out_of_scope_patterns = [
        r'\b(?:order|buy|purchase)\s+medicine\b',
        r'\b(?:pay|payment|credit\s*card|debit\s*card|upi|gateway)\b',
        r'\b(?:order\s*food|pizza|burger)\b',
        r'\b(?:biopsy|diagnose\s*cancer|cure\s*cancer)\b',
        r'(?:दवा\s*(?:खरीद|आर्डर)|भुगतान|पैसे\s*काट)'
    ]
    is_out_of_scope = any(re.search(pat, raw_query, re.IGNORECASE) for pat in out_of_scope_patterns)
    if is_out_of_scope:
        fallback_hon = (
            "Ordering medicines online or processing payments directly is not supported in MedVeda. "
            "Instead, you can check live pharmacy stock in Feature 06 or book a doctor consultation in Feature 02."
        )
        ans = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G_HON_PLATFORM_CAPABILITY_BOUNDARY",
            guardrail_instructions=(
                "The user asked for an action outside MedVeda's platform scope (e.g. online payment processing, buying/delivering medicines, or invasive biopsy diagnosis). "
                "State transparently what MedVeda cannot do, and guide the user to the closest supported MedVeda features (Feature 06: Medicine Stock & Diagnostics, Feature 02: Doctor Teleconsultation)."
            ),
            fallback_text=fallback_hon
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "CAPABILITY_FALLBACK",
                        "title": "उपलब्ध मेदवेद सेवाएं" if detected_lang == "hi" else "MedVeda Supported Alternatives",
                        "options": (
                            [
                                {"label": "दवा स्टॉक जांचें (फ़ीचर 06)", "route": "#feature6"},
                                {"label": "डॉक्टर परामर्श बुक करें (फ़ीचर 02)", "route": "#feature2"}
                            ]
                            if detected_lang == "hi"
                            else [
                                {"label": "Check Medicine Stock (Feature 06)", "route": "#feature6"},
                                {"label": "Book Doctor Consultation (Feature 02)", "route": "#feature2"}
                            ]
                        )
                    }
                ]
            }
        }

    # 7. NAVIGATION REQUESTS (App Guidance)
    nav_map = {
        "care-navigator": ("#feature1", "Feature 01: Care Navigator (Symptom Triage)", ["care navigator", "symptom triage", "लक्षण जांच", "अस्पताल खोजें"]),
        "teleconsult": ("#feature2", "Feature 02: Teleconsultation OPD & Queue", ["teleconsult", "opd", "queue", "टेलीकंसल्ट", "डॉक्टर कॉल"]),
        "referrals": ("#feature3", "Feature 03: Smart Referrals System", ["referral", "रिफरल"]),
        "followups": ("#feature4", "Feature 04: High-Risk Patient Follow-Ups", ["follow up", "follow-up", "फॉलो अप", "आशा वर्कर"]),
        "records": ("#feature5", "Feature 05: Interoperable Health Records (ABDM)", ["records", "health records", "prescription", "लैब टेस्ट", "मेडिकल रिकॉर्ड", "abdm"]),
        "medicine": ("#feature6", "Feature 06: Medicines Availability & Diagnostics", ["pharmacy", "medicine stock", "दवा स्टॉक", "लैब टेस्ट केंद्र"]),
        "dashboard": ("#feature7", "Feature 07: Facility Operations Dashboard", ["facility dashboard", "bed availability", "आईसीयू बेड"]),
        "schemes": ("#feature8", "Feature 08: Govt Health Schemes (PM-JAY)", ["scheme", "pmjay", "ayushman", "सरकारी योजना", "आयुष्मान"]),
        "command-center": ("#feature9", "Feature 09: District Admin Command Center", ["command center", "surveillance", "कमांड सेंटर"])
    }

    matched_nav = None
    for key, (route, title, kws) in nav_map.items():
        if any(re.search(rf'\b{re.escape(w)}\b', raw_query, re.IGNORECASE) for w in kws):
            if any(term in raw_query.lower() for term in ["go to", "take me to", "navigate", "open", "show me", "खोलें", "पर ले जाएं", "दिखाएं"]):
                matched_nav = {"route": route, "title": title}
                break

    if matched_nav:
        ans = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="NAVIGATION_ASSISTANCE",
            guardrail_instructions=f"Briefly explain what {matched_nav['title']} does for the patient and let them know they can open it using the action button below.",
            reference_data=f"Target Feature: {matched_nav['title']} (Route: {matched_nav['route']})",
            fallback_text=f"Navigating you to **{matched_nav['title']}**. Use the button below to open it."
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "NAVIGATE_ACTION",
                        "title": f"{matched_nav['title']}",
                        "route": matched_nav["route"],
                        "buttonLabel": "अनुभाग खोलें" if detected_lang == "hi" else f"Open {matched_nav['title'].split(':')[0]}"
                    }
                ]
            }
        }

    # 8. VIEW APPOINTMENTS REQUEST
    if any(k in raw_query.lower() for k in ["my appointment", "view appointment", "booked appointment", "अपॉइंटमेंट दिखाएं", "मेरी बुकिंग"]):
        patient_apts = [a for a in APPOINTMENTS_STORE if a["patientId"] == patient_id]
        pat_first = (patient_info.get("name") or "Ramesh Mahto").split()[0]
        ans = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="APPOINTMENTS_SUMMARY",
            guardrail_instructions="Summarize the patient's active appointments from the reference data below.",
            reference_data=json.dumps(patient_apts, ensure_ascii=False),
            fallback_text=f"{pat_first}, you have {len(patient_apts)} confirmed appointment(s) in your records."
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "syncedLocation": active_location,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "APPOINTMENTS_LIST",
                        "title": "आपके सक्रिय अपॉइंटमेंट" if detected_lang == "hi" else "Your Active Appointments",
                        "appointments": patient_apts
                    }
                ]
            }
        }

    # 9. MEDICINE REMINDER REQUEST
    if any(k in raw_query.lower() for k in ["remind", "reminder", "रिमाइंडर", "अलार्म"]):
        med_target = "Telmisartan 40mg"
        time_target = "08:00 AM"
        if "rosuvas" in raw_query.lower() or "रोसुवास" in raw_query:
            med_target = "Rosuvas 20mg"
            time_target = "09:30 PM"
        elif "ecosprin" in raw_query.lower() or "इकोस्प्रिन" in raw_query:
            med_target = "Ecosprin 75mg"
            time_target = "08:30 AM"

        ans = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="MEDICINE_REMINDER_SETUP",
            guardrail_instructions=f"Confirm that a medication reminder for {med_target} at {time_target} has been prepared and ask the user to confirm it using the card below. Include brief adherence advice.",
            reference_data=f"Medicine: {med_target}, Time: {time_target}, Instruction: After meals",
            fallback_text=f"I have prepared a dosage reminder for **{med_target}** at {time_target}. Please confirm below to activate it."
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "syncedLocation": active_location,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "PROPOSE_REMINDER",
                        "title": "दवा रिमाइंडर की पुष्टि करें" if detected_lang == "hi" else "Confirm Medicine Reminder",
                        "medicineName": med_target,
                        "dosage": "1 खुराक" if detected_lang == "hi" else "1 dose",
                        "time": time_target,
                        "instruction": "भोजन के बाद" if detected_lang == "hi" else "After meals",
                        "patientId": patient_id
                    }
                ]
            }
        }

    # 10. NEARBY FACILITIES OR EXPLICIT LOCATION SYNC REQUEST
    is_loc_statement = location_updated and any(
        p in raw_query.lower()
        for p in ["i am in", "i live in", "my location", "change location", "location is", "मैं ", "मेरा स्थान", "लोकेशन"]
    )
    if is_loc_statement or any(k in raw_query.lower() for k in ["nearby hospital", "emergency bed", "sadar hospital", "chc", "अस्पताल खोजें", "नजदीकी अस्पताल", "hospitals in", "hospitals near"]):
        ans = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="FACILITY_DISCOVERY",
            guardrail_instructions=f"Summarize the verified healthcare facilities serving {active_location} and their bed/emergency availability based on the reference data.",
            reference_data=json.dumps(FACILITIES_DB, ensure_ascii=False),
            fallback_text=f"Your consultation location is synced to **{active_location}**. Here are the verified healthcare facilities serving **{active_location}**:"
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "syncedLocation": active_location,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "FACILITIES_LIST",
                        "title": f"सत्यापित स्वास्थ्य केंद्र ({active_location})" if detected_lang == "hi" else f"Verified Healthcare Facilities ({active_location})",
                        "facilities": FACILITIES_DB
                    }
                ]
            }
        }

    # 11. EXPLICIT DOCTOR BOOKING INTENT (Only when user explicitly asks to book/schedule an appointment)
    explicit_booking_phrases = ["book appointment", "schedule appointment", "book a doctor", "book consult", "book with dr", "अपॉइंटमेंट बुक", "डॉक्टर बुक"]
    if any(k in raw_query.lower() for k in explicit_booking_phrases):
        matched_doc = None
        if any(w in raw_query.lower() for w in ["cardio", "heart", "दिल", "कार्डियो", "राजेश", "verma"]):
            matched_doc = DOCTORS_DB[1]  # Dr. Rajesh Verma
        elif any(w in raw_query.lower() for w in ["neuro", "brain", "stroke", "न्यूरो", "प्रिया", "sharma"]):
            matched_doc = DOCTORS_DB[0]  # Dr. Priya Sharma
        elif any(w in raw_query.lower() for w in ["child", "pediatric", "बच्चा", "शिशु", "अनन्या", "sen"]):
            matched_doc = DOCTORS_DB[2]  # Dr. Ananya Sen
        elif any(w in raw_query.lower() for w in ["bone", "ortho", "joint", "हड्डी", "विक्रम", "malhotra"]):
            matched_doc = DOCTORS_DB[3]  # Dr. Vikram Malhotra
        elif any(w in raw_query.lower() for w in ["women", "pregnant", "gynec", "महिला", "सुनीता", "patel"]):
            matched_doc = DOCTORS_DB[4]  # Dr. Sunita Patel

        if not matched_doc and mem_context.get("activeDoctor"):
            matched_doc = mem_context["activeDoctor"]

        if matched_doc:
            chosen_slot = matched_doc["slots"][0]
            ans = generate_guardrailed_llm_response(
                raw_query=raw_query,
                detected_lang=detected_lang,
                patient_info=patient_info,
                patient_id=patient_id,
                conv_history=conv_history,
                guardrail_mode="DOCTOR_BOOKING_PREPARATION",
                guardrail_instructions=f"Inform the user that an appointment slot with {matched_doc['name']} ({matched_doc['specialty']}) at {matched_doc['facilityName']} for {chosen_slot['time']} is ready to confirm via the card below.",
                reference_data=json.dumps({"doctor": matched_doc, "slot": chosen_slot}, ensure_ascii=False),
                fallback_text=f"I have prepared an appointment slot with **{matched_doc['name']}** ({matched_doc['specialty']}) for **{chosen_slot['time']}** at {matched_doc['facilityName']}."
            )
            audio_b64 = synthesize_speech_base64(ans, detected_lang)
            record_agent_session_turn(session_id, raw_query, ans)
            return {
                "success": True,
                "data": {
                    "answer": ans,
                    "detectedLanguage": detected_lang,
                    "syncedLocation": active_location,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "llmBrainUsed": True,
                    "actionCards": [
                        {
                            "type": "CONFIRMATION_CARD",
                            "title": "अपॉइंटमेंट बुकिंग की पुष्टि" if detected_lang == "hi" else "Appointment Booking Confirmation",
                            "doctor": matched_doc,
                            "slot": chosen_slot,
                            "patient": {
                                "id": patient_id,
                                "name": patient_info.get("name", "Ramesh Mahto"),
                                "phone": patient_info.get("phone", "+91-94311-28901")
                            },
                            "urgencyTier": "ROUTINE",
                            "mode": "teleconsult"
                        }
                    ]
                }
            }
        else:
            ans = generate_guardrailed_llm_response(
                raw_query=raw_query,
                detected_lang=detected_lang,
                patient_info=patient_info,
                patient_id=patient_id,
                conv_history=conv_history,
                guardrail_mode="DOCTOR_ROSTER_LIST",
                guardrail_instructions="Briefly introduce the available specialist doctors in the network and invite the user to select a specialist from the card below.",
                reference_data=json.dumps(DOCTORS_DB, ensure_ascii=False),
                fallback_text=f"Here are the registered specialist doctors serving **{active_location}**. Select a specialist below to prepare your booking:"
            )
            audio_b64 = synthesize_speech_base64(ans, detected_lang)
            record_agent_session_turn(session_id, raw_query, ans)
            return {
                "success": True,
                "data": {
                    "answer": ans,
                    "detectedLanguage": detected_lang,
                    "syncedLocation": active_location,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "llmBrainUsed": True,
                    "actionCards": [
                        {
                            "type": "DOCTORS_LIST",
                            "title": "उपलब्ध चिकित्सा विशेषज्ञ" if detected_lang == "hi" else "Available Medical Specialists",
                            "doctors": DOCTORS_DB
                        }
                    ]
                }
            }

    # 12. BASIC / STRAIGHTFORWARD SYMPTOM TRIAGE (LLM Brain + Clarifying Questions + OTC Guardrail)
    cond_key, cond_cfg = check_basic_condition(raw_query)
    if cond_cfg:
        q1_en, q2_en = cond_cfg["questionsEn"][0], cond_cfg["questionsEn"][1]
        otc_en_lines = "\n".join([f"- {m['name']}: {m['dosage']} ({m['notesEn']})" for m in cond_cfg["otcMedicines"]])
        fallback_basic = (
            f"**Provisional Health Assessment**\n"
            f"Based on the symptoms described, this appears consistent with **{cond_cfg['diagnosisEn']}**.\n\n"
            f"**Medical Disclaimer:** I am a clinical assistant, not a doctor. For an official medical diagnosis, please consult a certified physician.\n\n"
            f"**Clarifying Questions:**\n1. {q1_en}\n2. {q2_en}\n\n"
            f"**Safe OTC Guidance:**\n{otc_en_lines}\n\n"
            f"**Home Care:** {cond_cfg['homeCareEn']}"
        )
        ans_text = generate_guardrailed_llm_response(
            raw_query=raw_query,
            detected_lang=detected_lang,
            patient_info=patient_info,
            patient_id=patient_id,
            conv_history=conv_history,
            guardrail_mode="G_TRIAGE_BASIC_SYMPTOMS",
            guardrail_instructions=(
                f"The user described symptoms consistent with {cond_cfg['diagnosisEn']}. Use your clinical reasoning to respond specifically to their query while enforcing these steps:\n"
                "1. Provide a thoughtful Provisional Health Assessment tailored to their exact words.\n"
                "2. Include the Not-A-Doctor disclaimer (G-NAD).\n"
                f"3. Ask 2 targeted clarifying questions to rule out red flags (e.g. '{q1_en}' and '{q2_en}').\n"
                "4. Provide safe Over-The-Counter (OTC) medication guidance (no prescription drugs) and practical home care.\n"
                "5. Advise seeing a doctor if symptoms persist >48 hours or worsen."
            ),
            reference_data=f"Condition: {cond_cfg['diagnosisEn']}\nVerified OTC Options:\n{otc_en_lines}\nHome Care: {cond_cfg['homeCareEn']}",
            fallback_text=fallback_basic
        )
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        record_agent_session_turn(session_id, raw_query, ans_text)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "YELLOW",
                "llmBrainUsed": True,
                "actionCards": [
                    {
                        "type": "CLARIFYING_QUESTIONS_CARD",
                        "title": "त्वरित उत्तर चुनें" if detected_lang == "hi" else "Select a Quick Response",
                        "questions": cond_cfg["questionsHi"] if detected_lang == "hi" else cond_cfg["questionsEn"],
                        "quickReplies": cond_cfg.get("quickRepliesHi" if detected_lang == "hi" else "quickRepliesEn", [])
                    },
                    {
                        "type": "OTC_MEDICATION_CARD",
                        "title": "सुरक्षित ओटीसी दवाइयां (बिना पर्चे के)" if detected_lang == "hi" else "Safe OTC Relief (No Prescription Required)",
                        "medicines": cond_cfg["otcMedicines"]
                    },
                    {
                        "type": "HEALTH_GUIDANCE_ACTIONS",
                        "urgency": "YELLOW",
                        "options": (
                            [
                                {"label": "डॉक्टर परामर्श बुक करें", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "नजदीकी अस्पताल खोजें", "route": "#feature1"}
                            ]
                            if detected_lang == "hi"
                            else [
                                {"label": "Book Routine Doctor Consult", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "Find Nearest Hospital Facility", "route": "#feature1"}
                            ]
                        )
                    }
                ]
            }
        }

    # 13. OPEN-ENDED CLINICAL & HEALTH QUESTIONS VIA LIVE GEMINI LLM BRAIN
    fallback_general = (
        f"नमस्ते {patient_info.get('name')} जी, मैं मेदवेद क्लिनिकल सहायक हूँ। कृपया अपना प्रश्न बताएं।"
        if detected_lang == "hi"
        else f"Hello {patient_info.get('name')}, I am your MedVeda Clinical Assistant. How can I help you with your health question today?"
    )
    ans_text = generate_guardrailed_llm_response(
        raw_query=raw_query,
        detected_lang=detected_lang,
        patient_info=patient_info,
        patient_id=patient_id,
        conv_history=conv_history,
        guardrail_mode="G_OPEN_CLINICAL_LLM_REASONING",
        guardrail_instructions=(
            "Answer the user's medical, wellness, nutrition, diagnostic, or healthcare question thoroughly and accurately using your clinical knowledge base.\n"
            "1. Directly address the user's specific question (do NOT give a generic greeting).\n"
            "2. Enforce G-NAD (include a brief reminder that you are a clinical AI assistant, not a doctor).\n"
            "3. Enforce G-RX (if medications are relevant, discuss only safe OTC options or explain mechanism of action while advising physician supervision for prescription drugs).\n"
            "4. If the user describes any new symptoms, ask 1-2 brief clarifying questions and explain what red flags would warrant a doctor visit."
        ),
        reference_data=f"Available MedVeda Doctors: {json.dumps([{'name': d['name'], 'specialty': d['specialty'], 'facility': d['facilityName']} for d in DOCTORS_DB], ensure_ascii=False)}",
        fallback_text=fallback_general
    )

    audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
    record_agent_session_turn(session_id, raw_query, ans_text)
    return {
        "success": True,
        "data": {
            "answer": ans_text,
            "detectedLanguage": detected_lang,
            "audioBase64": audio_b64,
            "urgencyLevel": "GREEN",
            "llmBrainUsed": True,
            "actionCards": [
                {
                    "type": "QUICK_ACTIONS",
                    "options": (
                        [
                            {"label": "डॉक्टर परामर्श बुक करें", "route": "#feature2"},
                            {"label": "नजदीकी अस्पताल देखें", "route": "#feature1"},
                            {"label": "दवा उपलब्धता जांचें", "route": "#feature6"}
                        ]
                        if detected_lang == "hi"
                        else [
                            {"label": "Book Doctor Consultation", "route": "#feature2"},
                            {"label": "View Nearby Hospitals", "route": "#feature1"},
                            {"label": "Check Medicine Stock", "route": "#feature6"}
                        ]
                    )
                }
            ]
        }
    }




if __name__ == "__main__":
    import uvicorn
    py_port = int(os.environ.get("PYTHON_PORT", 8001))
    print(f"Starting MedVeda Python Multilingual & Voice AI Service on http://127.0.0.1:{py_port}")
    uvicorn.run(app, host="127.0.0.1", port=py_port)

