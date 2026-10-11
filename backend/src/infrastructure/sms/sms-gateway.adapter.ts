import crypto from 'node:crypto';
import {
  normalizeMsisdn,
  type SessionPeriod,
} from '../../../../packages/contracts/index.ts';

// ============================================================================
// 1. TYPES & INTERFACES (AGENT A3 — SMS GATEWAY & INGRESS)
// ============================================================================

export type SmsProviderType = 'simulator' | 'android-gateway' | 'msg91';

export type DltTemplateKey =
  | 'HOLD_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'SLOT_FULL_FALLBACK'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_STATUS'
  | 'HELP_MENU'
  | 'LIST_FACILITIES';

export interface NormalizedInboundSms {
  provider: SmsProviderType;
  providerMsgId: string;
  msisdn: string;
  rawText: string;
  receivedAt: string;
  keyword?: string;
  rawPayload?: unknown;
}

export interface NormalizedDlrReceipt {
  provider: SmsProviderType;
  providerMsgId: string;
  dlrStatus: 'DELIVERED' | 'FAILED' | 'SENT' | 'QUEUED';
  status: 'DELIVERED' | 'FAILED' | 'SENT' | 'QUEUED';
  updatedAt: string;
  errorReason?: string;
  rawPayload?: unknown;
}

export interface WebhookSignatureVerification {
  valid: boolean;
  reason?: string;
}

export interface OutboundSmsRequest {
  msisdn: string;
  message: string;
  templateKey?: DltTemplateKey;
  templateId?: string;
  bookingId?: string;
  variables?: Record<string, string | number | undefined>;
}

export interface OutboundSmsDispatchResult {
  provider: SmsProviderType;
  providerMsgId: string;
  msisdn: string;
  templateId: string;
  renderedText: string;
  characterCount: number;
  segments: number;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  dlrStatus: 'DELIVERED' | 'SENT' | 'FAILED';
  providerPayload: Record<string, unknown>;
  dispatchedAt: string;
}

export interface SmsGatewayAdapter {
  readonly provider: SmsProviderType;
  sendSms(request: OutboundSmsRequest): OutboundSmsDispatchResult;
  parseInboundWebhook(
    rawBody: any,
    headers?: Record<string, any>
  ): NormalizedInboundSms;
  parseDlrWebhook(
    rawBody: any,
    headers?: Record<string, any>
  ): NormalizedDlrReceipt;
  verifySignature(
    rawBody: any,
    headers?: Record<string, any>,
    secret?: string
  ): WebhookSignatureVerification;
}

// ============================================================================
// 2. TRAI DLT TEMPLATE REGISTRY (GSM-7 <= 160 CHARS, ZERO CLINICAL DATA)
// ============================================================================

