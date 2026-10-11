import {
  computeCrockfordCheckChar,
  formatTrackingId,
  generateConfirmCode,
  generateTrackingId,
  normalizeChannel,
  normalizeCrockford,
  normalizeMsisdn,
  signQrPayload,
  validateTrackingId,
  verifyQrPayload,
  type AdminQueueSnapshot,
  type BookingChannel,
  type BookingRecord,
  type CounterLookupResult,
  type DepartmentRecord,
  type FacilityRecord,
  type QrPayload,
  type SessionPeriod,
  type SessionSlotRecord,
  type SmsMessageRecord,
} from '../../../../packages/contracts/index.ts';
import {
  computeReportingWindow,
  getOpdBookingStore,
  getTodayIstDateString,
  OpdBookingError,
  SqliteOpdBookingStore,
} from '../../infrastructure/db/sqlite-opd-booking.store.ts';
import {
  renderDltTemplate,
  type SmsProviderType,
} from '../../infrastructure/sms/sms-gateway.adapter.ts';

export {
  computeCrockfordCheckChar,
  formatTrackingId,
  generateConfirmCode,
  generateTrackingId,
  OpdBookingError,
  signQrPayload,
  validateTrackingId,
  verifyQrPayload,
};

// ============================================================================
// 1. INTERFACES & DTOs (AGENT A2 — BOOKING CORE ENGINE)
// ============================================================================

export const DEFAULT_OPD_HELPLINE_MSISDN =
  process.env.MEDVEDA_OPD_SMS_SHORTCODE || '+919876500108';

export interface EnrichedSessionSlot extends SessionSlotRecord {
  capacity: number;
  availableTotal: number;
  availableWeb: number;
  reportingWindow: string;
}

export interface CreateWebOrQrBookingInput {
  facilityCode?: string;
  facilityId?: string;
  deptCode?: string;
  deptId?: string;
  departmentId?: string;
  sessionId?: string;
  date?: string;
  session?: SessionPeriod;
  phone?: string;
  msisdn?: string;
  patientName?: string | null;
  name?: string | null;
  abhaAddress?: string | null;
  abhaNumberHash?: string | null;
  abhaVerified?: boolean;
  otpVerified?: boolean;
  channel?: BookingChannel | string;
  autoConfirm?: boolean;
  mode?: 'HOLD' | 'IMMEDIATE_CONFIRM';
  qrToken?: string;
  holdTtlMs?: number;
  allowReservedQuota?: boolean;
  trackingIdSeed?: string;
  customConfirmCode?: string;
  actorId?: string;
  smsProvider?: SmsProviderType;
}

export interface CreateBookingResult {
  booking: BookingRecord;
  trackingId: string;
  trackingIdRaw: string;
  tokenNumber: number | null;
  estimatedTokenNumber: number | null;
  status: BookingRecord['status'];
  channel: BookingChannel;
  qrToken: string;
  qrDeepLink: string;
  confirmCode: string | null;
  holdExpiresAt: string | null;
  reportingTime: string;
  reportingWindow: string;
  smsConfirmationText: string;
  smsOutbox: SmsMessageRecord;
}

export interface CounterLookupExtendedResult extends CounterLookupResult {
  validCheckChar: boolean;
  reason?: string;
}

export interface OpdSlipSummary {
  slipNumber: string;
  tokenNumber: number | null;
  trackingId: string;
  facilityName: string;
  facilityCode: string;
  deptName: string;
  departmentName: string;
  deptCode: string;
  roomNumber: string;
  slotDate: string;
  session: SessionPeriod;
  reportingTime: string;
  reportingWindow: string;
  patientMaskedName: string;
  maskedPatientName: string;
  phoneLast4: string;
  channel: BookingChannel;
  status: BookingRecord['status'];
  arrivedAt: string | null;
  printedAt: string;
}

export interface MarkArrivedResult {
  found: boolean;
  validCheckChar: boolean;
  checksumValid: boolean;
  error?: string;
  booking?: BookingRecord;
  slip?: OpdSlipSummary;
  slipNumber?: string;
  tokenNumber?: number | null;
  trackingId?: string;
  facilityName?: string;
  deptName?: string;
  roomNumber?: string;
  session?: SessionPeriod;
  reportingTime?: string;
  patientMaskedName?: string;
  phoneLast4?: string;
  arrivedAt?: string | null;
}

