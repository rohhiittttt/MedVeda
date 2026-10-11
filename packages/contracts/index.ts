import crypto from 'node:crypto';

// ============================================================================
// 1. ENUMS, CONSTANTS & STATE MACHINE
// ============================================================================

export type BookingChannel = 'WEB' | 'QR_WALKIN' | 'SMS' | 'COUNTER';
export type Channel = BookingChannel;

export const BOOKING_CHANNELS: readonly BookingChannel[] = [
  'WEB',
  'QR_WALKIN',
  'SMS',
  'COUNTER',
] as const;

export type BookingStatus =
  | 'RECEIVED'
  | 'PARSED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'REJECTED';

export type BookingState = BookingStatus;

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'RECEIVED',
  'PARSED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'ARRIVED',
  'COMPLETED',
  'NO_SHOW',
  'REJECTED',
] as const;

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'ARRIVED',
] as const;

export type SmsIntent =
  | 'BOOK'
  | 'CONFIRM'
  | 'CANCEL'
  | 'STATUS'
  | 'LIST'
  | 'HELP'
  | 'UNKNOWN';

export const SMS_INTENTS: readonly SmsIntent[] = [
  'BOOK',
  'CONFIRM',
  'CANCEL',
  'STATUS',
  'LIST',
  'HELP',
  'UNKNOWN',
] as const;

export type SmsDirection = 'INBOUND' | 'OUTBOUND';
export type SessionPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type StaffRole = 'COUNTER' | 'SUPERVISOR' | 'ADMIN';

/** Default hold duration for pending SMS/Web slot reservations: 10 minutes */
export const DEFAULT_HOLD_TTL_MS = 10 * 60 * 1000;

/** Default fraction of session capacity reserved for SMS & walk-in equity */
export const DEFAULT_SMS_QUOTA_RATIO = 0.25;

/** Crockford Base32 alphabet (excludes I, L, O, U to avoid visual ambiguity) */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Valid state transitions per Section 5 of docs/PLAN.md */
export const VALID_STATE_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  RECEIVED: ['PARSED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED'],
  PARSED: ['PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'EXPIRED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW', 'REJECTED'],
  ARRIVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  EXPIRED: [],
  CANCELLED: [],
  NO_SHOW: [],
  REJECTED: [],
};

