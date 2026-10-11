import type { TriageInput, TriageAssessment } from '../../domain/models/triage.model.ts';
import type { RankedFacility } from '../../domain/models/recommendation.model.ts';
import { AssessTriageUseCase } from './assess-triage.use-case.ts';
import { ResearchHospitalsUseCase } from './research-hospitals.use-case.ts';
import { RankFacilitiesUseCase } from './rank-facilities.use-case.ts';
import type { SqliteNavigationStore } from '../../infrastructure/db/sqlite-navigation.store.ts';
import type { PipelineStreamManager, PipelineStageEventType } from '../../presentation/sse/pipeline-stream.manager.ts';

export interface PipelineExecutionResult {
  readonly sessionId: string;
  readonly triage: TriageAssessment;
  readonly recommendations: readonly RankedFacility[];
  readonly meta: {
    readonly latencyMs: number;
    readonly agentsInvoked: readonly string[];
    readonly searchLocation: string;
    readonly totalCandidates: number;
    readonly persisted?: boolean;
  };
}

export class CareNavigationPipelineUseCase {
  private readonly triageUseCase: AssessTriageUseCase;
  private readonly researchUseCase: ResearchHospitalsUseCase;
  private readonly rankUseCase: RankFacilitiesUseCase;
  private readonly navigationStore?: SqliteNavigationStore;
  private readonly streamManager?: PipelineStreamManager;

  constructor(
    triageUseCase: AssessTriageUseCase,
    researchUseCase: ResearchHospitalsUseCase,
    rankUseCase: RankFacilitiesUseCase,
    navigationStore?: SqliteNavigationStore,
    streamManager?: PipelineStreamManager
  ) {
    this.triageUseCase = triageUseCase;
    this.researchUseCase = researchUseCase;
    this.rankUseCase = rankUseCase;
    this.navigationStore = navigationStore;
    this.streamManager = streamManager;
  }

  private emitStage(
    sessionId: string,
    stage: PipelineStageEventType,
    message: string,
    payload?: Record<string, unknown>
  ): void {
    if (!this.streamManager) return;
    this.streamManager.emit({
      sessionId,
      stage,
      timestamp: new Date().toISOString(),
      message,
      payload
    });
  }

  async execute(input: TriageInput & { sessionId?: string }): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const sessionId =
      input.sessionId ||
      input.sessionToken ||
      `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.emitStage(sessionId, 'SESSION_STARTED', 'Initializing 3-Agent Care Navigation Pipeline', {
      location: input.location
    });

    try {
      // 1. AGENT 1: Clinical Symptom & Triage Assessment
      this.emitStage(sessionId, 'AGENT_1_TRIAGE_RUNNING', 'Agent 1 evaluating symptoms, red-flag invariants, and vitals...');
      const triage = await this.triageUseCase.execute(input);
      this.emitStage(sessionId, 'TRIAGE_COMPLETED', `Triage complete: ${triage.urgency} (${triage.requiredSpecialty})`, {
        triage
      });

      // 2. AGENT 2: Google Search MCP Research (PII ISOLATION: passes only location + coordinates + specialty + queries)
      this.emitStage(
        sessionId,
        'AGENT_2_RESEARCH_RUNNING',
        `Agent 2 researching verified ${triage.requiredSpecialty} facilities near ${input.location}...`
      );
      const hospitalSearch = await this.researchUseCase.execute({
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        requiredSpecialty: triage.requiredSpecialty,
        emergencyRequired: triage.emergencyRequired,
        searchQueries: triage.searchQueries
      });
      this.emitStage(
        sessionId,
        'HOSPITAL_RESEARCH_COMPLETED',
        `Discovered and verified ${hospitalSearch.facilities.length} candidate facilities.`,
        {
          totalCandidates: hospitalSearch.facilities.length,
          requiredSpecialty: triage.requiredSpecialty
        }
      );

      // 3. AGENT 3: Clinical Suitability > Proximity Ranking & Plain-Language Justification
      this.emitStage(
        sessionId,
        'AGENT_3_RANKING_RUNNING',
        'Agent 3 scoring clinical suitability vs. proximity and generating plain-language rationales...'
      );
      const rankedResponse = await this.rankUseCase.execute({
        urgency: triage.urgency,
        requiredSpecialty: triage.requiredSpecialty,
        emergencyRequired: triage.emergencyRequired,
        location: input.location,
        facilities: hospitalSearch.facilities
      });

      let persisted = false;
      if (this.navigationStore) {
        try {
          this.navigationStore.saveTriageSession(sessionId, input, triage);
          this.navigationStore.saveRecommendations(sessionId, rankedResponse.topFacilities);
          persisted = true;
        } catch (err) {
          console.warn('Could not persist triage session to navigation database:', err);
        }
      }

      const latencyMs = Date.now() - startTime;
      const result: PipelineExecutionResult = {
        sessionId,
        triage,
        recommendations: rankedResponse.topFacilities,
        meta: {
          latencyMs,
          agentsInvoked: ['symptom-triage-agent', 'hospital-research-agent', 'facility-recommendation-agent'],
          searchLocation: input.location,
          totalCandidates: hospitalSearch.facilities.length,
          persisted
        }
      };

      this.emitStage(sessionId, 'RECOMMENDATIONS_READY', 'Top facility recommendations ranked and ready.', {
        sessionId,
        triage,
        recommendations: rankedResponse.topFacilities,
        meta: result.meta
      });

      return result;
    } catch (err: any) {
      this.emitStage(sessionId, 'PIPELINE_ERROR', err?.message || 'Pipeline execution failed');
      throw err;
    }
  }
}
