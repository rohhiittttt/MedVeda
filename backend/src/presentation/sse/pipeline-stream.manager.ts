import type { ServerResponse } from 'node:http';

export type PipelineStageEventType =
  | 'SESSION_STARTED'
  | 'AGENT_1_TRIAGE_RUNNING'
  | 'TRIAGE_COMPLETED'
  | 'AGENT_2_RESEARCH_RUNNING'
  | 'HOSPITAL_RESEARCH_COMPLETED'
  | 'AGENT_3_RANKING_RUNNING'
  | 'RECOMMENDATIONS_READY'
  | 'PIPELINE_ERROR';

export interface PipelineStageEvent {
  readonly sessionId: string;
  readonly stage: PipelineStageEventType;
  readonly timestamp: string;
  readonly message: string;
  readonly payload?: Record<string, unknown>;
}

/**
 * Manages Server-Sent Events (SSE) connections and replay buffers for
 * GET /api/v1/navigate/stream/:sessionId
 */
export class PipelineStreamManager {
  private readonly listeners = new Map<string, Set<ServerResponse>>();
  private readonly history = new Map<string, PipelineStageEvent[]>();
  private readonly maxSessions = 200;

  emit(event: PipelineStageEvent): void {
    const existing = this.history.get(event.sessionId) ?? [];
    existing.push(event);
    this.history.set(event.sessionId, existing);

    // Prune oldest session buffers if exceeding cap
    if (this.history.size > this.maxSessions) {
      const oldestKey = this.history.keys().next().value;
      if (oldestKey) {
        this.history.delete(oldestKey);
      }
    }

    const clients = this.listeners.get(event.sessionId);
    if (clients && clients.size > 0) {
      const formatted = this.formatSseMessage(event);
      for (const res of clients) {
        if (!res.writableEnded) {
          res.write(formatted);
          if (event.stage === 'RECOMMENDATIONS_READY' || event.stage === 'PIPELINE_ERROR') {
            res.end();
          }
        }
      }
      if (event.stage === 'RECOMMENDATIONS_READY' || event.stage === 'PIPELINE_ERROR') {
        this.listeners.delete(event.sessionId);
      }
    }
  }

  subscribe(sessionId: string, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Replay any stage events already recorded for this session
    const pastEvents = this.history.get(sessionId) ?? [];
    for (const ev of pastEvents) {
      res.write(this.formatSseMessage(ev));
      if (ev.stage === 'RECOMMENDATIONS_READY' || ev.stage === 'PIPELINE_ERROR') {
        res.end();
        return;
      }
    }

    // If pipeline hasn't completed yet, register live subscriber
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(res);

    res.on('close', () => {
      const activeSet = this.listeners.get(sessionId);
      if (activeSet) {
        activeSet.delete(res);
        if (activeSet.size === 0) {
          this.listeners.delete(sessionId);
        }
      }
    });
  }

  getEvents(sessionId: string): readonly PipelineStageEvent[] {
    return this.history.get(sessionId) ?? [];
  }

  private formatSseMessage(event: PipelineStageEvent): string {
    return `event: ${event.stage}\ndata: ${JSON.stringify(event)}\n\n`;
  }
}
