import os
import requests
import json
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

api_key = os.environ.get("GEMINI_API_KEY")
model = os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.5-flash-lite")

endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

prompt = """You are the MedVeda Clinical Document & Multimodal Medical AI.
Analyze this user query with blood test results: "My CBC test report shows: Hemoglobin: 10.2 g/dL (normal 13-17), Platelet Count: 240,000 /cumm (normal 150000-450000), Total WBC: 7200 /cumm (normal 4000-11000). What does this mean?"

Determine if this is "medication" or "lab_report".
Return STRICT JSON schema:
{
  "documentType": "lab_report",
  "title": "Complete Blood Count (CBC) Report",
  "facilityOrLab": "District Diagnostic Pathology Lab",
  "date": "Recent",
  "parameters": [
    {
      "name": "Hemoglobin",
      "observedValue": "10.2",
      "unit": "g/dL",
      "normalRange": "13.0 - 17.0",
      "status": "LOW",
      "meaning": "Indicates mild anemia (low red blood cell count)"
    }
  ],
  "groundedSummary": "Summary strictly based on the documented findings in this report only.",
  "disclaimer": "AI is not a doctor. Please do not solely rely on this analysis. Consult a certified doctor.",
  "explanationEn": "...",
  "explanationHi": "..."
}
GUARDRAIL: You can describe what the report values mean, but you can suggest insights STRICTLY FROM THAT REPORT ONLY. Do NOT extrapolate unmentioned conditions or speculate on speculative diseases."""

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"responseMimeType": "application/json"}
}

res = requests.post(endpoint, json=payload, timeout=20)
print("Status:", res.status_code)
if res.ok:
    data = res.json()
    txt = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    parsed = json.loads(txt)
    print("Document type:", parsed.get("documentType"))
    print("Title:", parsed.get("title"))
    print("Parameters count:", len(parsed.get("parameters", [])))
    for p in parsed.get("parameters", []):
        print(f" - {p.get('name')}: {p.get('observedValue')} {p.get('unit')} ({p.get('status')})")
    print("Grounded summary:", parsed.get("groundedSummary")[:100] + "...")