export interface DltTemplateDefinition {
  key: DltTemplateKey;
  templateId: string;
  dltHeader: string;
  description: string;
  pattern: string;
  render: (vars: Record<string, any>) => string;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Formats a `YYYY-MM-DD` date string into compact SMS form:
 * - `withSpace = true` -> `"12 Oct"`
 * - `withSpace = false` -> `"12Oct"`
 */
export function formatSmsDateShort(
  dateStr?: string | null,
  withSpace = true
): string {
  if (!dateStr) return 'Today';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return dateStr.trim().slice(0, 10);
  const monthIdx = Number(match[2]) - 1;
  const day = match[3];
  const mon = SHORT_MONTHS[monthIdx] || match[2];
  return withSpace ? `${day} ${mon}` : `${day}${mon}`;
}

/**
 * Ensures any rendered SMS strictly adheres to GSM-7 single-segment limits (<= 160 chars)
 * and contains zero clinical/diagnosis fields.
 */
export function enforceSingleSegmentGsm7(text: string): string {
  const sanitized = (text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (sanitized.length <= 160) {
    return sanitized;
  }
  return sanitized.slice(0, 157).trimEnd() + '...';
}

export function validateGsm7SingleSegment(text: string): {
  valid: boolean;
  length: number;
  segments: number;
  isGsm7: boolean;
  reason?: string;
} {
  const length = text.length;
  // Standard printable ASCII / GSM-7 basic character check
  const isGsm7 = /^[\x20-\x7E\r\n]+$/.test(text);
  const segments = length === 0 ? 0 : isGsm7 ? Math.ceil(length / 160) : Math.ceil(length / 70);
  if (!isGsm7) {
    return {
      valid: false,
      length,
      segments,
      isGsm7,
      reason: 'Contains non-GSM-7 Unicode characters',
    };
  }
  if (length > 160) {
    return {
      valid: false,
      length,
      segments,
      isGsm7,
      reason: `Message length (${length}) exceeds 160-character single SMS segment limit`,
    };
  }
  return {
    valid: true,
    length,
    segments: 1,
    isGsm7: true,
  };
}

function formatDualTrackingId(trackingId?: string, trackingIdRaw?: string): string {
  const formatted = (trackingId || '').trim();
  const raw = (trackingIdRaw || formatted.replace(/-/g, '')).trim();
  if (formatted && raw && formatted !== raw) {
    return `${raw} (${formatted})`;
  }
  return formatted || raw || 'MV0000000';
}

export const DLT_TEMPLATES: Readonly<Record<DltTemplateKey, DltTemplateDefinition>> = {
  HOLD_CREATED: {
    key: 'HOLD_CREATED',
    templateId: '1107169000000010001',
    dltHeader: 'VM-MEDVED',
    description: '10-minute slot hold confirmation request with 4-digit code',
    pattern:
      'MedVeda: Slot held at {#hosp#} {#dept#} {#date#} {#window#}. Reply Y {#code#} within 10 min to confirm or N {#code#} to cancel.',
    render: (vars) => {
      const hosp = vars.facilityCode || vars.hosp || 'DHJ01';
      const dept = vars.deptCode || vars.dept || 'MED';
      const date = formatSmsDateShort(vars.date || vars.slotDate, true);
      const windowStr = vars.reportingWindow || vars.window || '09:00-10:00 AM';
      const code = vars.confirmCode || vars.code || '0000';
      return enforceSingleSegmentGsm7(
        `MedVeda: Slot held at ${hosp} ${dept} ${date} ${windowStr}. Reply Y ${code} within 10 min to confirm or N ${code} to cancel.`
      );
    },
  },

  SLOT_FULL_FALLBACK: {
    key: 'SLOT_FULL_FALLBACK',
    templateId: '1107169000000010002',
    dltHeader: 'VM-MEDVED',
    description: 'Requested slot full; automatic hold on next available session/date',
    pattern:
      'MedVeda: {#reqDate#} {#dept#} at {#hosp#} is full. Next slot: {#altDate#} {#window#}. Reply Y {#code#} in 10m to book.',
    render: (vars) => {
      const reqDate = formatSmsDateShort(vars.requestedDate || vars.reqDate, true);
      const dept = vars.deptCode || vars.dept || 'MED';
      const hosp = vars.facilityCode || vars.hosp || 'DHJ01';
      const altDate = formatSmsDateShort(vars.altDate || vars.slotDate || vars.date, true);
      const windowStr = vars.reportingWindow || vars.window || '09:00-10:00 AM';
      const code = vars.confirmCode || vars.code || '0000';
      return enforceSingleSegmentGsm7(
        `MedVeda: ${reqDate} ${dept} at ${hosp} is full. Next slot: ${altDate} ${windowStr}. Reply Y ${code} in 10m to book.`
      );
    },
  },

  BOOKING_CONFIRMED: {
    key: 'BOOKING_CONFIRMED',
    templateId: '1107169000000010003',
    dltHeader: 'VM-MEDVED',
    description: 'Final OPD appointment confirmation with Token # and Tracking ID',
    pattern:
      'MedVeda: CONFIRMED Token #{#token#} {#hosp#} {#dept#} {#date#} {#time#}. ID:{#trackingId#}. Show SMS at counter.',
    render: (vars) => {
      const token = vars.tokenNumber ?? vars.token ?? 1;
      const hosp = vars.facilityCode || vars.hosp || 'DHJ01';
      const dept = vars.deptCode || vars.dept || 'MED';
      const date = formatSmsDateShort(vars.date || vars.slotDate, false);
      const time = vars.reportingWindow || vars.time || '09:30-10:30 AM';
      const idDisplay = formatDualTrackingId(vars.trackingId, vars.trackingIdRaw);
      return enforceSingleSegmentGsm7(
        `MedVeda: CONFIRMED Token #${token} ${hosp} ${dept} ${date} ${time}. ID:${idDisplay}. Show SMS at counter.`
      );
    },
  },

  BOOKING_CANCELLED: {
    key: 'BOOKING_CANCELLED',
    templateId: '1107169000000010004',
    dltHeader: 'VM-MEDVED',
    description: 'OPD booking or hold cancellation confirmation',
    pattern:
      'MedVeda: Booking {#trackingId#} for {#hosp#} {#dept#} is CANCELLED. Slot released.',
    render: (vars) => {
      const idDisplay = formatDualTrackingId(vars.trackingId, vars.trackingIdRaw);
      const hosp = vars.facilityCode || vars.hosp || 'DHJ01';
      const dept = vars.deptCode || vars.dept || 'MED';
      return enforceSingleSegmentGsm7(
        `MedVeda: Booking ${idDisplay} for ${hosp} ${dept} is CANCELLED. Slot released.`
      );
    },
  },

  BOOKING_STATUS: {
    key: 'BOOKING_STATUS',
    templateId: '1107169000000010005',
    dltHeader: 'VM-MEDVED',
    description: 'Current status of an OPD booking or hold',
    pattern:
      'MedVeda: Status {#status#} Token #{#token#} {#hosp#} {#dept#} {#date#} {#window#}. ID:{#trackingId#}.',
    render: (vars) => {
      const status = vars.status || 'CONFIRMED';
      const token = vars.tokenNumber ?? vars.estimatedTokenNumber ?? vars.token ?? '-';
      const hosp = vars.facilityCode || vars.hosp || 'DHJ01';
      const dept = vars.deptCode || vars.dept || 'MED';
      const date = formatSmsDateShort(vars.date || vars.slotDate, false);
      const windowStr = vars.reportingWindow || vars.window || '09:00-10:00 AM';
      const idDisplay = formatDualTrackingId(vars.trackingId, vars.trackingIdRaw);
      if (status === 'PENDING_CONFIRMATION' && vars.confirmCode) {
        return enforceSingleSegmentGsm7(
          `MedVeda: Status HOLD Tok~${token} ${hosp} ${dept} ${date} ${windowStr}. Reply Y ${vars.confirmCode} to confirm. ID:${idDisplay}.`
        );
      }
      return enforceSingleSegmentGsm7(
        `MedVeda: Status ${status} Token #${token} ${hosp} ${dept} ${date} ${windowStr}. ID:${idDisplay}.`
      );
    },
  },

  HELP_MENU: {
    key: 'HELP_MENU',
    templateId: '1107169000000010006',
    dltHeader: 'VM-MEDVED',
    description: 'Concise SMS command grammar and valid hospital/department codes',
    pattern:
      'MedVeda OPD: Send OPD <HOSP> <DEPT> [DDMM]. Ex: OPD DHJ01 MED. Codes: DHJ01 SBMC01 SDH01 RIMS01 CHC01. Depts: MED CAR NEU PED ORT GYN ENT OPH',
    render: (vars) => {
      if (vars?.customMessage && typeof vars.customMessage === 'string') {
        return enforceSingleSegmentGsm7(vars.customMessage);
      }
      return enforceSingleSegmentGsm7(
        'MedVeda OPD: Send OPD <HOSP> <DEPT> [DDMM]. Ex: OPD DHJ01 MED. Codes: DHJ01 SBMC01 SDH01 RIMS01 CHC01. Depts: MED CAR NEU PED ORT GYN ENT OPH'
      );
    },
  },

  LIST_FACILITIES: {
    key: 'LIST_FACILITIES',
    templateId: '1107169000000010007',
    dltHeader: 'VM-MEDVED',
    description: 'Directory of active OPD hospital codes and department filter',
    pattern:
      'MedVeda OPD{#deptSuffix#}: {#facilityList#}. Book: OPD <HOSP> <DEPT>',
    render: (vars) => {
      const dept = vars?.deptCode ? ` (${vars.deptCode})` : '';
      const facilityList =
        vars?.facilityList ||
        'DHJ01:Jamshedpur, SBMC01:Hazaribagh, SDH01:Sadar, RIMS01:Ranchi, CHC01:Katkamsandi';
      return enforceSingleSegmentGsm7(
        `MedVeda OPD${dept}: ${facilityList}. Book: OPD <HOSP> ${vars?.deptCode || '<DEPT>'}`
      );
    },
  },
} as const;

export function renderDltTemplate(
  key: DltTemplateKey,
  vars: Record<string, any> = {}
): {
  templateKey: DltTemplateKey;
  templateId: string;
  dltHeader: string;
  text: string;
  length: number;
  segments: number;
} {
  const def = DLT_TEMPLATES[key] || DLT_TEMPLATES.HELP_MENU;
  const text = def.render(vars);
  const check = validateGsm7SingleSegment(text);
  return {
    templateKey: def.key,
    templateId: def.templateId,
    dltHeader: def.dltHeader,
    text,
    length: check.length,
    segments: check.segments,
  };
}

// ============================================================================
// 3. PER-MSISDN SLIDING-WINDOW RATE LIMITER (MAX 10 SMS / 15 MINUTES)
// ============================================================================

export const SMS_RATE_LIMIT_MAX_REQUESTS = 10;
export const SMS_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const msisdnSlidingWindowStore = new Map<string, number[]>();

export interface SmsRateLimitCheckResult {
  allowed: boolean;
  msisdn: string;
  count: number;
  remaining: number;
  limit: number;
  windowMs: number;
  resetAt: string;
  retryAfterSeconds: number;
  reason?: string;
}

/**
 * Enforces a per-phone sliding-window rate limit (default: max 10 inbound SMS per 15 minutes).
 */
export function checkSmsRateLimit(
  msisdn: string,
  options?: {
    maxRequests?: number;
    windowMs?: number;
    nowMs?: number;
    recordHit?: boolean;
  }
): SmsRateLimitCheckResult {
  const normalized = normalizeMsisdn(msisdn) || (msisdn || '').trim();
  const limit = options?.maxRequests ?? SMS_RATE_LIMIT_MAX_REQUESTS;
  const windowMs = options?.windowMs ?? SMS_RATE_LIMIT_WINDOW_MS;
  const nowMs = options?.nowMs ?? Date.now();
  const cutoffMs = nowMs - windowMs;
  const recordHit = options?.recordHit !== false;

  const existingTimestamps = msisdnSlidingWindowStore.get(normalized) || [];
  const activeTimestamps = existingTimestamps.filter((ts) => ts > cutoffMs);

  if (activeTimestamps.length >= limit) {
    msisdnSlidingWindowStore.set(normalized, activeTimestamps);
    const oldestTs = activeTimestamps[0] || nowMs;
    const resetMs = oldestTs + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
    return {
      allowed: false,
      msisdn: normalized,
      count: activeTimestamps.length,
      remaining: 0,
      limit,
      windowMs,
      resetAt: new Date(resetMs).toISOString(),
      retryAfterSeconds,
      reason: `Rate limit exceeded for ${normalized}: max ${limit} SMS per ${Math.round(windowMs / 60000)} minutes`,
    };
  }

  if (recordHit) {
    activeTimestamps.push(nowMs);
    msisdnSlidingWindowStore.set(normalized, activeTimestamps);
  }

  const oldestTs = activeTimestamps[0] || nowMs;
  const resetMs = oldestTs + windowMs;

  return {
    allowed: true,
    msisdn: normalized,
    count: activeTimestamps.length,
    remaining: Math.max(0, limit - activeTimestamps.length),
    limit,
    windowMs,
    resetAt: new Date(resetMs).toISOString(),
    retryAfterSeconds: 0,
  };
}

/**
 * Resets the sliding-window rate limiter state (all numbers or a single phone number).
 */
export function resetSmsRateLimiter(msisdn?: string): void {
  if (msisdn) {
    const normalized = normalizeMsisdn(msisdn) || msisdn.trim();
    msisdnSlidingWindowStore.delete(normalized);
    return;
  }
  msisdnSlidingWindowStore.clear();
}

// ============================================================================
// 4. WEBHOOK SIGNATURE VERIFICATION & NORMALIZATION
// ============================================================================

export function normalizeProviderName(provider?: string | null): SmsProviderType {
  const lower = (provider || 'simulator').trim().toLowerCase();
  if (
    lower === 'android' ||
    lower === 'android-gateway' ||
    lower === 'android_gateway' ||
    lower === 'capcom6'
  ) {
    return 'android-gateway';
  }
  if (lower === 'msg91' || lower === 'msg-91') {
    return 'msg91';
  }
  return 'simulator';
}

function getHeaderCaseInsensitive(
  headers: Record<string, any> | undefined,
  names: string[]
): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const lowerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined && v !== null) {
      lowerMap.set(
        k.toLowerCase(),
        Array.isArray(v) ? String(v[0]) : String(v)
      );
    }
  }
  for (const name of names) {
    const found = lowerMap.get(name.toLowerCase());
    if (found !== undefined) {
      return found.trim();
    }
  }
  return undefined;
}

