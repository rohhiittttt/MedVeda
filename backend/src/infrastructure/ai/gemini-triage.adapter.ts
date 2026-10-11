import type { TriageInput, TriageAssessment, UrgencyLevel } from '../../domain/models/triage.model.ts';

interface GeminiTriageRawResponse {
  urgency?: UrgencyLevel;
  requiredSpecialty?: string;
  conditionCategory?: string;
  clinicalRoutingAdvice?: string;
  emergencyRequired?: boolean;
  redFlagsDetected?: string[];
  searchQueries?: string[];
}

/**
 * Agent 1 AI Clinical Symptom Understanding Adapter (Google Gemini).
 * Works in tandem with the deterministic Red-Flag Gatekeeper (evaluateTriage).
 * Safety Invariant: Can never downgrade a deterministic CRITICAL escalation or issue a definitive diagnosis.
 */
export class GeminiTriageAdapter {
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(apiKey?: string, modelName?: string, timeoutMs = 4500) {
    this.apiKey = apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.modelName = modelName || process.env.GEMINI_TRIAGE_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-3.8-flash';
    this.timeoutMs = timeoutMs;
  }

  async enrichAssessment(input: TriageInput, baseline: TriageAssessment): Promise<TriageAssessment> {
    if (!this.apiKey) {
      return baseline;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const vitalsSummary = input.vitals
      ? JSON.stringify(input.vitals)
      : 'Not recorded';

    const prompt = `You are Agent 1 (Clinical Symptom & Triage Routing Engine) for MedVeda Smart Care Navigator in India.
Evaluate the following anonymized clinical presentation and return a structured JSON routing assessment.
CRITICAL SAFETY RULES:
1. NEVER issue a definitive medical diagnosis. Use clinical routing phrasing such as "Symptoms indicate a possible [category] requiring [urgency] evaluation..."
2. Deterministic safety gatekeeper baseline urgency is "${baseline.urgency}" (emergencyRequired: ${baseline.emergencyRequired}). You MUST NOT downgrade CRITICAL urgency.

Patient Presentation:
- Age: ${input.age}, Sex: ${input.sex}
- Location: ${input.location}
- Primary Symptoms: ${input.primarySymptoms}
- Additional Notes: ${input.additionalNotes || 'None'}
- Duration: ${input.duration}, Reported Severity: ${input.severity}
- Vitals: ${vitalsSummary}
- Medical History: ${(input.medicalHistory || []).join(', ') || 'None'}
- Red Flags Already Triggered: ${baseline.redFlagsDetected.join('; ') || 'None'}

Return ONLY valid JSON matching this schema:
{
  "urgency": "CRITICAL" | "URGENT" | "NON_URGENT",
  "requiredSpecialty": "Exact medical specialty (e.g., Cardiology, Neurology, Pulmonology / Critical Care, Obstetrics & Gynecology, Pediatrics, Orthopedics & Trauma, Gastroenterology, Nephrology, Ophthalmology, ENT (Otolaryngology), Dermatology & Burn Care, Psychiatry, Oncology, Emergency Medicine, General Medicine)",
  "conditionCategory": "Suspected clinical category (non-diagnostic)",
  "clinicalRoutingAdvice": "Actionable first-aid stabilization + care setting routing advice (2-3 sentences)",
  "emergencyRequired": boolean,
  "redFlagsDetected": ["string"],
  "searchQueries": ["4 targeted hospital search queries for ${input.location}"]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        return baseline;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return baseline;

      const parsed = JSON.parse(rawText) as GeminiTriageRawResponse;

      // Enforce Clinical Safety Gatekeeper Invariant:
      // Deterministic CRITICAL can NEVER be downgraded by the LLM.
      const urgencyRank: Record<UrgencyLevel, number> = {
        CRITICAL: 3,
        URGENT: 2,
        NON_URGENT: 1
      };

      const candidateUrgency: UrgencyLevel =
        parsed.urgency && ['CRITICAL', 'URGENT', 'NON_URGENT'].includes(parsed.urgency)
          ? parsed.urgency
          : baseline.urgency;

      const finalUrgency: UrgencyLevel =
        urgencyRank[candidateUrgency] >= urgencyRank[baseline.urgency]
          ? candidateUrgency
          : baseline.urgency;

      const finalEmergencyRequired =
        baseline.emergencyRequired || finalUrgency === 'CRITICAL' || Boolean(parsed.emergencyRequired);

      // Keep baseline specialty if deterministic rule matched a specific non-general specialty on critical red flag
      const finalSpecialty =
        baseline.urgency === 'CRITICAL' && baseline.requiredSpecialty !== 'General Medicine' && baseline.requiredSpecialty !== 'Emergency Medicine'
          ? baseline.requiredSpecialty
          : (parsed.requiredSpecialty?.trim() || baseline.requiredSpecialty);

      const mergedRedFlags = Array.from(
        new Set([...baseline.redFlagsDetected, ...(Array.isArray(parsed.redFlagsDetected) ? parsed.redFlagsDetected : [])])
      );

      const finalSearchQueries =
        Array.isArray(parsed.searchQueries) && parsed.searchQueries.length >= 2
          ? parsed.searchQueries
          : baseline.searchQueries;

      return {
        urgency: finalUrgency,
        acuityBadge:
          finalUrgency === 'CRITICAL'
            ? '🔴 CRITICAL'
            : finalUrgency === 'URGENT'
              ? '🟡 URGENT'
              : '🟢 NON-URGENT',
        requiredSpecialty: finalSpecialty,
        conditionCategory: parsed.conditionCategory?.trim() || baseline.conditionCategory,
        clinicalRoutingAdvice: parsed.clinicalRoutingAdvice?.trim() || baseline.clinicalRoutingAdvice,
        emergencyRequired: finalEmergencyRequired,
        redFlagsDetected: mergedRedFlags,
        searchQueries: finalSearchQueries
      };
    } catch {
      return baseline;
    } finally {
      clearTimeout(timer);
    }
  }
}