export function canTransitionBookingState(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function normalizeChannel(input?: string | null): BookingChannel {
  const upper = (input || 'WEB').trim().toUpperCase();
  if (upper === 'QR' || upper === 'QR_WALKIN' || upper === 'WALKIN') return 'QR_WALKIN';
  if (upper === 'SMS') return 'SMS';
  if (upper === 'COUNTER') return 'COUNTER';
  return 'WEB';
}

// ============================================================================
// 2. CROCKFORD BASE32 TRACKING ID + MODULO-32 CHECK CHARACTER
// ============================================================================

/**
 * Normalizes a user-entered or SMS Tracking ID into its canonical Crockford Base32 payload:
 * - Strips whitespace, hyphens, underscores
 * - Uppercases all characters
 * - Strips leading 'MV' prefix if present
 * - Maps visually ambiguous characters: I/L -> '1', O -> '0'
 */
export function normalizeCrockford(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, '');

  if (cleaned.startsWith('MV')) {
    cleaned = cleaned.slice(2);
  }

  let out = '';
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === 'I' || ch === 'L') {
      out += '1';
    } else if (ch === 'O') {
      out += '0';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Deterministic weighted modulo-32 check character calculation over a Crockford Base32 payload.
 * Uses position weights (i + 1) with prime offset 18 mod 32 so single-character substitutions
 * and adjacent transpositions are caught at the counter console.
 */
export function computeCrockfordCheckChar(payload6: string): string {
  const normalized = normalizeCrockford(payload6);
  if (!normalized) {
    throw new Error('Cannot compute Crockford check character for empty payload');
  }
  let sum = 18;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const idx = CROCKFORD_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid Crockford Base32 character: ${ch}`);
    }
    sum += idx * (i + 1);
  }
  return CROCKFORD_ALPHABET[sum % 32];
}

/**
 * Formats a normalized or raw Tracking ID into human-readable hyphenated form:
 * - 7 chars (`7K4Q9X2`) -> `MV-7K4Q-9X2`
 * - 6 chars (`7K4Q9X`)  -> `MV-7K4Q-9X`
 */
export function formatTrackingId(input: string): string {
  const norm = normalizeCrockford(input);
  if (norm.length >= 7) {
    return `MV-${norm.slice(0, 4)}-${norm.slice(4)}`;
  }
  if (norm.length === 6) {
    return `MV-${norm.slice(0, 4)}-${norm.slice(4)}`;
  }
  return norm ? `MV-${norm}` : '';
}

/**
 * Generates a random (or seed-deterministic) Crockford Base32 Tracking ID:
 * - 6-character Crockford Base32 body + 1 modulo-32 check character
 * - `raw`: `'MV7K4Q9X2'` (compact SMS form)
 * - `formatted`: `'MV-7K4Q-9X2'` (counter/slip display form)
 */
export function generateTrackingId(seedOrRandom?: string): {
  raw: string;
  formatted: string;
  body: string;
  checkChar: string;
  shortRaw: string;
} {
  let bytes: Buffer;
  if (seedOrRandom && seedOrRandom.length > 0) {
    bytes = crypto.createHash('sha256').update(seedOrRandom).digest();
  } else {
    bytes = crypto.randomBytes(8);
  }

  let body = '';
  for (let i = 0; i < 6; i++) {
    const idx = bytes[i] % 32;
    body += CROCKFORD_ALPHABET[idx];
  }

  const checkChar = computeCrockfordCheckChar(body);
  const shortRaw = `${body}${checkChar}`;
  const raw = `MV${shortRaw}`;
  const formatted = `MV-${body.slice(0, 4)}-${body.slice(4)}${checkChar}`;

  return {
    raw,
    formatted,
    body,
    checkChar,
    shortRaw,
  };
}

/**
 * Validates a Tracking ID (supports `MV-7K4Q-9X2`, `MV7K4Q9X2`, `7K4Q9X2`, and 6-char SMS legacy IDs).
 * Strictly verifies the modulo-32 check character on 7-char and 9-char payloads.
 */
export function validateTrackingId(
  input: string,
  options?: { strictLength?: boolean }
): {
  valid: boolean;
  normalized: string;
  raw: string;
  formatted: string;
  reason?: string;
} {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return {
      valid: false,
      normalized: '',
      raw: '',
      formatted: '',
      reason: 'Tracking ID is empty',
    };
  }

  const norm = normalizeCrockford(input);

  for (let i = 0; i < norm.length; i++) {
    if (!CROCKFORD_ALPHABET.includes(norm[i])) {
      return {
        valid: false,
        normalized: norm,
        raw: `MV${norm}`,
        formatted: formatTrackingId(norm),
        reason: `Disallowed character '${norm[i]}' in Tracking ID`,
      };
    }
  }

  // Standard 6-char body + 1 check character (7 chars after stripping MV)
  // or 8-char body + 1 check character (9 chars after stripping MV)
  if (norm.length === 7 || norm.length === 9) {
    const body = norm.slice(0, -1);
    const actualCheck = norm.slice(-1);
    const expectedCheck = computeCrockfordCheckChar(body);
    if (actualCheck !== expectedCheck) {
      return {
        valid: false,
        normalized: norm,
        raw: `MV${norm}`,
        formatted: formatTrackingId(norm),
        reason: `Check character mismatch: expected '${expectedCheck}', got '${actualCheck}'`,
      };
    }
    return {
      valid: true,
      normalized: norm,
      raw: `MV${norm}`,
      formatted: formatTrackingId(norm),
    };
  }

  // Support 6-char legacy SMS IDs (e.g., MV7K4Q9X from PLAN.md) unless strictLength is requested
  if (norm.length === 6 && !options?.strictLength) {
    return {
      valid: true,
      normalized: norm,
      raw: `MV${norm}`,
      formatted: formatTrackingId(norm),
    };
  }

  return {
    valid: false,
    normalized: norm,
    raw: norm ? `MV${norm}` : '',
    formatted: formatTrackingId(norm),
    reason: `Invalid Tracking ID length (${norm.length}); expected 7 Crockford characters`,
  };
}

/**
 * Generates a 4-digit numeric SMS confirmation code (1000..9999), e.g. '4821'.
 */
export function generateConfirmCode(): string {
  const num = crypto.randomInt(1000, 10000);
  return String(num);
}

// ============================================================================
// 3. HMAC-SHA256 SIGNED QR PAYLOADS (node:crypto)
// ============================================================================

export interface QrPayload {
  type: 'BOOKING' | 'DEPT_WALKIN';
  id: string;
  facilityCode: string;
  deptCode: string;
  date?: string;
  tokenNumber?: number;
  trackingId?: string;
  session?: SessionPeriod;
  iat?: number;
  exp?: number;
}

const DEFAULT_QR_SECRET =
  process.env.MEDVEDA_QR_SECRET || 'medveda-opd-qr-hmac-secret-2026';

/**
 * Signs a QR payload into `<base64url-json>.<16-char-base64url-hmac-sha256>`.
 */
export function signQrPayload(payload: QrPayload, secret?: string): string {
  const signingKey = secret || DEFAULT_QR_SECRET;
  const fullPayload: QrPayload = {
    ...payload,
    iat: payload.iat ?? Math.floor(Date.now() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', signingKey)
    .update(encoded)
    .digest('base64url')
    .slice(0, 16);
  return `${encoded}.${sig}`;
}

/**
 * Verifies a signed QR token (or `/q/<token>` path) and checks expiration.
 */
export function verifyQrPayload(
  token: string,
  secret?: string
): {
  valid: boolean;
  expired?: boolean;
  payload?: QrPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Empty QR token' };
  }

  let cleanToken = token.trim();
  const qIdx = cleanToken.indexOf('/q/');
  if (qIdx !== -1) {
    cleanToken = cleanToken.slice(qIdx + 3);
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed QR token format' };
  }

  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig || providedSig.length !== 16) {
    return { valid: false, error: 'Invalid QR signature length' };
  }

  const signingKey = secret || DEFAULT_QR_SECRET;
  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(encoded)
    .digest('base64url')
    .slice(0, 16);

  const bufProvided = Buffer.from(providedSig, 'utf8');
  const bufExpected = Buffer.from(expectedSig, 'utf8');
  if (
    bufProvided.length !== bufExpected.length ||
    !crypto.timingSafeEqual(bufProvided, bufExpected)
  ) {
    return { valid: false, error: 'QR HMAC signature verification failed' };
  }

  try {
    const jsonStr = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as QrPayload;

    if (typeof payload.exp === 'number') {
      const expMs = payload.exp < 1e11 ? payload.exp * 1000 : payload.exp;
      if (Date.now() > expMs) {
        return {
          valid: false,
          expired: true,
          payload,
          error: 'QR token has expired',
        };
      }
    }

    return {
      valid: true,
      expired: false,
      payload,
    };
  } catch {
    return { valid: false, error: 'Invalid QR JSON payload' };
  }
}

// ============================================================================
// 4. PHONE & PII HELPERS (DPDP ACT 2023 COMPLIANCE)
// ============================================================================

const DEFAULT_PII_SALT =
  process.env.MEDVEDA_PII_SALT || 'medveda-dpdp-pii-salt-2026';

/**
 * Normalizes Indian mobile numbers (`9876543210`, `09876543210`, `919876543210`, `+919876543210`)
 * to canonical E.164 format `+91XXXXXXXXXX`.
 */
export function normalizeMsisdn(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const stripped = phone.trim().replace(/[\s\-().]/g, '');
  const digits = stripped.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (stripped.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  if (digits.length > 10) {
    return `+91${digits.slice(-10)}`;
  }
  return stripped;
}

/**
 * Returns SHA-256 hex digest of the normalized E.164 MSISDN for privacy-preserving indexing.
 */
export function hashMsisdn(phone: string, salt?: string): string {
  const normalized = normalizeMsisdn(phone);
  const actualSalt = salt ?? DEFAULT_PII_SALT;
  return crypto
    .createHash('sha256')
    .update(`${actualSalt}:${normalized}`)
    .digest('hex');
}

/**
 * Hashes a 4-digit confirmation code for storage in `bookings.confirm_code_hash`.
 */
export function hashConfirmCode(code: string, salt?: string): string {
  const normalized = (code || '').trim().toUpperCase();
  const actualSalt = salt ?? DEFAULT_PII_SALT;
  return crypto
    .createHash('sha256')
    .update(`${actualSalt}:confirm:${normalized}`)
    .digest('hex');
}

/**
 * Masks a patient name for counter/queue display (DPDP data minimization):
 * e.g. `"Ramesh Kumar"` -> `"R****h K***r"`, `"SMS Patient"` -> `"S*S P*****t"`
 */
export function maskName(name?: string | null): string {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'P*****t';
  }
  return name
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return '*';
      if (part.length === 2) return `${part[0]}*`;
      return `${part[0]}${'*'.repeat(part.length - 2)}${part[part.length - 1]}`;
    })
    .join(' ');
}

/**
 * Returns the last 4 digits of a phone number (e.g. `"3210"`).
 */
export function maskPhoneLast4(phone: string): string {
  if (!phone || typeof phone !== 'string') return '0000';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return digits.padStart(4, '0');
}

// ============================================================================
// 5. SHARED DOMAIN INTERFACES & CONTRACTS
// ============================================================================

export interface SmsParseEntities {
  facilityCode: string | null;
  deptCode: string | null;
  requestedDate: string | null;
  /** Alias for requestedDate (matches Section 3 of docs/PLAN.md) */
  date?: string | null;
  session: SessionPeriod | null;
  confirmCode: string | null;
  trackingId: string | null;
}

export interface SmsParseResult {
  messageId: string;
  msisdn: string;
  receivedAt: string;
  intent: SmsIntent;
  entities: SmsParseEntities;
  confidence: number;
  parseErrors: string[];
  normalizedCommand?: string;
}

export type ParsedSmsContract = SmsParseResult;

export interface FacilityRecord {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  district: string;
  state: string;
  type: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  geo?: {
    lat: number;
    lng: number;
    address?: string;
    aliases?: string[];
  } | null;
  active: boolean;
  createdAt?: string;
}

export type Facility = FacilityRecord;

export interface DepartmentRecord {
  id: string;
  facilityId: string;
  facilityCode?: string;
  code: string;
  name: string;
  dailyCapacity: number;
  morningHours: string;
  afternoonHours: string;
  roomNumber: string;
  active: boolean;
}

export type Department = DepartmentRecord;

export interface SessionSlotRecord {
  id: string;
  facilityId: string;
  facilityCode: string;
  departmentId: string;
  deptCode: string;
  departmentName?: string;
  roomNumber?: string;
  date: string;
  session: SessionPeriod;
  startTime: string;
  endTime: string;
  totalCapacity: number;
  reservedSmsQuota: number;
  bookedCount: number;
  heldCount: number;
  availableCount: number;
  smsAvailableCount: number;
  nextEstimatedToken: number;
  status: 'OPEN' | 'FULL' | 'CLOSED';
}

export type Session = SessionSlotRecord;

export interface PatientRecord {
  id: string;
  msisdnNormalized: string;
  msisdnHash: string;
  phoneLast4: string;
  fullName: string | null;
  maskedName: string;
  abhaAddress?: string | null;
  abhaNumberHash?: string | null;
  preferredLanguage?: string;
  consentTimestamp?: string | null;
  blocked?: boolean;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  trackingId: string;
  trackingIdRaw?: string;
  facilityId: string;
  facilityCode: string;
  facilityName?: string;
  departmentId: string;
  deptCode: string;
  departmentName?: string;
  roomNumber?: string;
  sessionId: string;
  slotDate: string;
  session: SessionPeriod;
  reportingWindow: string;
  patientId: string;
  patientName: string | null;
  maskedPatientName: string;
  msisdnNormalized: string;
  phoneLast4: string;
  abhaVerified: boolean;
  abhaAddress?: string | null;
  channel: BookingChannel;
  status: BookingStatus;
  tokenNumber: number | null;
  estimatedTokenNumber?: number | null;
  confirmCode: string | null;
  holdExpiresAt: string | null;
  qrPayload: string | null;
  createdAt: string;
  confirmedAt: string | null;
  arrivedAt: string | null;
  cancelledAt: string | null;
  completedAt?: string | null;
  cancelReason?: string | null;
}

export type Booking = BookingRecord;

export interface SmsMessageRecord {
  id: string;
  providerMessageId: string;
  provider: string;
  direction: SmsDirection;
  msisdn: string;
  body: string;
  parsedJson?: SmsParseResult | null;
  bookingId?: string | null;
  templateId?: string | null;
  status: string;
  dlrStatus?: string | null;
  attempts?: number;
  createdAt: string;
  updatedAt?: string;
}

export type SmsInboxItem = SmsMessageRecord;
export type SmsOutboxItem = SmsMessageRecord;

export interface AuditEventRecord {
  id: string;
  actorType: 'PATIENT' | 'STAFF' | 'SYSTEM' | 'SMS_GATEWAY';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type AuditEvent = AuditEventRecord;

export interface StaffUserRecord {
  id: string;
  username: string;
  displayName: string;
  facilityId: string | null;
  facilityCode: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: string;
}

export interface CounterLookupResult {
  found: boolean;
  checksumValid: boolean;
  qrVerified?: boolean;
  verificationMethod: 'TRACKING_ID' | 'QR_SIGNATURE';
  error?: string;
  booking?: BookingRecord;
  slip?: {
    slipNumber: string;
    trackingId: string;
    tokenNumber: number | null;
    facilityName: string;
    facilityCode: string;
    departmentName: string;
    deptCode: string;
    roomNumber: string;
    slotDate: string;
    session: SessionPeriod;
    reportingWindow: string;
    maskedPatientName: string;
    phoneLast4: string;
    channel: BookingChannel;
    status: BookingStatus;
    arrivedAt: string | null;
    printedAt: string;
  };
}

export interface AdminQueueSnapshot {
  facilityCode: string;
  facilityName: string;
  deptCode: string;
  departmentName: string;
  roomNumber: string;
  date: string;
  generatedAt: string;
  summary: {
    totalCapacity: number;
    reservedSmsQuota: number;
    confirmedCount: number;
    pendingHoldCount: number;
    arrivedCount: number;
    completedCount: number;
    cancelledCount: number;
    expiredCount: number;
    availableSlots: number;
    lastIssuedToken: number;
    currentServingToken: number | null;
    byChannel: Record<BookingChannel, number>;
  };
  sessions: SessionSlotRecord[];
  queue: BookingRecord[];
}

// ============================================================================
// 6. JSON SCHEMAS (Draft 2020-12)
// ============================================================================

export const JSON_SCHEMAS = {
  ParsedSmsContract: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'ParsedSmsContract',
    type: 'object',
    required: ['messageId', 'msisdn', 'receivedAt', 'intent', 'entities', 'confidence', 'parseErrors'],
    properties: {
      messageId: { type: 'string' },
      msisdn: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
      receivedAt: { type: 'string', format: 'date-time' },
      intent: { type: 'string', enum: SMS_INTENTS },
      entities: {
        type: 'object',
        required: ['facilityCode', 'deptCode', 'requestedDate', 'session', 'confirmCode', 'trackingId'],
        properties: {
          facilityCode: { type: ['string', 'null'] },
          deptCode: { type: ['string', 'null'] },
          requestedDate: { type: ['string', 'null'] },
          date: { type: ['string', 'null'] },
          session: { type: ['string', 'null'], enum: ['MORNING', 'AFTERNOON', 'EVENING', null] },
          confirmCode: { type: ['string', 'null'] },
          trackingId: { type: ['string', 'null'] },
        },
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      parseErrors: { type: 'array', items: { type: 'string' } },
      normalizedCommand: { type: 'string' },
    },
  },
  Booking: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'BookingRecord',
    type: 'object',
    required: [
      'id',
      'trackingId',
      'facilityCode',
      'deptCode',
      'sessionId',
      'slotDate',
      'session',
      'patientId',
      'maskedPatientName',
      'phoneLast4',
      'channel',
      'status',
      'createdAt',
    ],
    properties: {
      id: { type: 'string' },
      trackingId: { type: 'string' },
      facilityId: { type: 'string' },
      facilityCode: { type: 'string' },
      departmentId: { type: 'string' },
      deptCode: { type: 'string' },
      sessionId: { type: 'string' },
      slotDate: { type: 'string', format: 'date' },
      session: { type: 'string', enum: ['MORNING', 'AFTERNOON', 'EVENING'] },
      reportingWindow: { type: 'string' },
      patientId: { type: 'string' },
      maskedPatientName: { type: 'string' },
      phoneLast4: { type: 'string' },
      channel: { type: 'string', enum: BOOKING_CHANNELS },
      status: { type: 'string', enum: BOOKING_STATUSES },
      tokenNumber: { type: ['integer', 'null'] },
      holdExpiresAt: { type: ['string', 'null'] },
      qrPayload: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      confirmedAt: { type: ['string', 'null'] },
      arrivedAt: { type: ['string', 'null'] },
    },
  },
} as const;