export interface DepartmentPosterItem {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  departmentId: string;
  deptCode: string;
  deptName: string;
  roomNumber: string;
  morningHours: string;
  afternoonHours: string;
  date: string;
  qrToken: string;
  qrDeepLink: string;
  pwaDeepLink: string;
  smsHelpline: string;
  smsCommand: string;
  smsUri: string;
}

// ============================================================================
// 2. OPD BOOKING CORE USE-CASE
// ============================================================================

export class OpdBookingCoreUseCase {
  private readonly store: SqliteOpdBookingStore;

  constructor(store?: SqliteOpdBookingStore) {
    this.store = store || getOpdBookingStore();
  }

  public getStore(): SqliteOpdBookingStore {
    return this.store;
  }

  /**
   * Lists active OPD facilities with optional district or keyword filtering.
   */
  public listFacilities(filter?: {
    district?: string;
    search?: string;
    activeOnly?: boolean;
  }): FacilityRecord[] {
    return this.store.listFacilities(filter);
  }

  /**
   * Resolves a single facility by its canonical code (e.g. `DHJ01`) or ID (`fac_dhj01`).
   */
  public getFacility(facilityCodeOrId: string): FacilityRecord | null {
    return this.store.getFacilityByCodeOrId(facilityCodeOrId);
  }

  /**
   * Lists active OPD departments for a given facility code or ID.
   */
  public listDepartments(facilityCodeOrId: string): DepartmentRecord[] {
    return this.store.listDepartments(facilityCodeOrId);
  }

  /**
   * Auto-expires stale holds first and returns session capacity, bookedCount, heldCount,
   * availableTotal, availableWeb, reservedSmsQuota, and reportingWindow.
   */
  public listSessions(params: {
    facilityCode?: string;
    facilityId?: string;
    deptCode?: string;
    deptId?: string;
    departmentId?: string;
    date?: string;
  }): EnrichedSessionSlot[] {
    const targetDate = params.date || getTodayIstDateString();
    this.store.expireStaleHolds();

    const facCodeOrId = params.facilityCode || params.facilityId;
    const deptCodeOrId =
      params.deptCode || params.deptId || params.departmentId;

    let rawSessions: SessionSlotRecord[] = [];

    if (deptCodeOrId) {
      rawSessions = this.store.listSessions({
        facilityCodeOrId: facCodeOrId,
        deptCodeOrId,
        date: targetDate,
      });
    } else {
      const targetFac = facCodeOrId || 'DHJ01';
      const depts = this.store.listDepartments(targetFac);
      for (const dept of depts) {
        const deptSessions = this.store.listSessions({
          facilityCodeOrId: targetFac,
          deptCodeOrId: dept.code,
          date: targetDate,
        });
        rawSessions.push(...deptSessions);
      }
    }

    return rawSessions.map((s) => this.enrichSessionSlot(s));
  }

  private enrichSessionSlot(s: SessionSlotRecord): EnrichedSessionSlot {
    const occupied = s.bookedCount + s.heldCount;
    const webCeiling = Math.max(0, s.totalCapacity - s.reservedSmsQuota);
    const availableWeb = Math.max(0, webCeiling - occupied);
    const reportingWindow = computeReportingWindow(
      s.session,
      s.nextEstimatedToken
    );

    return {
      ...s,
      capacity: s.totalCapacity,
      availableTotal: s.availableCount,
      availableWeb,
      reportingWindow,
    };
  }