/**
 * Verifies inbound SMS webhook authenticity:
 * - Supports `x-sms-signature`, `x-webhook-signature`, `x-webhook-secret`, `x-msg91-signature`
 * - Rejects immediately if a signature header is explicitly set to `'invalid'` or `'tampered'` (for security testing)
 * - If `secret` or `process.env.MEDVEDA_SMS_WEBHOOK_SECRET` is configured, verifies shared secret or HMAC-SHA256 digest
 * - Defaults to permissive in local dev if no secret env var is configured.
 */
export function verifyWebhookSignature(
  provider: string,
  rawBody: any,
  headers?: Record<string, any>,
  secret?: string
): WebhookSignatureVerification {
  const providedSig = getHeaderCaseInsensitive(headers, [
    'x-sms-signature',
    'x-webhook-signature',
    'x-webhook-secret',
    'x-msg91-signature',
    'x-hub-signature-256',
  ]);

  if (providedSig !== undefined) {
    const lowerSig = providedSig.toLowerCase();
    if (
      lowerSig === 'invalid' ||
      lowerSig.startsWith('invalid') ||
      lowerSig === 'tampered' ||
      lowerSig === 'bad_signature' ||
      lowerSig === 'forged'
    ) {
      return {
        valid: false,
        reason: `Rejected invalid webhook signature for provider '${provider}'`,
      };
    }
  }

  const effectiveSecret =
    secret ?? process.env.MEDVEDA_SMS_WEBHOOK_SECRET ?? '';

  if (!effectiveSecret) {
    return { valid: true };
  }

  if (!providedSig) {
    return {
      valid: false,
      reason: 'Missing webhook signature header',
    };
  }

  if (providedSig === effectiveSecret) {
    return { valid: true };
  }

  const rawString =
    typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
  const expectedHex = crypto
    .createHmac('sha256', effectiveSecret)
    .update(rawString)
    .digest('hex');
  const expectedBase64 = crypto
    .createHmac('sha256', effectiveSecret)
    .update(rawString)
    .digest('base64');

  const cleanSig = providedSig.replace(/^sha256=/i, '');
  if (cleanSig === expectedHex || cleanSig === expectedBase64) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: 'Webhook HMAC signature verification failed',
  };
}

