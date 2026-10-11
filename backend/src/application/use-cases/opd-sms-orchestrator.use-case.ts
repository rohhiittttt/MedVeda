import {
  DEFAULT_HOLD_TTL_MS,
  normalizeMsisdn,
  type BookingRecord,
  type SessionSlotRecord,
  type SmsMessageRecord,
  type SmsParseResult,
} from '../../../../packages/contracts/index.ts';
import { parseInboundSms } from '../../../../packages/sms-parser/index.ts';
import {
  getOpdBookingStore,
  getTodayIstDateString,
  OpdBookingError,
  SqliteOpdBookingStore,
} from '../../infrastructure/db/sqlite-opd-booking.store.ts';
import {
  checkSmsRateLimit,
  DLT_TEMPLATES,
  enforceSingleSegmentGsm7,
  getSmsGatewayAdapter,
  normalizeInboundWebhook,
  parseDlrWebhook,
  renderDltTemplate,
  validateGsm7SingleSegment,
  verifyWebhookSignature,
  type DltTemplateKey,
  type SmsProviderType,
} from '../../infrastructure/sms/sms-gateway.adapter.ts';
import {
  getOpdBookingCore,
  OpdBookingCoreUseCase,
} from './opd-booking-core.use-case.ts';

// ============================================================================
// 1. TYPES & INTERFACES (AGENT A5 — 2-WAY SMS ORCHESTRATOR)
// ============================================================================

export type SmsOrchestratorAction =
  | 'HOLD_CREATED'
  | 'SLOT_FULL_FALLBACK'
  | 'BOOKING_CONFIRMED'
  | 'HOLD_EXPIRED'
  | 'HOLD_NOT_FOUND'
  | 'BOOKING_CANCELLED'
  | 'STATUS_RETURNED'
  | 'BOOKING_NOT_FOUND'
  | 'FACILITIES_LISTED'
  | 'HELP_SENT'
  | 'PARSE_ERROR_HELP'
  | 'UNKNOWN_FALLBACK_HELP'
  | 'DUPLICATE_ACTIVE_BOOKING';

export interface SmsOrchestratorTurnResult {
  duplicate: boolean;
  deduplicated: boolean;
  provider: SmsProviderType;
  inbound: SmsMessageRecord;
  parsed: SmsParseResult;
  actionTaken: SmsOrchestratorAction;
  booking: BookingRecord | null;
  outboundSms: SmsMessageRecord;
  replyText: string;
  templateId: string;
  characterCount: number;
  segments: number;
}

export interface HandleInboundSmsOptions {
  now?: Date;
  bypassRateLimit?: boolean;
  webhookSecret?: string;
}

// ============================================================================
// 2. OPD 2-WAY SMS ORCHESTRATOR USE-CASE
// ============================================================================

export class OpdSmsOrchestrator {
  private readonly store: SqliteOpdBookingStore;
  private readonly core: OpdBookingCoreUseCase;
  private readonly turnCache: Map<string, SmsOrchestratorTurnResult>;
  private readonly holdReferenceTimeMs: Map<string, number>;

  constructor(
    store?: SqliteOpdBookingStore,
    core?: OpdBookingCoreUseCase
  ) {
    this.store = store || getOpdBookingStore();
    this.core = core || getOpdBookingCore(this.store);
    this.turnCache = new Map<string, SmsOrchestratorTurnResult>();
    this.holdReferenceTimeMs = new Map<string, number>();
  }

  public getStore(): SqliteOpdBookingStore {
    return this.store;
  }

  public getBookingCore(): OpdBookingCoreUseCase {
    return this.core;
  }