  /**
   * Creates a Web, QR Walk-in, Counter, or SMS booking (either immediate confirmation or 10-min hold).
   * - Verifies HMAC-signed walk-in QR payload when `qrToken` is supplied.
   * - Generates a signed booking QR token (`/q/<signedPayload>`).
   * - Formats and persists the corresponding TRAI DLT SMS message in `sms_outbox`.
   */
  public createWebOrQrBooking(
    input: CreateWebOrQrBookingInput
  ): CreateBookingResult {
    const phone = normalizeMsisdn(input.phone || input.msisdn || '');
    if (!phone) {
      throw new OpdBookingError(
        'INVALID_PHONE',
        'A valid 10-digit Indian mobile number is required to book an OPD appointment.',
        400
      );
    }

    let channel = normalizeChannel(input.channel);
    let facilityCode = input.facilityCode || input.facilityId;
    let deptCode = input.deptCode || input.deptId || input.departmentId;
    let date = input.date;
    let session = input.session;

    // If a walk-in QR token is provided, verify its HMAC-SHA256 signature and extract department details
    if (input.qrToken) {
      const verified = verifyQrPayload(input.qrToken);
      if (!verified.valid || !verified.payload) {
        throw new OpdBookingError(
          'INVALID_QR_TOKEN',
          verified.error || 'Invalid or expired hospital walk-in QR code.',
          400
        );
      }
      if (!input.channel) {
        channel = 'QR_WALKIN';
      }
      facilityCode = facilityCode || verified.payload.facilityCode;
      deptCode = deptCode || verified.payload.deptCode;
      date = date || verified.payload.date;
      session = session || verified.payload.session;
    }

    // Determine whether to immediately confirm or create a 10-minute slot hold
    const shouldAutoConfirm =
      input.mode !== undefined
        ? input.mode === 'IMMEDIATE_CONFIRM'
        : input.autoConfirm !== undefined
          ? input.autoConfirm
          : channel !== 'SMS';

    const mode: 'HOLD' | 'IMMEDIATE_CONFIRM' = shouldAutoConfirm
      ? 'IMMEDIATE_CONFIRM'
      : 'HOLD';

    const booking = this.store.createHoldOrBooking({
      facilityCode,
      facilityId: input.facilityId,
      deptCode,
      departmentId: input.departmentId || input.deptId,
      sessionId: input.sessionId,
      date,
      session,
      phone,
      patientName: input.patientName ?? input.name ?? null,
      abhaAddress: input.abhaAddress ?? null,
      abhaNumberHash: input.abhaNumberHash ?? null,
      abhaVerified: Boolean(input.abhaVerified),
      channel,
      mode,
      holdTtlMs: input.holdTtlMs,
      allowReservedQuota:
        input.allowReservedQuota ??
        (channel === 'QR_WALKIN' || channel === 'SMS' || channel === 'COUNTER'),
      trackingIdSeed: input.trackingIdSeed,
      customConfirmCode: input.customConfirmCode,
      actorId: input.actorId,
    });

    const qrToken =
      booking.qrPayload ||
      signQrPayload({
        type: 'BOOKING',
        id: booking.id,
        facilityCode: booking.facilityCode,
        deptCode: booking.deptCode,
        date: booking.slotDate,
        tokenNumber: booking.tokenNumber ?? booking.estimatedTokenNumber ?? 1,
        trackingId: booking.trackingId,
        session: booking.session,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      });

    const dltKey =
      booking.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'HOLD_CREATED';
    const renderedSms = renderDltTemplate(dltKey, {
      facilityCode: booking.facilityCode,
      deptCode: booking.deptCode,
      slotDate: booking.slotDate,
      reportingWindow: booking.reportingWindow,
      tokenNumber: booking.tokenNumber ?? booking.estimatedTokenNumber ?? 1,
      trackingId: booking.trackingId,
      trackingIdRaw: booking.trackingIdRaw,
      confirmCode: booking.confirmCode,
    });

    const smsOutbox = this.store.recordOutboundSms({
      bookingId: booking.id,
      msisdn: booking.msisdnNormalized,
      templateId: renderedSms.templateId,
      rendered: renderedSms.text,
      provider: input.smsProvider || 'simulator',
      status: 'SENT',
      dlrStatus: 'DELIVERED',
    });

    return {
      booking,
      trackingId: booking.trackingId,
      trackingIdRaw:
        booking.trackingIdRaw || booking.trackingId.replace(/-/g, ''),
      tokenNumber: booking.tokenNumber,
      estimatedTokenNumber: booking.estimatedTokenNumber ?? booking.tokenNumber,
      status: booking.status,
      channel: booking.channel,
      qrToken,
      qrDeepLink: `/q/${qrToken}`,
      confirmCode: booking.confirmCode,
      holdExpiresAt: booking.holdExpiresAt,
      reportingTime: booking.reportingWindow,
      reportingWindow: booking.reportingWindow,
      smsConfirmationText: renderedSms.text,
      smsOutbox,
    };
  }

