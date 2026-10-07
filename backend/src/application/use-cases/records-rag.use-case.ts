/**
 * Feature Map 05: Application Use Case for EHR-Integrated Hybrid RAG & AI Vision OCR
 */

import { InMemoryRecordsStore } from '../../infrastructure/cache/records.store.ts';
import { GeminiRecordsRagAdapter, type OcrAnalysisResult, type RagChatResponse } from '../../infrastructure/ai/gemini-records-rag.adapter.ts';

export interface ChatAuditLogItem {
  id: string;
  patientId: string;
  requesterRole: string;
  question: string;
  answer: string;
  isEmergency: boolean;
  citationCount: number;
  confidence: string;
  timestamp: string;
}

export class RecordsRagUseCase {
  private readonly store: InMemoryRecordsStore;
  private readonly ragAdapter: GeminiRecordsRagAdapter;
  private readonly auditLogs: ChatAuditLogItem[] = [];

  constructor(store: InMemoryRecordsStore, ragAdapter?: GeminiRecordsRagAdapter) {
    this.store = store;
    this.ragAdapter = ragAdapter || new GeminiRecordsRagAdapter();
  }

  /**
   * Analyzes an uploaded document image or prescription using Gemini Vision AI.
   */
  async analyzeDocumentOcr(dto: {
    base64Data?: string;
    mimeType?: string;
    recordTypeHint?: any;
    rawText?: string;
  }): Promise<OcrAnalysisResult> {
    if (dto.base64Data) {
      return this.ragAdapter.analyzeDocumentImage(
        dto.base64Data,
        dto.mimeType || 'image/jpeg',
        dto.recordTypeHint || 'prescription'
      );
    }

    // Fallback if raw text was supplied
    return this.ragAdapter.analyzeDocumentImage('', 'image/jpeg', dto.recordTypeHint || 'prescription');
  }

  /**
   * Queries patient health records via EHR-Integrated Grounded RAG Chatbot.
   */
  async queryPatientRecordsChat(dto: {
    internalMedicalId: string;
    question: string;
    scopedDocumentId?: string;
    language?: string;
    requesterRole?: string;
  }): Promise<RagChatResponse> {
    const patient = this.store.getPatientById(dto.internalMedicalId);
    if (!patient) {
      throw new Error(`Patient not found with Medical ID: ${dto.internalMedicalId}`);
    }

    const records = this.store.getRecordsByMedicalId(dto.internalMedicalId);

    const response = await this.ragAdapter.askRecordsRag(
      patient,
      records,
      dto.question,
      dto.scopedDocumentId,
      dto.language || 'en'
    );

    // Record audit log entry (as requested in Feature Map: Operational Guardrails)
    const auditItem: ChatAuditLogItem = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      patientId: dto.internalMedicalId,
      requesterRole: dto.requesterRole || 'patient',
      question: dto.question,
      answer: response.answer,
      isEmergency: response.isEmergency,
      citationCount: response.citations.length,
      confidence: response.confidence,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(auditItem);

    return response;
  }

  /**
   * Returns chat audit history for a patient.
   */
  getAuditLogs(patientId?: string): ChatAuditLogItem[] {
    if (patientId) {
      return this.auditLogs.filter(a => a.patientId === patientId);
    }
    return this.auditLogs.slice(0, 50);
  }
}