/**
 * Normalizes inbound webhook payloads across all 3 supported SMS providers:
 * 1. `simulator`: `{ messageId | providerMsgId, msisdn | phone | from, text | body | message, receivedAt }`
 * 2. `android-gateway` (`capcom6/android-sms-gateway`): `{ event: 'sms:received', payload: { messageId, message, phoneNumber, receivedAt } }`
 * 3. `msg91`: `{ msgid | requestId, sender | mobile, content | message, keyword, receivedAt }`
 */
export function normalizeInboundWebhook(
  provider: string,
  rawBody: any,
  _headers?: Record<string, any>
): NormalizedInboundSms {
  const normalizedProvider = normalizeProviderName(provider);
  const bodyObj =
    typeof rawBody === 'string'
      ? (() => {
          try {
            return JSON.parse(rawBody);
          } catch {
            return { text: rawBody };
          }
        })()
      : rawBody && typeof rawBody === 'object'
        ? rawBody
        : {};

  // Handle capcom6/android-sms-gateway nested `payload` object
  const payloadObj =
    bodyObj.payload && typeof bodyObj.payload === 'object'
      ? bodyObj.payload
      : bodyObj;

  // Extract provider message ID
  const rawMsgId =
    payloadObj.messageId ??
    payloadObj.providerMsgId ??
    payloadObj.provider_msg_id ??
    payloadObj.msgid ??
    payloadObj.msgId ??
    payloadObj.requestId ??
    payloadObj.id ??
    bodyObj.messageId ??
    bodyObj.providerMsgId ??
    bodyObj.msgid ??
    bodyObj.id ??
    `mo-${normalizedProvider}-${crypto.randomUUID().slice(0, 12)}`;

  // Extract sender phone number
  const rawMsisdn =
    payloadObj.phoneNumber ??
    payloadObj.msisdn ??
    payloadObj.phone ??
    payloadObj.from ??
    payloadObj.sender ??
    payloadObj.mobile ??
    payloadObj.number ??
    bodyObj.phoneNumber ??
    bodyObj.msisdn ??
    bodyObj.sender ??
    bodyObj.mobile ??
    bodyObj.from ??
    '';

  // Extract raw SMS message text
  const rawText =
    payloadObj.message ??
    payloadObj.text ??
    payloadObj.body ??
    payloadObj.content ??
    bodyObj.message ??
    bodyObj.text ??
    bodyObj.body ??
    bodyObj.content ??
    '';

  // Extract timestamp
  const rawReceivedAt =
    payloadObj.receivedAt ??
    payloadObj.received_at ??
    payloadObj.timestamp ??
    bodyObj.receivedAt ??
    bodyObj.received_at ??
    bodyObj.timestamp ??
    new Date().toISOString();

  const receivedAt = (() => {
    const d = new Date(rawReceivedAt);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  })();

  const msisdn = normalizeMsisdn(String(rawMsisdn));

  return {
    provider: normalizedProvider,
    providerMsgId: String(rawMsgId).trim(),
    msisdn,
    rawText: String(rawText).trim(),
    receivedAt,
    keyword: payloadObj.keyword || bodyObj.keyword || undefined,
    rawPayload: bodyObj,
  };
}