  /**
   * Convenience wrapper to create a 10-minute `PENDING_CONFIRMATION` slot hold.
   */
  public createSlotHold(
    input: Omit<CreateWebOrQrBookingInput, 'autoConfirm' | 'mode'>
  ): CreateBookingResult {
    return this.createWebOrQrBooking({
      ...input,
      autoConfirm: false,
      mode: 'HOLD',
    });
  }

  /**
   * Confirms a pending slot hold by `bookingId`, `(msisdn, confirmCode)`, or bare `msisdn`
   * (if only one active hold exists for that phone). Idempotent if already `CONFIRMED`.
   */
  public confirmHold(params: {
    bookingId?: string;
    idOrTrackingId?: string;
    msisdn?: string;
    phone?: string;
    confirmCode?: string | null;
    actorId?: string;
    smsProvider?: SmsProviderType;
  }): CreateBookingResult {
    const booking = this.store.confirmPendingBooking({
      bookingId: params.bookingId || params.idOrTrackingId,
      msisdn: params.msisdn || params.phone,
      confirmCode: params.confirmCode,
      actorId: params.actorId,
    });

    const qrToken =
      booking.qrPayload ||
      signQrPayload({
        type: 'BOOKING',
        id: booking.id,
        facilityCode: booking.facilityCode,
        deptCode: booking.deptCode,
        date: booking.slotDate,
        tokenNumber: booking.tokenNumber ?? 1,
        trackingId: booking.trackingId,
        session: booking.session,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      });

    const renderedSms = renderDltTemplate('BOOKING_CONFIRMED', {
      facilityCode: booking.facilityCode,
      deptCode: booking.deptCode,
      slotDate: booking.slotDate,
      reportingWindow: booking.reportingWindow,
      tokenNumber: booking.tokenNumber ?? 1,
      trackingId: booking.trackingId,
      trackingIdRaw: booking.trackingIdRaw,
    });

    const smsOutbox = this.store.recordOutboundSms({
      bookingId: booking.id,
      msisdn: booking.msisdnNormalized,
      templateId: renderedSms.templateId,
      rendered: renderedSms.text,
      provider: params.smsProvider || 'simulator',
      status: 'SENT',
      dlrStatus: 'DELIVERED',
    });

    return {
      booking,
      trackingId: booking.trackingId,
      trackingIdRaw:
        booking.trackingIdRaw || booking.trackingId.replace(/-/g, ''),
      tokenNumber: booking.tokenNumber,
      estimatedTokenNumber: booking.estimatedTokenNumber ?? booking.tokenNumber,
      status: booking.status,
      channel: booking.channel,
      qrToken,
      qrDeepLink: `/q/${qrToken}`,
      confirmCode: booking.confirmCode,
      holdExpiresAt: booking.holdExpiresAt,
      reportingTime: booking.reportingWindow,
      reportingWindow: booking.reportingWindow,
      smsConfirmationText: renderedSms.text,
      smsOutbox,
    };
  }

  /**
   * Looks up a booking by Tracking ID (`MV-XXXX-XXX`, `MVXXXXXXX`, or `XXXXXXX`),
   * validating the Crockford Base32 check character first. Also accepts internal `bkg_...` IDs.
   */
  public getBookingByTrackingId(trackingId: string): BookingRecord | null {
    if (!trackingId || typeof trackingId !== 'string') return null;
    const clean = trackingId.trim();
    if (!clean) return null;

    this.store.expireStaleHolds();

    if (clean.startsWith('bkg_')) {
      return this.store.getBookingById(clean);
    }

    const validation = validateTrackingId(clean);
    if (!validation.valid) {
      return null;
    }

    return this.store.getBookingByTrackingId(clean);
  }