  /**
   * Full 2-way inbound SMS state machine:
   * 1. Verifies webhook signature (`verifyWebhookSignature`)
   * 2. Normalizes webhook payload (`normalizeInboundWebhook`)
   * 3. Checks idempotency in `sms_inbox` by `providerMsgId`
   * 4. Enforces per-MSISDN sliding-window rate limit (`checkSmsRateLimit`)
   * 5. Runs deterministic grammar parser (`parseInboundSms`)
   * 6. Updates `sms_inbox` with parsed `intent`, `confidence`, and `parsed_json`
   * 7. Executes intent (`BOOK`, `CONFIRM`, `CANCEL`, `STATUS`, `LIST`, `HELP`, `UNKNOWN`)
   * 8. Dispatches & records single-segment (<= 160 chars) DLT outbound reply in `sms_outbox`
   */
  public handleInboundSms(
    provider: string,
    rawBody: any,
    headers?: Record<string, any>,
    options?: HandleInboundSmsOptions
  ): SmsOrchestratorTurnResult {
    // 1. Verify webhook signature
    const sigCheck = verifyWebhookSignature(
      provider,
      rawBody,
      headers,
      options?.webhookSecret
    );
    if (!sigCheck.valid) {
      throw new OpdBookingError(
        'INVALID_WEBHOOK_SIGNATURE',
        sigCheck.reason || 'Webhook signature verification failed',
        401
      );
    }

    // 2. Normalize inbound webhook payload
    const normalized = normalizeInboundWebhook(provider, rawBody, headers);
    if (!normalized.msisdn) {
      throw new OpdBookingError(
        'MISSING_MSISDN',
        'Inbound SMS webhook is missing sender phone number (msisdn)',
        400
      );
    }

    const nowDate = options?.now instanceof Date ? options.now : new Date();
    const nowIso = nowDate.toISOString();

    // 3. Check idempotency in turnCache & sms_inbox by providerMsgId
    const cachedTurn = this.turnCache.get(normalized.providerMsgId);
    if (cachedTurn) {
      return {
        ...cachedTurn,
        duplicate: true,
        deduplicated: true,
      };
    }

    const inboxEntry = this.store.recordInboundSms({
      providerMsgId: normalized.providerMsgId,
      provider: normalized.provider,
      msisdn: normalized.msisdn,
      body: normalized.rawText,
      receivedAt: normalized.receivedAt || nowIso,
      status: 'RECEIVED',
    });

    if (inboxEntry.deduplicated) {
      const existingInbox = inboxEntry.record;
      const existingBooking = existingInbox.bookingId
        ? this.store.getBookingById(existingInbox.bookingId)
        : null;
      const recentOutbound = this.store
        .listSmsMessages({
          msisdn: normalized.msisdn,
          direction: 'OUTBOUND',
          limit: 5,
        })
        .find(
          (msg) =>
            !existingBooking || msg.bookingId === existingBooking.id
        );

      const fallbackParsed =
        existingInbox.parsedJson ||
        parseInboundSms({
          messageId: normalized.providerMsgId,
          msisdn: normalized.msisdn,
          text: normalized.rawText,
          now: nowDate,
        });

      const fallbackOutbound: SmsMessageRecord = recentOutbound || {
        id: `out_dup_${normalized.providerMsgId}`,
        providerMessageId: `dup-${normalized.providerMsgId}`,
        provider: normalized.provider,
        direction: 'OUTBOUND',
        msisdn: normalized.msisdn,
        body: DLT_TEMPLATES.HELP_MENU.render({}),
        bookingId: existingBooking?.id ?? null,
        templateId: DLT_TEMPLATES.HELP_MENU.templateId,
        status: 'SENT',
        dlrStatus: 'DELIVERED',
        createdAt: existingInbox.createdAt,
      };

      const check = validateGsm7SingleSegment(fallbackOutbound.body);
      return {
        duplicate: true,
        deduplicated: true,
        provider: normalized.provider,
        inbound: existingInbox,
        parsed: fallbackParsed,
        actionTaken: 'HELP_SENT',
        booking: existingBooking,
        outboundSms: fallbackOutbound,
        replyText: fallbackOutbound.body,
        templateId:
          fallbackOutbound.templateId || DLT_TEMPLATES.HELP_MENU.templateId,
        characterCount: check.length,
        segments: check.segments,
      };
    }

    // 4. Enforce per-MSISDN sliding-window rate limit (10 SMS / 15 min)
    if (!options?.bypassRateLimit) {
      const rateCheck = checkSmsRateLimit(normalized.msisdn, {
        nowMs: nowDate.getTime(),
      });
      if (!rateCheck.allowed) {
        this.store.updateInboundSms(inboxEntry.record.id, {
          status: 'RATE_LIMITED',
        });
        this.store.recordAuditEvent({
          actorType: 'SMS_GATEWAY',
          actorId: normalized.msisdn,
          action: 'SMS_RATE_LIMITED',
          entityType: 'SMS_INBOX',
          entityId: inboxEntry.record.id,
          payload: {
            provider: normalized.provider,
            providerMsgId: normalized.providerMsgId,
            count: rateCheck.count,
            limit: rateCheck.limit,
            resetAt: rateCheck.resetAt,
          },
        });
        throw new OpdBookingError(
          'SMS_RATE_LIMIT_EXCEEDED',
          rateCheck.reason ||
            'Too many SMS requests from this phone number. Please wait 15 minutes.',
          429
        );
      }
    }

    // 5. Run deterministic SMS parser (Agent A4)
    const parsed = parseInboundSms({
      messageId: normalized.providerMsgId,
      msisdn: normalized.msisdn,
      text: normalized.rawText,
      receivedAt: normalized.receivedAt,
      now: nowDate,
    });

    // 6. Update sms_inbox with parsed intent, confidence, and parsed_json
    this.store.updateInboundSms(inboxEntry.record.id, {
      parsedJson: parsed,
      status: 'PARSED',
    });

    // 7. Execute intent state machine against A2 Booking Core & A1 Store
    const execution = this.executeParsedIntent(
      normalized.msisdn,
      parsed,
      nowDate
    );

    // 8. Dispatch via A3 adapter & record outbound SMS in sms_outbox
    const adapter = getSmsGatewayAdapter(normalized.provider);
    const dispatched = adapter.sendSms({
      msisdn: normalized.msisdn,
      message: execution.replyText,
      templateKey: execution.templateKey,
      templateId: execution.templateId,
      bookingId: execution.booking?.id,
    });

    const outboundSms = this.store.recordOutboundSms({
      bookingId: execution.booking?.id ?? null,
      msisdn: normalized.msisdn,
      templateId: dispatched.templateId,
      rendered: dispatched.renderedText,
      provider: normalized.provider,
      providerMsgId: dispatched.providerMsgId,
      status: dispatched.status,
      dlrStatus: dispatched.dlrStatus,
    });

    this.store.updateInboundSms(inboxEntry.record.id, {
      parsedJson: parsed,
      bookingId: execution.booking?.id ?? null,
      status: 'PROCESSED',
    });

    const refreshedInbound: SmsMessageRecord = {
      ...inboxEntry.record,
      parsedJson: parsed,
      bookingId: execution.booking?.id ?? null,
      status: 'PROCESSED',
    };

    const result: SmsOrchestratorTurnResult = {
      duplicate: false,
      deduplicated: false,
      provider: normalized.provider,
      inbound: refreshedInbound,
      parsed,
      actionTaken: execution.actionTaken,
      booking: execution.booking,
      outboundSms,
      replyText: dispatched.renderedText,
      templateId: dispatched.templateId,
      characterCount: dispatched.characterCount,
      segments: dispatched.segments,
    };

    this.turnCache.set(normalized.providerMsgId, result);
    return result;
  }

