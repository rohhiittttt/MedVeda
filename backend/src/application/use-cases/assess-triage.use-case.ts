import type { TriageInput, TriageAssessment } from '../../domain/models/triage.model.ts';
import { evaluateTriage } from '../../domain/rules/triage-rules.ts';
import { GeminiTriageAdapter } from '../../infrastructure/ai/gemini-triage.adapter.ts';

export class AssessTriageUseCase {
  private readonly geminiTriageAdapter: GeminiTriageAdapter;

  constructor(geminiTriageAdapter?: GeminiTriageAdapter) {
    this.geminiTriageAdapter = geminiTriageAdapter || new GeminiTriageAdapter();
  }

  async execute(input: TriageInput): Promise<TriageAssessment> {
    // 1. Deterministic Red-Flag & Vitals Gatekeeper (Always executes first)
    const baseline = evaluateTriage(input);

    // 2. AI Clinical Symptom Enrichment (Enforces non-downgrade safety invariant)
    return this.geminiTriageAdapter.enrichAssessment(input, baseline);
  }
}