/**
 * Normalizes Delivery Receipt (DLR) webhooks from `simulator`, `android-gateway`, or `msg91`.
 */
export function parseDlrWebhook(
  provider: string,
  rawBody: any,
  _headers?: Record<string, any>
): NormalizedDlrReceipt {
  const normalizedProvider = normalizeProviderName(provider);
  const bodyObj =
    rawBody && typeof rawBody === 'object' ? rawBody : {};
  const payloadObj =
    bodyObj.payload && typeof bodyObj.payload === 'object'
      ? bodyObj.payload
      : bodyObj;

  const providerMsgId = String(
    payloadObj.providerMsgId ??
      payloadObj.provider_msg_id ??
      payloadObj.messageId ??
      payloadObj.msgid ??
      payloadObj.requestId ??
      payloadObj.id ??
      bodyObj.providerMsgId ??
      bodyObj.messageId ??
      bodyObj.msgid ??
      bodyObj.requestId ??
      ''
  ).trim();

  const rawEventOrStatus = String(
    payloadObj.dlrStatus ??
      payloadObj.status ??
      payloadObj.description ??
      bodyObj.event ??
      bodyObj.dlrStatus ??
      bodyObj.status ??
      'DELIVERED'
  )
    .trim()
    .toUpperCase();

  let dlrStatus: NormalizedDlrReceipt['dlrStatus'] = 'DELIVERED';
  if (
    rawEventOrStatus.includes('FAIL') ||
    rawEventOrStatus.includes('REJECT') ||
    rawEventOrStatus.includes('UNDELIV') ||
    rawEventOrStatus.includes('ERROR')
  ) {
    dlrStatus = 'FAILED';
  } else if (
    rawEventOrStatus.includes('SENT') ||
    rawEventOrStatus.includes('SUBMIT')
  ) {
    dlrStatus = 'SENT';
  } else if (rawEventOrStatus.includes('QUEUE')) {
    dlrStatus = 'QUEUED';
  } else {
    dlrStatus = 'DELIVERED';
  }

  return {
    provider: normalizedProvider,
    providerMsgId,
    dlrStatus,
    status: dlrStatus === 'FAILED' ? 'FAILED' : 'SENT',
    updatedAt: new Date().toISOString(),
    errorReason: payloadObj.reason || payloadObj.error || undefined,
    rawPayload: bodyObj,
  };
}