  /**
   * Executes the parsed SMS intent and returns the action taken, booking record,
   * and DLT-compliant single-segment reply text.
   */
  private executeParsedIntent(
    msisdn: string,
    parsed: SmsParseResult,
    nowDate: Date
  ): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    switch (parsed.intent) {
      case 'BOOK':
        return this.executeBookIntent(msisdn, parsed, nowDate);

      case 'CONFIRM':
        return this.executeConfirmIntent(msisdn, parsed, nowDate);

      case 'CANCEL':
        return this.executeCancelIntent(msisdn, parsed);

      case 'STATUS':
        return this.executeStatusIntent(msisdn, parsed);

      case 'LIST':
        return this.executeListIntent(parsed);

      case 'HELP': {
        const rendered = renderDltTemplate('HELP_MENU', {});
        return {
          actionTaken: 'HELP_SENT',
          booking: null,
          templateKey: 'HELP_MENU',
          templateId: rendered.templateId,
          replyText: rendered.text,
        };
      }

      case 'UNKNOWN':
      default: {
        const rendered = renderDltTemplate('HELP_MENU', {});
        return {
          actionTaken: 'UNKNOWN_FALLBACK_HELP',
          booking: null,
          templateKey: 'HELP_MENU',
          templateId: rendered.templateId,
          replyText: rendered.text,
        };
      }
    }
  }

  /**
   * Handles `BOOK` intent:
   * - Enforces safety invariant: any `parseErrors`, missing `facilityCode`/`deptCode`, or `confidence < 0.75`
   *   never creates a hold and instead replies with DLT `HELP_MENU`.
   * - Checks if requested date/session has capacity; if full, automatically falls back to the next
   *   available session/day (`SLOT_FULL_FALLBACK`) and creates a 10-min `PENDING_CONFIRMATION` hold.
   */
  private executeBookIntent(
    msisdn: string,
    parsed: SmsParseResult,
    nowDate: Date
  ): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    if (
      parsed.parseErrors.length > 0 ||
      !parsed.entities.facilityCode ||
      !parsed.entities.deptCode ||
      parsed.confidence < 0.75
    ) {
      const rendered = renderDltTemplate('HELP_MENU', {});
      return {
        actionTaken: 'PARSE_ERROR_HELP',
        booking: null,
        templateKey: 'HELP_MENU',
        templateId: rendered.templateId,
        replyText: rendered.text,
      };
    }

    this.store.expireStaleHolds();

    const facilityCode = parsed.entities.facilityCode;
    const deptCode = parsed.entities.deptCode;
    const requestedDate =
      parsed.entities.requestedDate ||
      parsed.entities.date ||
      getTodayIstDateString(nowDate);
    const requestedSession = parsed.entities.session || null;

    // Inspect sessions on the requested date
    const sameDaySessions = this.store.ensureSessionsForDate(
      facilityCode,
      deptCode,
      requestedDate
    );

    if (sameDaySessions.length === 0) {
      const rendered = renderDltTemplate('HELP_MENU', {});
      return {
        actionTaken: 'PARSE_ERROR_HELP',
        booking: null,
        templateKey: 'HELP_MENU',
        templateId: rendered.templateId,
        replyText: rendered.text,
      };
    }

    let chosenSession: SessionSlotRecord | null = null;
    let isFallbackSlot = false;

    if (requestedSession) {
      const exactSession = sameDaySessions.find(
        (s) => s.session === requestedSession
      );
      if (exactSession && exactSession.availableCount > 0) {
        chosenSession = exactSession;
      } else {
        // Check other session on same day first
        const altSameDay = sameDaySessions.find(
          (s) => s.session !== requestedSession && s.availableCount > 0
        );
        if (altSameDay) {
          chosenSession = altSameDay;
          isFallbackSlot = true;
        }
      }
    } else {
      const morning = sameDaySessions.find((s) => s.session === 'MORNING');
      const afternoon = sameDaySessions.find((s) => s.session === 'AFTERNOON');
      if (morning && morning.availableCount > 0) {
        chosenSession = morning;
      } else if (afternoon && afternoon.availableCount > 0) {
        chosenSession = afternoon;
      }
    }

    // If requested date is completely full, search next 7 days for next available slot
    if (!chosenSession) {
      const baseMs = new Date(`${requestedDate}T00:00:00.000Z`).getTime();
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const nextDate = new Date(baseMs + dayOffset * 86400000)
          .toISOString()
          .slice(0, 10);
        const nextSessions = this.store.ensureSessionsForDate(
          facilityCode,
          deptCode,
          nextDate
        );
        const openSession = nextSessions.find((s) => s.availableCount > 0);
        if (openSession) {
          chosenSession = openSession;
          isFallbackSlot = true;
          break;
        }
      }
    }

    if (!chosenSession) {
      const text = enforceSingleSegmentGsm7(
        `MedVeda: All slots full at ${facilityCode} ${deptCode} for the next 7 days. Try another hospital via LIST ${deptCode}.`
      );
      return {
        actionTaken: 'SLOT_FULL_FALLBACK',
        booking: null,
        templateKey: 'SLOT_FULL_FALLBACK',
        templateId: DLT_TEMPLATES.SLOT_FULL_FALLBACK.templateId,
        replyText: text,
      };
    }

    try {
      const holdBooking = this.store.createHoldOrBooking({
        facilityCode,
        deptCode,
        sessionId: chosenSession.id,
        date: chosenSession.date,
        session: chosenSession.session,
        phone: msisdn,
        channel: 'SMS',
        mode: 'HOLD',
        allowReservedQuota: true,
        actorId: msisdn,
      });

      this.holdReferenceTimeMs.set(holdBooking.id, nowDate.getTime());

      if (isFallbackSlot) {
        const rendered = renderDltTemplate('SLOT_FULL_FALLBACK', {
          requestedDate,
          altDate: holdBooking.slotDate,
          deptCode: holdBooking.deptCode,
          facilityCode: holdBooking.facilityCode,
          reportingWindow: holdBooking.reportingWindow,
          confirmCode: holdBooking.confirmCode,
        });
        return {
          actionTaken: 'SLOT_FULL_FALLBACK',
          booking: holdBooking,
          templateKey: 'SLOT_FULL_FALLBACK',
          templateId: rendered.templateId,
          replyText: rendered.text,
        };
      }

      const rendered = renderDltTemplate('HOLD_CREATED', {
        facilityCode: holdBooking.facilityCode,
        deptCode: holdBooking.deptCode,
        slotDate: holdBooking.slotDate,
        reportingWindow: holdBooking.reportingWindow,
        confirmCode: holdBooking.confirmCode,
      });

      return {
        actionTaken: 'HOLD_CREATED',
        booking: holdBooking,
        templateKey: 'HOLD_CREATED',
        templateId: rendered.templateId,
        replyText: rendered.text,
      };
    } catch (err) {
      if (
        err instanceof OpdBookingError &&
        err.code === 'DUPLICATE_ACTIVE_BOOKING'
      ) {
        const existingBookings = this.store.listBookingsByPhone(msisdn, 10);
        const existingActive =
          existingBookings.find(
            (b) =>
              b.deptCode === deptCode &&
              b.slotDate === chosenSession!.date &&
              (b.status === 'CONFIRMED' || b.status === 'ARRIVED')
          ) || existingBookings[0] || null;

        if (existingActive) {
          const rendered = renderDltTemplate('BOOKING_STATUS', {
            status: existingActive.status,
            tokenNumber: existingActive.tokenNumber,
            facilityCode: existingActive.facilityCode,
            deptCode: existingActive.deptCode,
            slotDate: existingActive.slotDate,
            reportingWindow: existingActive.reportingWindow,
            trackingId: existingActive.trackingId,
            trackingIdRaw: existingActive.trackingIdRaw,
          });
          return {
            actionTaken: 'DUPLICATE_ACTIVE_BOOKING',
            booking: existingActive,
            templateKey: 'BOOKING_STATUS',
            templateId: rendered.templateId,
            replyText: rendered.text,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Handles `CONFIRM` intent:
   * - Confirms pending hold by `(msisdn, confirmCode)` or latest active hold for `msisdn` if bare `Y` was sent.
   * - Detects expired holds (`EXPIRED`, wall-clock TTL elapsed, or simulated `now` >= +10m) and explains how to re-book.
   * - On success (`CONFIRMED`), replies with single-segment <= 160 char DLT confirmation SMS.
   */
  private executeConfirmIntent(
    msisdn: string,
    parsed: SmsParseResult,
    nowDate: Date
  ): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    const wallNowIso = new Date().toISOString();
    const confirmCode = parsed.entities.confirmCode;
    const recentBookings = this.store.listBookingsByPhone(msisdn, 10);

    // Locate candidate hold by confirmCode or latest PENDING_CONFIRMATION/EXPIRED hold
    let candidate: BookingRecord | undefined;
    if (confirmCode) {
      candidate = recentBookings.find((b) => b.confirmCode === confirmCode);
    } else {
      candidate =
        recentBookings.find((b) => b.status === 'PENDING_CONFIRMATION') ||
        recentBookings.find((b) => b.status === 'EXPIRED');
    }

    if (!candidate) {
      const replyText = enforceSingleSegmentGsm7(
        'MedVeda: No active slot hold found. Send OPD <HOSP> <DEPT> (e.g. OPD DHJ01 MED) to book an appointment.'
      );
      return {
        actionTaken: 'HOLD_NOT_FOUND',
        booking: null,
        templateKey: 'HELP_MENU',
        templateId: DLT_TEMPLATES.HELP_MENU.templateId,
        replyText,
      };
    }

    const holdRefMs =
      this.holdReferenceTimeMs.get(candidate.id) ??
      new Date(candidate.createdAt).getTime();
    const isSimulatedExpired =
      nowDate.getTime() - holdRefMs >= DEFAULT_HOLD_TTL_MS;
    const isWallExpired =
      candidate.holdExpiresAt !== null &&
      candidate.holdExpiresAt <= wallNowIso;

    if (
      candidate.status === 'EXPIRED' ||
      (candidate.status === 'PENDING_CONFIRMATION' &&
        (isWallExpired || isSimulatedExpired))
    ) {
      const expireCutoffIso = isSimulatedExpired
        ? new Date(Date.now() + DEFAULT_HOLD_TTL_MS * 2).toISOString()
        : wallNowIso;
      this.store.expireStaleHolds(expireCutoffIso);
      const expiredRecord =
        this.store.getBookingById(candidate.id) || candidate;
      const replyText = enforceSingleSegmentGsm7(
        `MedVeda: Hold for ${expiredRecord.facilityCode} ${expiredRecord.deptCode} EXPIRED (10m limit). Send OPD ${expiredRecord.facilityCode} ${expiredRecord.deptCode} to re-book.`
      );
      return {
        actionTaken: 'HOLD_EXPIRED',
        booking: expiredRecord,
        templateKey: 'BOOKING_STATUS',
        templateId: DLT_TEMPLATES.BOOKING_STATUS.templateId,
        replyText,
      };
    }

    try {
      const confirmed = this.store.confirmPendingBooking({
        bookingId: candidate.id,
        msisdn,
        confirmCode,
        actorId: msisdn,
      });

      const rendered = renderDltTemplate('BOOKING_CONFIRMED', {
        tokenNumber: confirmed.tokenNumber,
        facilityCode: confirmed.facilityCode,
        deptCode: confirmed.deptCode,
        slotDate: confirmed.slotDate,
        reportingWindow: confirmed.reportingWindow,
        trackingId: confirmed.trackingId,
        trackingIdRaw: confirmed.trackingIdRaw,
      });

      return {
        actionTaken: 'BOOKING_CONFIRMED',
        booking: confirmed,
        templateKey: 'BOOKING_CONFIRMED',
        templateId: rendered.templateId,
        replyText: rendered.text,
      };
    } catch (err) {
      if (err instanceof OpdBookingError && err.code === 'HOLD_EXPIRED') {
        const expiredRecord =
          this.store.getBookingById(candidate.id) || candidate;
        const replyText = enforceSingleSegmentGsm7(
          `MedVeda: Hold for ${expiredRecord.facilityCode} ${expiredRecord.deptCode} EXPIRED (10m limit). Send OPD ${expiredRecord.facilityCode} ${expiredRecord.deptCode} to re-book.`
        );
        return {
          actionTaken: 'HOLD_EXPIRED',
          booking: expiredRecord,
          templateKey: 'BOOKING_STATUS',
          templateId: DLT_TEMPLATES.BOOKING_STATUS.templateId,
          replyText,
        };
      }
      throw err;
    }
  }

  /**
   * Handles `CANCEL` intent:
   * - Cancels by `trackingId`, `confirmCode`, or latest active booking/hold for `msisdn`.
   */
  private executeCancelIntent(
    msisdn: string,
    parsed: SmsParseResult
  ): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    this.store.expireStaleHolds();

    try {
      const cancelled = this.store.cancelBooking({
        idOrTrackingId: parsed.entities.trackingId || undefined,
        msisdn,
        confirmCode: parsed.entities.confirmCode,
        reason: 'SMS_USER_CANCELLED',
        actorId: msisdn,
      });

      const rendered = renderDltTemplate('BOOKING_CANCELLED', {
        trackingId: cancelled.trackingId,
        trackingIdRaw: cancelled.trackingIdRaw,
        facilityCode: cancelled.facilityCode,
        deptCode: cancelled.deptCode,
      });

      return {
        actionTaken: 'BOOKING_CANCELLED',
        booking: cancelled,
        templateKey: 'BOOKING_CANCELLED',
        templateId: rendered.templateId,
        replyText: rendered.text,
      };
    } catch (err) {
      if (err instanceof OpdBookingError && err.code === 'BOOKING_NOT_FOUND') {
        const replyText = enforceSingleSegmentGsm7(
          'MedVeda: No active booking found to cancel. Send STATUS <ID> or HELP for assistance.'
        );
        return {
          actionTaken: 'BOOKING_NOT_FOUND',
          booking: null,
          templateKey: 'BOOKING_STATUS',
          templateId: DLT_TEMPLATES.BOOKING_STATUS.templateId,
          replyText,
        };
      }
      throw err;
    }
  }

  /**
   * Handles `STATUS` intent:
   * - Looks up by `trackingId` or latest booking for `msisdn`.
   */
  private executeStatusIntent(
    msisdn: string,
    parsed: SmsParseResult
  ): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    this.store.expireStaleHolds();

    let booking: BookingRecord | null = null;
    if (parsed.entities.trackingId) {
      booking = this.store.getBookingByTrackingId(parsed.entities.trackingId);
    } else {
      const recent = this.store.listBookingsByPhone(msisdn, 5);
      booking =
        recent.find(
          (b) =>
            b.status === 'CONFIRMED' ||
            b.status === 'ARRIVED' ||
            b.status === 'PENDING_CONFIRMATION'
        ) ||
        recent[0] ||
        null;
    }

    if (!booking) {
      const replyText = enforceSingleSegmentGsm7(
        'MedVeda: No booking found. Send OPD <HOSP> <DEPT> (e.g. OPD DHJ01 MED) to book an appointment.'
      );
      return {
        actionTaken: 'BOOKING_NOT_FOUND',
        booking: null,
        templateKey: 'BOOKING_STATUS',
        templateId: DLT_TEMPLATES.BOOKING_STATUS.templateId,
        replyText,
      };
    }

    const rendered = renderDltTemplate('BOOKING_STATUS', {
      status: booking.status,
      tokenNumber: booking.tokenNumber,
      estimatedTokenNumber: booking.estimatedTokenNumber,
      facilityCode: booking.facilityCode,
      deptCode: booking.deptCode,
      slotDate: booking.slotDate,
      reportingWindow: booking.reportingWindow,
      trackingId: booking.trackingId,
      trackingIdRaw: booking.trackingIdRaw,
      confirmCode: booking.confirmCode,
    });

    return {
      actionTaken: 'STATUS_RETURNED',
      booking,
      templateKey: 'BOOKING_STATUS',
      templateId: rendered.templateId,
      replyText: rendered.text,
    };
  }

  /**
   * Handles `LIST` intent:
   * - Lists active facility codes & names (filtered by department if provided) in <= 160 chars.
   */
  private executeListIntent(parsed: SmsParseResult): {
    actionTaken: SmsOrchestratorAction;
    booking: BookingRecord | null;
    templateKey: DltTemplateKey;
    templateId: string;
    replyText: string;
  } {
    const deptCode = parsed.entities.deptCode;
    const facilities = this.store.listFacilities({ activeOnly: true });

    const filtered = deptCode
      ? facilities.filter((f) => {
          const depts = this.store.listDepartments(f.code);
          return depts.some((d) => d.code === deptCode);
        })
      : facilities;

    const listStr = filtered
      .map((f) => `${f.code}:${f.district}`)
      .join(', ');

    const rendered = renderDltTemplate('LIST_FACILITIES', {
      deptCode: deptCode || undefined,
      facilityList: listStr,
    });

    return {
      actionTaken: 'FACILITIES_LISTED',
      booking: null,
      templateKey: 'LIST_FACILITIES',
      templateId: rendered.templateId,
      replyText: rendered.text,
    };
  }

  /**
   * Handles Delivery Receipt (DLR) webhooks from `simulator`, `android-gateway`, or `msg91`.
   */
  public handleDeliveryReceipt(
    provider: string,
    payload: any,
    headers?: Record<string, any>
  ): {
    provider: SmsProviderType;
    providerMsgId: string;
    dlrStatus: string;
    updated: boolean;
    record: SmsMessageRecord | null;
  } {
    const parsedDlr = parseDlrWebhook(provider, payload, headers);
    const updatedRecord = parsedDlr.providerMsgId
      ? this.store.updateOutboundDlr(
          parsedDlr.providerMsgId,
          parsedDlr.dlrStatus,
          parsedDlr.status
        )
      : null;

    if (updatedRecord) {
      this.store.recordAuditEvent({
        actorType: 'SMS_GATEWAY',
        actorId: parsedDlr.provider,
        action: 'SMS_DLR_UPDATED',
        entityType: 'SMS_OUTBOX',
        entityId: updatedRecord.id,
        payload: {
          providerMsgId: parsedDlr.providerMsgId,
          dlrStatus: parsedDlr.dlrStatus,
          updatedAt: parsedDlr.updatedAt,
        },
      });
    }

    return {
      provider: parsedDlr.provider,
      providerMsgId: parsedDlr.providerMsgId,
      dlrStatus: parsedDlr.dlrStatus,
      updated: Boolean(updatedRecord),
      record: updatedRecord,
    };
  }
}

let sharedSmsOrchestratorInstance: OpdSmsOrchestrator | null = null;

export function getOpdSmsOrchestrator(
  store?: SqliteOpdBookingStore,
  core?: OpdBookingCoreUseCase
): OpdSmsOrchestrator {
  if (store || core) {
    return new OpdSmsOrchestrator(store, core);
  }
  if (!sharedSmsOrchestratorInstance) {
    sharedSmsOrchestratorInstance = new OpdSmsOrchestrator();
  }
  return sharedSmsOrchestratorInstance;
}