  /**
   * Cancels a pending or confirmed booking by `idOrTrackingId` or `(msisdn, confirmCode)`.
   */
  public cancelBooking(params: {
    idOrTrackingId?: string;
    bookingId?: string;
    trackingId?: string;
    msisdn?: string;
    phone?: string;
    confirmCode?: string | null;
    reason?: string;
    actorId?: string;
    smsProvider?: SmsProviderType;
  }): {
    booking: BookingRecord;
    cancelled: boolean;
    smsCancellationText: string;
    smsOutbox: SmsMessageRecord;
  } {
    const idOrTracking =
      params.idOrTrackingId || params.bookingId || params.trackingId;
    const booking = this.store.cancelBooking({
      idOrTrackingId: idOrTracking,
      msisdn: params.msisdn || params.phone,
      confirmCode: params.confirmCode,
      reason: params.reason,
      actorId: params.actorId,
    });

    const renderedSms = renderDltTemplate('BOOKING_CANCELLED', {
      trackingId: booking.trackingId,
      trackingIdRaw: booking.trackingIdRaw,
      facilityCode: booking.facilityCode,
      deptCode: booking.deptCode,
    });

    const smsOutbox = this.store.recordOutboundSms({
      bookingId: booking.id,
      msisdn: booking.msisdnNormalized,
      templateId: renderedSms.templateId,
      rendered: renderedSms.text,
      provider: params.smsProvider || 'simulator',
      status: 'SENT',
      dlrStatus: 'DELIVERED',
    });

    return {
      booking,
      cancelled: booking.status === 'CANCELLED',
      smsCancellationText: renderedSms.text,
      smsOutbox,
    };
  }

  /**
   * Expires all stale `PENDING_CONFIRMATION` holds whose TTL has elapsed.
   */
  public expireStaleHolds(nowIso?: string): number {
    return this.store.expireStaleHolds(nowIso);
  }

  /**
   * Counter Console lookup by Tracking ID or signed QR token:
   * - Runs `validateTrackingId` first if `trackingId` is provided; if check character is invalid,
   *   immediately returns `{ validCheckChar: false, checksumValid: false, found: false, reason }`
   *   so mistyped IDs are caught at the counter before/alongside DB lookup.
   * - If `qrToken` is provided, verifies HMAC-SHA256 signature (`verifyQrPayload`) and looks up the booking.
   */
  public counterLookup(params: {
    trackingId?: string;
    qrToken?: string;
    phoneLast4?: string;
  }): CounterLookupExtendedResult {
    this.store.expireStaleHolds();

    if (params.trackingId && !params.qrToken) {
      const validation = validateTrackingId(params.trackingId);
      if (!validation.valid) {
        return {
          found: false,
          validCheckChar: false,
          checksumValid: false,
          verificationMethod: 'TRACKING_ID',
          reason: validation.reason || 'Invalid Tracking ID check character',
          error: validation.reason || 'Invalid Tracking ID check character',
        };
      }
    }

    const res = this.store.counterLookup(params);
    return {
      ...res,
      validCheckChar: res.checksumValid,
      reason: res.error,
    };
  }

  /**
   * Marks a booking `ARRIVED` at the hospital counter, records an audit event,
   * and generates a printable OPD slip summary.
   */
  public markArrived(
    bookingIdOrTrackingId: string,
    staffId = 'counter-dhj01',
    phoneLast4?: string
  ): MarkArrivedResult {
    const res = this.store.markBookingArrived(
      bookingIdOrTrackingId,
      staffId,
      phoneLast4
    );

    if (!res.found || !res.booking || !res.slip) {
      return {
        found: res.found,
        validCheckChar: res.checksumValid,
        checksumValid: res.checksumValid,
        error: res.error,
        booking: res.booking,
      };
    }

    const slipSummary: OpdSlipSummary = {
      slipNumber: res.slip.slipNumber,
      tokenNumber: res.slip.tokenNumber,
      trackingId: res.slip.trackingId,
      facilityName: res.slip.facilityName,
      facilityCode: res.slip.facilityCode,
      deptName: res.slip.departmentName,
      departmentName: res.slip.departmentName,
      deptCode: res.slip.deptCode,
      roomNumber: res.slip.roomNumber,
      slotDate: res.slip.slotDate,
      session: res.slip.session,
      reportingTime: res.slip.reportingWindow,
      reportingWindow: res.slip.reportingWindow,
      patientMaskedName: res.slip.maskedPatientName,
      maskedPatientName: res.slip.maskedPatientName,
      phoneLast4: res.slip.phoneLast4,
      channel: res.slip.channel,
      status: res.slip.status,
      arrivedAt: res.slip.arrivedAt,
      printedAt: res.slip.printedAt,
    };

    return {
      found: true,
      validCheckChar: true,
      checksumValid: true,
      error: res.error,
      booking: res.booking,
      slip: slipSummary,
      slipNumber: slipSummary.slipNumber,
      tokenNumber: slipSummary.tokenNumber,
      trackingId: slipSummary.trackingId,
      facilityName: slipSummary.facilityName,
      deptName: slipSummary.deptName,
      roomNumber: slipSummary.roomNumber,
      session: slipSummary.session,
      reportingTime: slipSummary.reportingTime,
      patientMaskedName: slipSummary.patientMaskedName,
      phoneLast4: slipSummary.phoneLast4,
      arrivedAt: slipSummary.arrivedAt,
    };
  }

