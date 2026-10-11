import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTriage } from '../../src/domain/rules/triage-rules.ts';
import { rankFacilities } from '../../src/domain/rules/clinical-ranking.rules.ts';
import { ResearchHospitalsUseCase } from '../../src/application/use-cases/research-hospitals.use-case.ts';
import { AssessTriageUseCase } from '../../src/application/use-cases/assess-triage.use-case.ts';
import { RankFacilitiesUseCase } from '../../src/application/use-cases/rank-facilities.use-case.ts';
import { CareNavigationPipelineUseCase } from '../../src/application/use-cases/pipeline.use-case.ts';
import { InMemoryHospitalCacheAdapter } from '../../src/infrastructure/cache/in-memory-hospital.cache.ts';
import { GoogleSearchMcpAdapter } from '../../src/infrastructure/mcp/google-search-mcp.adapter.ts';
import { PipelineStreamManager } from '../../src/presentation/sse/pipeline-stream.manager.ts';

describe('Phase 2: 3-Agent Pipeline Intelligence, Vitals, Haversine & Live SSE Streaming', () => {
  it('should escalate critical vitals (SpO2 < 90% and BP >= 180/120) to CRITICAL urgency', () => {
    const hypoxemiaResult = evaluateTriage({
      age: 62,
      sex: 'male',
      location: 'Hazaribagh',
      primarySymptoms: 'Mild cough and fatigue',
      duration: '2 days',
      severity: 'mild',
      redFlags: {
        facialDroopOrSpeech: false,
        chestPain: false,
        breathingDistress: false,
        unconsciousOrConfusion: false,
        severeBleeding: false
      },
      vitals: {
        oxygenSaturation: 86,
        heartRate: 98
      }
    });

    assert.equal(hypoxemiaResult.urgency, 'CRITICAL');
    assert.equal(hypoxemiaResult.emergencyRequired, true);
    assert.equal(hypoxemiaResult.requiredSpecialty, 'Pulmonology / Critical Care');
    assert.ok(hypoxemiaResult.redFlagsDetected.some((f) => f.includes('Hypoxemia')));

    const hypertensiveCrisis = evaluateTriage({
      age: 54,
      sex: 'female',
      location: 'Hazaribagh',
      primarySymptoms: 'Dizziness and headache',
      duration: '3 hours',
      severity: 'moderate',
      redFlags: {
        facialDroopOrSpeech: false,
        chestPain: false,
        breathingDistress: false,
        unconsciousOrConfusion: false,
        severeBleeding: false
      },
      vitals: {
        bloodPressure: '188/124',
        heartRate: 92
      }
    });

    assert.equal(hypertensiveCrisis.urgency, 'CRITICAL');
    assert.equal(hypertensiveCrisis.requiredSpecialty, 'Cardiology');
    assert.ok(hypertensiveCrisis.redFlagsDetected.some((f) => f.includes('Hypertensive Crisis')));
  });

  it('should classify expanded specialties (Obstetrics, Orthopedics, Pediatrics) and generate specialty-specific search queries without hardcoded stroke terms', () => {
    const orthoResult = evaluateTriage({
      age: 34,
      sex: 'male',
      location: 'Ramgarh',
      primarySymptoms: 'Swollen knee joint pain and suspected ankle sprain after sports',
      duration: '1 day',
      severity: 'moderate',
      redFlags: {
        facialDroopOrSpeech: false,
        chestPain: false,
        breathingDistress: false,
        unconsciousOrConfusion: false,
        severeBleeding: false
      }
    });

    assert.equal(orthoResult.requiredSpecialty, 'Orthopedics & Trauma');
    assert.equal(orthoResult.urgency, 'URGENT');
    assert.ok(orthoResult.searchQueries.every((q) => !q.includes('stroke neurology')));
    assert.ok(orthoResult.searchQueries.some((q) => q.includes('orthopedics & trauma')));

    const obstetricResult = evaluateTriage({
      age: 26,
      sex: 'female',
      location: 'Hazaribagh',
      primarySymptoms: '8 months pregnant with severe labor pain and vaginal bleeding',
      duration: '2 hours',
      severity: 'severe',
      redFlags: {
        facialDroopOrSpeech: false,
        chestPain: false,
        breathingDistress: false,
        unconsciousOrConfusion: false,
        severeBleeding: true
      }
    });

    assert.equal(obstetricResult.requiredSpecialty, 'Obstetrics & Gynecology');
    assert.equal(obstetricResult.urgency, 'CRITICAL');
    assert.ok(obstetricResult.searchQueries.some((q) => q.includes('obstetrics & gynecology')));
  });

  it('should dynamically recalculate Haversine distanceKm when patient GPS coordinates are provided', async () => {
    const searchAdapter = new GoogleSearchMcpAdapter();
    const cacheAdapter = new InMemoryHospitalCacheAdapter();
    const researchUseCase = new ResearchHospitalsUseCase(searchAdapter, cacheAdapter);

    // Patient in Ramgarh (23.63, 85.51) — Kalyani Hospital in Ramgarh should now be closer than SBMC&H in Hazaribagh!
    const response = await researchUseCase.execute({
      location: 'Ramgarh, Jharkhand',
      latitude: 23.634,
      longitude: 85.514,
      requiredSpecialty: 'Orthopedics & Trauma',
      emergencyRequired: true,
      searchQueries: ['orthopedics trauma emergency Ramgarh']
    });

    const kalyani = response.facilities.find((f) => f.id === 'fac_kalyani_ramgarh');
    assert.ok(kalyani);
    assert.ok(kalyani.distanceKm < 2.0, `Expected Kalyani distance < 2.0 km from Ramgarh GPS, got ${kalyani.distanceKm}`);
  });

  it('should generate specialty-aware and closer-OPD comparison rationales in Agent 3', () => {
    const ranked = rankFacilities({
      urgency: 'CRITICAL',
      requiredSpecialty: 'Cardiology',
      emergencyRequired: true,
      location: 'Hazaribagh',
      facilities: [
        {
          id: 'fac_opd_close',
          name: 'Local Town OPD Clinic',
          address: 'Main Road, Hazaribagh',
          distanceKm: 1.2,
          hasEmergencyDepartment: false,
          hasRequiredSpecialty: true,
          specialtyMode: 'OPD_ONLY',
          emergencySpecialtyVerified: false,
          verificationStatus: 'partially_verified',
          verificationNotes: 'Daytime OPD only.',
          contactNumber: null,
          sources: []
        },
        {
          id: 'fac_er_cardio',
          name: 'SBMC&H Cardiac Emergency Center',
          address: 'Canary Hill Road, Hazaribagh',
          distanceKm: 4.5,
          hasEmergencyDepartment: true,
          hasRequiredSpecialty: true,
          specialtyMode: 'EMERGENCY_AND_OPD',
          emergencySpecialtyVerified: true,
          verificationStatus: 'verified',
          verificationNotes: '24x7 Cardiac ICU and Cath Lab.',
          contactNumber: '+91-6546-270100',
          sources: [{ type: 'official_website', url: 'https://sbmch.jharkhand.gov.in', reliability: 'primary' }]
        }
      ]
    });

    assert.equal(ranked.topFacilities[0].id, 'fac_er_cardio');
    assert.ok(ranked.topFacilities[0].clinicalExplanation.includes('Cardiology'));
    assert.ok(!ranked.topFacilities[0].clinicalExplanation.includes('stroke ICU'));
    assert.ok(
      ranked.topFacilities[0].clinicalExplanation.includes('Prioritized over closer OPD-only Local Town OPD Clinic'),
      `Expected closer OPD comparison in rationale, got: ${ranked.topFacilities[0].clinicalExplanation}`
    );
  });

  it('should emit all 7 real-time SSE stage events during CareNavigationPipelineUseCase execution', async () => {
    const streamManager = new PipelineStreamManager();
    const triageUseCase = new AssessTriageUseCase();
    const researchUseCase = new ResearchHospitalsUseCase(
      new GoogleSearchMcpAdapter(),
      new InMemoryHospitalCacheAdapter()
    );
    const rankUseCase = new RankFacilitiesUseCase();
    const pipeline = new CareNavigationPipelineUseCase(
      triageUseCase,
      researchUseCase,
      rankUseCase,
      undefined,
      streamManager
    );

    const result = await pipeline.execute({
      sessionId: 'sess_sse_test_01',
      age: 49,
      sex: 'male',
      location: 'Hazaribagh',
      primarySymptoms: 'Severe crushing chest pain radiating to left arm',
      duration: '30 minutes',
      severity: 'severe',
      redFlags: {
        facialDroopOrSpeech: false,
        chestPain: true,
        breathingDistress: false,
        unconsciousOrConfusion: false,
        severeBleeding: false
      }
    });

    assert.equal(result.sessionId, 'sess_sse_test_01');
    const events = streamManager.getEvents('sess_sse_test_01');
    const stages = events.map((e) => e.stage);

    assert.deepEqual(stages, [
      'SESSION_STARTED',
      'AGENT_1_TRIAGE_RUNNING',
      'TRIAGE_COMPLETED',
      'AGENT_2_RESEARCH_RUNNING',
      'HOSPITAL_RESEARCH_COMPLETED',
      'AGENT_3_RANKING_RUNNING',
      'RECOMMENDATIONS_READY'
    ]);
  });
});