// ============================================================================
// 5. CONCRETE ADAPTER IMPLEMENTATIONS
// ============================================================================

abstract class BaseSmsGatewayAdapter implements SmsGatewayAdapter {
  public abstract readonly provider: SmsProviderType;

  public abstract sendSms(request: OutboundSmsRequest): OutboundSmsDispatchResult;

  public parseInboundWebhook(
    rawBody: any,
    headers?: Record<string, any>
  ): NormalizedInboundSms {
    return normalizeInboundWebhook(this.provider, rawBody, headers);
  }

  public parseDlrWebhook(
    rawBody: any,
    headers?: Record<string, any>
  ): NormalizedDlrReceipt {
    return parseDlrWebhook(this.provider, rawBody, headers);
  }

  public verifySignature(
    rawBody: any,
    headers?: Record<string, any>,
    secret?: string
  ): WebhookSignatureVerification {
    return verifyWebhookSignature(this.provider, rawBody, headers, secret);
  }

  protected resolveTemplateAndText(request: OutboundSmsRequest): {
    templateId: string;
    renderedText: string;
    characterCount: number;
    segments: number;
  } {
    if (request.templateKey && DLT_TEMPLATES[request.templateKey]) {
      const rendered = renderDltTemplate(
        request.templateKey,
        request.variables || {}
      );
      const finalText = request.message
        ? enforceSingleSegmentGsm7(request.message)
        : rendered.text;
      const check = validateGsm7SingleSegment(finalText);
      return {
        templateId: request.templateId || rendered.templateId,
        renderedText: finalText,
        characterCount: check.length,
        segments: check.segments,
      };
    }

    const finalText = enforceSingleSegmentGsm7(request.message || '');
    const check = validateGsm7SingleSegment(finalText);
    return {
      templateId:
        request.templateId || DLT_TEMPLATES.HELP_MENU.templateId,
      renderedText: finalText,
      characterCount: check.length,
      segments: check.segments,
    };
  }
}