  /**
   * Returns a live Admin Queue snapshot for a facility and optional department/date.
   */
  public getAdminQueue(params: {
    facilityCode: string;
    deptCode?: string;
    date?: string;
  }): AdminQueueSnapshot {
    this.store.expireStaleHolds();
    const targetDate = params.date || getTodayIstDateString();
    const facCode = params.facilityCode || 'DHJ01';

    if (params.deptCode) {
      return this.store.getAdminQueue(facCode, params.deptCode, targetDate);
    }

    // If no department code was specified, aggregate across all active departments in the facility
    const facility =
      this.store.getFacilityByCodeOrId(facCode) ||
      this.store.getFacilityByCodeOrId('DHJ01')!;
    const depts = this.store.listDepartments(facility.code);
    if (depts.length === 0) {
      return this.store.getAdminQueue(facility.code, 'MED', targetDate);
    }

    const snapshots = depts.map((d) =>
      this.store.getAdminQueue(facility.code, d.code, targetDate)
    );

    const combinedSessions: SessionSlotRecord[] = [];
    const combinedQueue: BookingRecord[] = [];
    const byChannel: Record<BookingChannel, number> = {
      WEB: 0,
      QR_WALKIN: 0,
      SMS: 0,
      COUNTER: 0,
    };

    let totalCapacity = 0;
    let reservedSmsQuota = 0;
    let confirmedCount = 0;
    let pendingHoldCount = 0;
    let arrivedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let availableSlots = 0;
    let lastIssuedToken = 0;
    let currentServingToken: number | null = null;

    for (const snap of snapshots) {
      combinedSessions.push(...snap.sessions);
      combinedQueue.push(...snap.queue);
      totalCapacity += snap.summary.totalCapacity;
      reservedSmsQuota += snap.summary.reservedSmsQuota;
      confirmedCount += snap.summary.confirmedCount;
      pendingHoldCount += snap.summary.pendingHoldCount;
      arrivedCount += snap.summary.arrivedCount;
      completedCount += snap.summary.completedCount;
      cancelledCount += snap.summary.cancelledCount;
      expiredCount += snap.summary.expiredCount;
      availableSlots += snap.summary.availableSlots;
      if (snap.summary.lastIssuedToken > lastIssuedToken) {
        lastIssuedToken = snap.summary.lastIssuedToken;
      }
      if (
        snap.summary.currentServingToken &&
        (!currentServingToken ||
          snap.summary.currentServingToken > currentServingToken)
      ) {
        currentServingToken = snap.summary.currentServingToken;
      }
      byChannel.WEB += snap.summary.byChannel.WEB || 0;
      byChannel.QR_WALKIN += snap.summary.byChannel.QR_WALKIN || 0;
      byChannel.SMS += snap.summary.byChannel.SMS || 0;
      byChannel.COUNTER += snap.summary.byChannel.COUNTER || 0;
    }

    return {
      facilityCode: facility.code,
      facilityName: facility.name,
      deptCode: 'ALL',
      departmentName: 'All OPD Departments',
      roomNumber: 'OPD Block',
      date: targetDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCapacity,
        reservedSmsQuota,
        confirmedCount,
        pendingHoldCount,
        arrivedCount,
        completedCount,
        cancelledCount,
        expiredCount,
        availableSlots,
        lastIssuedToken,
        currentServingToken,
        byChannel,
      },
      sessions: combinedSessions,
      queue: combinedQueue,
    };
  }

  /**
   * Generates printable department posters for a facility:
   * 1. HMAC-signed Walk-in QR deep link (`/q/<signedPayload>` and `#book-appointments?qr=<signedPayload>`)
   * 2. Pre-filled `sms:` URI (`sms:+919876500108?body=OPD%20DHJ01%20MED`) for SMS onboarding poster
   */
  public generateDepartmentPosters(
    facilityCode: string,
    date?: string
  ): {
    facility: FacilityRecord;
    date: string;
    helplineMsisdn: string;
    posters: DepartmentPosterItem[];
  } {
    const facility =
      this.store.getFacilityByCodeOrId(facilityCode || 'DHJ01') ||
      this.store.getFacilityByCodeOrId('DHJ01')!;
    const targetDate = date || getTodayIstDateString();
    const departments = this.store.listDepartments(facility.code);
    const expSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

    const posters: DepartmentPosterItem[] = departments.map((dept) => {
      const qrToken = signQrPayload({
        type: 'DEPT_WALKIN',
        id: dept.id,
        facilityCode: facility.code,
        deptCode: dept.code,
        date: targetDate,
        exp: expSeconds,
      });

      const smsCommand = `OPD ${facility.code} ${dept.code}`;
      const smsUri = `sms:${DEFAULT_OPD_HELPLINE_MSISDN}?body=${encodeURIComponent(smsCommand)}`;

      return {
        facilityId: facility.id,
        facilityCode: facility.code,
        facilityName: facility.name,
        departmentId: dept.id,
        deptCode: dept.code,
        deptName: dept.name,
        roomNumber: dept.roomNumber,
        morningHours: dept.morningHours,
        afternoonHours: dept.afternoonHours,
        date: targetDate,
        qrToken,
        qrDeepLink: `/q/${qrToken}`,
        pwaDeepLink: `#book-appointments?qr=${encodeURIComponent(qrToken)}&facility=${facility.code}&dept=${dept.code}`,
        smsHelpline: DEFAULT_OPD_HELPLINE_MSISDN,
        smsCommand,
        smsUri,
      };
    });

    return {
      facility,
      date: targetDate,
      helplineMsisdn: DEFAULT_OPD_HELPLINE_MSISDN,
      posters,
    };
  }

  /**
   * Verifies a public QR link (`/q/<signedPayload>` or `<signedPayload>`) and resolves
   * its corresponding facility, department, or booking record.
   */
  public verifyQrDeepLink(qrTokenOrPath: string): {
    valid: boolean;
    expired?: boolean;
    error?: string;
    payload?: QrPayload;
    facility?: FacilityRecord | null;
    department?: DepartmentRecord | null;
    booking?: BookingRecord | null;
    smsUri?: string;
  } {
    const verified = verifyQrPayload(qrTokenOrPath);
    if (!verified.valid || !verified.payload) {
      return {
        valid: false,
        expired: verified.expired,
        error: verified.error || 'Invalid QR payload',
      };
    }

    const payload = verified.payload;
    const facility = this.store.getFacilityByCodeOrId(payload.facilityCode);
    const department = this.store.getDepartment(
      payload.facilityCode,
      payload.deptCode
    );
    const booking =
      payload.type === 'BOOKING'
        ? this.store.getBookingById(payload.id) ||
          (payload.trackingId
            ? this.store.getBookingByTrackingId(payload.trackingId)
            : null)
        : null;

    const smsCommand = `OPD ${payload.facilityCode} ${payload.deptCode}`;
    return {
      valid: true,
      expired: false,
      payload,
      facility,
      department,
      booking,
      smsUri: `sms:${DEFAULT_OPD_HELPLINE_MSISDN}?body=${encodeURIComponent(smsCommand)}`,
    };
  }
}

let sharedBookingCoreInstance: OpdBookingCoreUseCase | null = null;

export function getOpdBookingCore(
  store?: SqliteOpdBookingStore
): OpdBookingCoreUseCase {
  if (store) {
    return new OpdBookingCoreUseCase(store);
  }
  if (!sharedBookingCoreInstance) {
    sharedBookingCoreInstance = new OpdBookingCoreUseCase();
  }
  return sharedBookingCoreInstance;
}