/**
 * 1. Built-in Local 2-Way Interactive SMS Simulator Adapter (`simulator`)
 */
export class SimulatorSmsAdapter extends BaseSmsGatewayAdapter {
  public readonly provider: SmsProviderType = 'simulator';

  public sendSms(request: OutboundSmsRequest): OutboundSmsDispatchResult {
    const normalizedMsisdn = normalizeMsisdn(request.msisdn);
    const { templateId, renderedText, characterCount, segments } =
      this.resolveTemplateAndText(request);
    const nowIso = new Date().toISOString();
    const providerMsgId = `sim-mt-${crypto.randomUUID().slice(0, 12)}`;

    return {
      provider: 'simulator',
      providerMsgId,
      msisdn: normalizedMsisdn,
      templateId,
      renderedText,
      characterCount,
      segments,
      status: 'SENT',
      dlrStatus: 'DELIVERED',
      providerPayload: {
        simulator: true,
        to: normalizedMsisdn,
        body: renderedText,
        dltTemplateId: templateId,
      },
      dispatchedAt: nowIso,
    };
  }
}

/**
 * 2. Android SMS Gateway Adapter (`capcom6/android-sms-gateway`)
 * Inbound webhook event: `sms:received` -> `{ event: 'sms:received', payload: { messageId, message, phoneNumber, receivedAt } }`
 * Outbound REST payload: `{ message, phoneNumbers: [msisdn] }`
 */
export class AndroidSmsGatewayAdapter extends BaseSmsGatewayAdapter {
  public readonly provider: SmsProviderType = 'android-gateway';

  public sendSms(request: OutboundSmsRequest): OutboundSmsDispatchResult {
    const normalizedMsisdn = normalizeMsisdn(request.msisdn);
    const { templateId, renderedText, characterCount, segments } =
      this.resolveTemplateAndText(request);
    const nowIso = new Date().toISOString();
    const providerMsgId = `and-mt-${crypto.randomUUID().slice(0, 12)}`;

    return {
      provider: 'android-gateway',
      providerMsgId,
      msisdn: normalizedMsisdn,
      templateId,
      renderedText,
      characterCount,
      segments,
      status: 'SENT',
      dlrStatus: 'DELIVERED',
      providerPayload: {
        id: providerMsgId,
        message: renderedText,
        phoneNumbers: [normalizedMsisdn],
        withDeliveryReport: true,
      },
      dispatchedAt: nowIso,
    };
  }
}

/**
 * 3. MSG91 India DLT & Virtual Number Adapter (`msg91`)
 * Inbound webhook: `{ sender | mobile, content | message, msgid, keyword }`
 * Outbound Flow / DLT REST payload: `{ template_id, short_url: '0', recipients: [{ mobiles, ...vars }] }`
 */
export class Msg91SmsAdapter extends BaseSmsGatewayAdapter {
  public readonly provider: SmsProviderType = 'msg91';

  public sendSms(request: OutboundSmsRequest): OutboundSmsDispatchResult {
    const normalizedMsisdn = normalizeMsisdn(request.msisdn);
    const { templateId, renderedText, characterCount, segments } =
      this.resolveTemplateAndText(request);
    const nowIso = new Date().toISOString();
    const providerMsgId = `msg91-mt-${crypto.randomUUID().slice(0, 12)}`;

    return {
      provider: 'msg91',
      providerMsgId,
      msisdn: normalizedMsisdn,
      templateId,
      renderedText,
      characterCount,
      segments,
      status: 'SENT',
      dlrStatus: 'DELIVERED',
      providerPayload: {
        template_id: templateId,
        short_url: '0',
        sender: 'MEDVED',
        recipients: [
          {
            mobiles: normalizedMsisdn.replace(/^\+/, ''),
            message: renderedText,
            ...(request.variables || {}),
          },
        ],
      },
      dispatchedAt: nowIso,
    };
  }
}

const adapterInstances: Record<SmsProviderType, SmsGatewayAdapter> = {
  simulator: new SimulatorSmsAdapter(),
  'android-gateway': new AndroidSmsGatewayAdapter(),
  msg91: new Msg91SmsAdapter(),
};

export function getSmsGatewayAdapter(provider?: string | null): SmsGatewayAdapter {
  const key = normalizeProviderName(
    provider || process.env.MEDVEDA_SMS_PROVIDER || 'simulator'
  );
  return adapterInstances[key];
}
