/**
 * MedVeda OPD Booking — Deterministic SMS Parser & Grammar Engine (Agent A4)
 *
 * Implements Section 3 & Section 4 of /docs/PLAN.md:
 * - Zero external dependencies; natively runnable with `node --experimental-transform-types`
 * - Supports all 6 user intents (BOOK, LIST, CONFIRM, CANCEL, STATUS, HELP) + UNKNOWN fallback
 * - Case-insensitive, tolerant of extra whitespace, punctuation, and minor typos (Levenshtein)
 * - Supports English and transliterated Hindi keywords & department aliases
 * - Enforces safety invariant: low confidence (< 0.75) or missing required entities never
 *   produce a valid BOOK intent without parseErrors.
 */

export type SmsIntent =
  | 'BOOK'
  | 'LIST'
  | 'CONFIRM'
  | 'CANCEL'
  | 'STATUS'
  | 'HELP'
  | 'UNKNOWN';

export type OpdSession = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type SessionPeriod = OpdSession;

export type FacilityCode = 'DHJ01' | 'SBMC01' | 'SDH01' | 'RIMS01' | 'CHC01';

export type DepartmentCode =
  | 'MED'
  | 'CAR'
  | 'NEU'
  | 'PED'
  | 'ORT'
  | 'GYN'
  | 'ENT'
  | 'OPH';

export interface SmsParsedEntities {
  facilityCode: string | null;
  deptCode: string | null;
  requestedDate: string | null;
  /** Non-enumerable alias for `requestedDate` for compatibility with PLAN.md Section 3 snippets */
  readonly date?: string | null;
  session: OpdSession | null;
  confirmCode: string | null;
  trackingId: string | null;
}

export type SmsParseEntities = SmsParsedEntities;

export interface SmsParseResult {
  messageId: string;
  msisdn: string;
  receivedAt: string;
  intent: SmsIntent;
  entities: SmsParsedEntities;
  confidence: number;
  parseErrors: string[];
  normalizedCommand?: string;
}

export type ParsedSmsContract = SmsParseResult;

export interface SmsParseInput {
  messageId: string;
  msisdn: string;
  text: string;
  receivedAt?: string;
  now?: Date;
}

export interface FacilityMetadata {
  code: FacilityCode;
  name: string;
  shortName: string;
  district: string;
  aliases: readonly string[];
}

export interface DepartmentMetadata {
  code: DepartmentCode;
  name: string;
  aliases: readonly string[];
  hindiAliases: readonly string[];
}

export const KNOWN_FACILITIES: Readonly<Record<FacilityCode, FacilityMetadata>> = {
  DHJ01: {
    code: 'DHJ01',
    name: 'District Hospital Jamshedpur',
    shortName: 'DH Jamshedpur',
    district: 'East Singhbhum',
    aliases: ['DHJ1', 'DHJ', 'DHJ001', 'JAMSHEDPUR', 'DHJAMSHEDPUR'],
  },
  SBMC01: {
    code: 'SBMC01',
    name: 'Shaheed Nirmal Mahto Medical College & Hospital',
    shortName: 'SBMCH Dhanbad',
    district: 'Dhanbad',
    aliases: ['SBMC1', 'SBMC', 'SBMCH', 'SBMCH01', 'SBMC001'],
  },
  SDH01: {
    code: 'SDH01',
    name: 'Sub-Divisional Hospital Khunti',
    shortName: 'SDH Khunti',
    district: 'Khunti',
    aliases: ['SDH1', 'SDH', 'SDH001'],
  },
  RIMS01: {
    code: 'RIMS01',
    name: 'Rajendra Institute of Medical Sciences Ranchi',
    shortName: 'RIMS Ranchi',
    district: 'Ranchi',
    aliases: ['RIMS1', 'RIMS', 'RIMS001', 'RANCHI'],
  },
  CHC01: {
    code: 'CHC01',
    name: 'Community Health Centre Ormanjhi',
    shortName: 'CHC Ormanjhi',
    district: 'Ranchi',
    aliases: ['CHC1', 'CHC', 'CHC001'],
  },
} as const;

export const KNOWN_DEPARTMENTS: Readonly<Record<DepartmentCode, DepartmentMetadata>> = {
  MED: {
    code: 'MED',
    name: 'General Medicine',
    aliases: ['MEDICINE', 'GENMED', 'GENERAL', 'GEN', 'MD', 'PHYSICIAN', 'FEVER', 'INTERNAL'],
    hindiAliases: ['DAVA', 'DAWA', 'DAVAI', 'DAWAI', 'BUKHAR', 'AAM'],
  },
  CAR: {
    code: 'CAR',
    name: 'Cardiology',
    aliases: ['CARDIO', 'CARDIOLOGY', 'CARD', 'HEART', 'CARDIAC'],
    hindiAliases: ['DIL', 'HRIDAY', 'DHADKAN'],
  },
  NEU: {
    code: 'NEU',
    name: 'Neurology',
    aliases: ['NEURO', 'NEUROLOGY', 'BRAIN', 'NERVE', 'NEURAL'],
    hindiAliases: ['DIMAG', 'DIMAAG', 'NAS', 'MASTISHK'],
  },
  PED: {
    code: 'PED',
    name: 'Pediatrics',
    aliases: ['PEDIA', 'PEDIATRICS', 'PAEDIA', 'PAEDIATRICS', 'CHILD', 'CHILDREN', 'KIDS', 'BABY'],
    hindiAliases: ['BACHCHA', 'BACCHA', 'BACHE', 'BACHCHE', 'SHISHU', 'BAL'],
  },
  ORT: {
    code: 'ORT',
    name: 'Orthopedics',
    aliases: ['ORTHO', 'ORTHOPEDICS', 'ORTHOPAEDICS', 'BONE', 'BONES', 'JOINT', 'FRACTURE'],
    hindiAliases: ['HADDY', 'HADDI', 'HADDIYA', 'JOD'],
  },
  GYN: {
    code: 'GYN',
    name: 'Gynecology & Obstetrics',
    aliases: [
      'GYNAE',
      'GYNEC',
      'GYNAEC',
      'GYNECOLOGY',
      'GYNAECOLOGY',
      'OBGYN',
      'OBS',
      'MATERNITY',
      'WOMEN',
      'PREGNANCY',
    ],
    hindiAliases: ['PRASUTI', 'MAHILA', 'STRI', 'GARBH', 'AURAT'],
  },
  ENT: {
    code: 'ENT',
    name: 'ENT & Dental',
    aliases: ['EAR', 'NOSE', 'THROAT', 'DENTAL', 'TOOTH', 'TEETH', 'DEN', 'DENTIST'],
    hindiAliases: ['KAAN', 'KAN', 'NAAK', 'NAK', 'GALA', 'DANT', 'DAANT'],
  },
  OPH: {
    code: 'OPH',
    name: 'Ophthalmology',
    aliases: ['OPHTHAL', 'OPHTHALMOLOGY', 'EYE', 'EYES', 'VISION', 'OPTIC'],
    hindiAliases: ['AANKH', 'ANKH', 'AANKHEN', 'NETRA', 'CHASHMA'],
  },
} as const;

export const KNOWN_FACILITY_CODES: readonly FacilityCode[] = Object.keys(
  KNOWN_FACILITIES
) as FacilityCode[];

export const KNOWN_DEPARTMENT_CODES: readonly DepartmentCode[] = Object.keys(
  KNOWN_DEPARTMENTS
) as DepartmentCode[];

const BOOK_PREFIX_KEYWORDS = new Set([
  'OPD',
  'BOOK',
  'BOOKING',
  'APPT',
  'APPOINTMENT',
  'PARCHI',
]);

const LIST_KEYWORDS = new Set([
  'LIST',
  'SUCHEE',
  'SUCHI',
  'HOSP',
  'HOSPITAL',
  'HOSPITALS',
  'ASPATAL',
  'ASPATAAL',
]);

const CONFIRM_KEYWORDS = new Set([
  'Y',
  'YES',
  'HAAN',
  'HAN',
  'HAA',
  'CONFIRM',
  'CNF',
  'OK',
]);

const CANCEL_KEYWORDS = new Set([
  'CANCEL',
  'CAN',
  'RADD',
  'RAD',
  'N',
  'NO',
  'NAHI',
  'NAHIN',
]);

const STATUS_KEYWORDS = new Set([
  'STATUS',
  'ST',
  'STHITI',
  'TOKEN',
  'CHECK',
]);

const HELP_KEYWORDS = new Set([
  'HELP',
  'INFO',
  'MADAD',
  'SAHAYATA',
  'JANKARI',
  '?',
]);

const TODAY_KEYWORDS = new Set(['TODAY', 'AAJ', 'AJ']);
const TOMORROW_KEYWORDS = new Set(['TOMORROW', 'TMRW', 'TOM', 'KAL']);

const SESSION_MAP: Readonly<Record<string, OpdSession>> = {
  MORN: 'MORNING',
  MORNING: 'MORNING',
  MRNG: 'MORNING',
  AM: 'MORNING',
  SUBAH: 'MORNING',
  SAVERE: 'MORNING',
  AFT: 'AFTERNOON',
  AFTERNOON: 'AFTERNOON',
  AFTRN: 'AFTERNOON',
  PM: 'AFTERNOON',
  DOPAHAR: 'AFTERNOON',
  DOPHER: 'AFTERNOON',
  DUPAHAR: 'AFTERNOON',
  EVE: 'EVENING',
  EVENING: 'EVENING',
  EVNG: 'EVENING',
  SHAAM: 'EVENING',
  SHAM: 'EVENING',
};

const STOP_WORDS = new Set([
  'FOR',
  'ON',
  'AT',
  'IN',
  'TO',
  'THE',
  'KE',
  'LIYE',
  'KA',
  'KI',
  'KO',
  'ME',
  'MEIN',
  'PLEASE',
  'PLS',
  'PLZ',
]);

const RESERVED_NON_ENTITY_TOKENS = new Set([
  ...BOOK_PREFIX_KEYWORDS,
  ...LIST_KEYWORDS,
  ...CONFIRM_KEYWORDS,
  ...CANCEL_KEYWORDS,
  ...STATUS_KEYWORDS,
  ...HELP_KEYWORDS,
  ...TODAY_KEYWORDS,
  ...TOMORROW_KEYWORDS,
  ...Object.keys(SESSION_MAP),
  ...STOP_WORDS,
]);

/**
 * Returns a concise GSM-7 (< 160 chars) help prompt explaining the SMS commands.
 */
export function getSmsGrammarHelpText(): string {
  return 'MedVeda OPD: Send OPD <HOSP> <DEPT> [DDMM] (e.g. OPD DHJ01 MED 1804). Reply Y <CODE> to confirm, LIST <DEPT> for hospitals, STATUS <ID> or CANCEL <ID>.';
}

/**
 * Standard Levenshtein edit distance between two uppercase strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

interface EntityMatch<T extends string> {
  code: T;
  matchType: 'EXACT' | 'ALIAS' | 'HINDI' | 'FUZZY';
  penalty: number;
}

/**
 * Matches a single token against known facility codes, aliases, and fuzzy Levenshtein distance <= 1.
 */
export function matchFacilityToken(rawToken: string): EntityMatch<FacilityCode> | null {
  const token = rawToken.toUpperCase().trim();
  if (!token || RESERVED_NON_ENTITY_TOKENS.has(token)) {
    return null;
  }

  // 1. Exact canonical match
  for (const code of KNOWN_FACILITY_CODES) {
    if (token === code) {
      return { code, matchType: 'EXACT', penalty: 0 };
    }
  }

  // 2. Known alias match (e.g. DHJ1 -> DHJ01, SBMC1 -> SBMC01, RIMS1 -> RIMS01)
  for (const code of KNOWN_FACILITY_CODES) {
    const meta = KNOWN_FACILITIES[code];
    if (meta.aliases.includes(token)) {
      return { code, matchType: 'ALIAS', penalty: 0.06 };
    }
  }

  // 3. Keypad/OCR normalization on suffix digits (e.g. DHJO1 -> DHJ01, RIMS0I -> RIMS01)
  const normalizedDigits = token.replace(/([A-Z]{3,4})([O0I1L]{1,2})$/, (_m, prefix: string, suffix: string) => {
    const fixedSuffix = suffix.replace(/O/g, '0').replace(/[IL]/g, '1');
    return `${prefix}${fixedSuffix}`;
  });
  if (normalizedDigits !== token) {
    for (const code of KNOWN_FACILITY_CODES) {
      if (normalizedDigits === code || KNOWN_FACILITIES[code].aliases.includes(normalizedDigits)) {
        return { code, matchType: 'FUZZY', penalty: 0.08 };
      }
    }
  }

  // 4. Fuzzy Levenshtein match (distance <= 1 against canonical codes or 4+ char aliases)
  if (token.length >= 3 && !/^\d+$/.test(token)) {
    let bestCode: FacilityCode | null = null;
    let bestDist = Infinity;

    for (const code of KNOWN_FACILITY_CODES) {
      const dist = levenshteinDistance(token, code);
      if (dist <= 1 && dist < bestDist) {
        bestDist = dist;
        bestCode = code;
      }
      for (const alias of KNOWN_FACILITIES[code].aliases) {
        if (alias.length >= 4) {
          const aliasDist = levenshteinDistance(token, alias);
          if (aliasDist <= 1 && aliasDist < bestDist) {
            bestDist = aliasDist;
            bestCode = code;
          }
        }
      }
    }

    if (bestCode) {
      return { code: bestCode, matchType: 'FUZZY', penalty: 0.09 };
    }
  }

  return null;
}

/**
 * Matches a single token against known department codes, English full names,
 * Hindi transliterated names, and fuzzy Levenshtein distance (<= 1 for short codes, <= 2 for full names).
 */
export function matchDepartmentToken(rawToken: string): EntityMatch<DepartmentCode> | null {
  const token = rawToken.toUpperCase().trim();
  if (!token) return null;

  // Allow DAVA / DAWA to match MED when evaluated as a department token
  if (RESERVED_NON_ENTITY_TOKENS.has(token) && token !== 'DAVA' && token !== 'DAWA') {
    return null;
  }

  // 1. Exact canonical 3-letter code match
  for (const code of KNOWN_DEPARTMENT_CODES) {
    if (token === code) {
      return { code, matchType: 'EXACT', penalty: 0 };
    }
  }

  // 2. Exact English alias match (e.g. CARDIO, MEDICINE, ORTHO, GYNAE, PEDIA, NEURO, OPHTHAL)
  for (const code of KNOWN_DEPARTMENT_CODES) {
    const meta = KNOWN_DEPARTMENTS[code];
    if (meta.aliases.includes(token)) {
      return { code, matchType: 'ALIAS', penalty: 0.04 };
    }
  }

  // 3. Exact Hindi transliterated alias match (e.g. DIL, HADDY, BACHCHA, AANKH, PRASUTI, DANT, DAVA)
  for (const code of KNOWN_DEPARTMENT_CODES) {
    const meta = KNOWN_DEPARTMENTS[code];
    if (meta.hindiAliases.includes(token)) {
      return { code, matchType: 'HINDI', penalty: 0.04 };
    }
  }

  // Ignore purely numeric tokens or tokens that look like facility codes
  if (/^\d+$/.test(token) || /\d/.test(token)) {
    return null;
  }

  // 4. Fuzzy Levenshtein match:
  //    - distance <= 1 for short codes (length 3-4, e.g. MEDI -> MED, ORTI -> ORT, CARI -> CAR)
  //    - distance <= 2 for longer department names (length >= 5, e.g. CARDIOL -> CARDIO, MEDICIN -> MEDICINE)
  let bestCode: DepartmentCode | null = null;
  let bestDist = Infinity;

  if (token.length >= 3 && token.length <= 4) {
    for (const code of KNOWN_DEPARTMENT_CODES) {
      const dist = levenshteinDistance(token, code);
      if (dist <= 1 && dist < bestDist) {
        bestDist = dist;
        bestCode = code;
      }
      for (const alias of [
        ...KNOWN_DEPARTMENTS[code].aliases,
        ...KNOWN_DEPARTMENTS[code].hindiAliases,
      ]) {
        if (alias.length >= 3 && alias.length <= 5) {
          const aliasDist = levenshteinDistance(token, alias);
          if (aliasDist <= 1 && aliasDist < bestDist) {
            bestDist = aliasDist;
            bestCode = code;
          }
        }
      }
    }
  } else if (token.length >= 5) {
    for (const code of KNOWN_DEPARTMENT_CODES) {
      for (const alias of [
        ...KNOWN_DEPARTMENTS[code].aliases,
        ...KNOWN_DEPARTMENTS[code].hindiAliases,
      ]) {
        if (alias.length >= 5) {
          const maxAllowed = alias.length >= 6 ? 2 : 1;
          const aliasDist = levenshteinDistance(token, alias);
          if (aliasDist <= maxAllowed && aliasDist < bestDist) {
            bestDist = aliasDist;
            bestCode = code;
          }
        }
      }
    }
  }

  if (bestCode) {
    return { code: bestCode, matchType: 'FUZZY', penalty: 0.09 };
  }

  return null;
}

function createEntities(partial?: Partial<SmsParsedEntities>): SmsParsedEntities {
  const entities: SmsParsedEntities = {
    facilityCode: partial?.facilityCode ?? null,
    deptCode: partial?.deptCode ?? null,
    requestedDate: partial?.requestedDate ?? null,
    session: partial?.session ?? null,
    confirmCode: partial?.confirmCode ?? null,
    trackingId: partial?.trackingId ?? null,
  };

  Object.defineProperty(entities, 'date', {
    get(this: SmsParsedEntities) {
      return this.requestedDate;
    },
    enumerable: false,
    configurable: true,
  });

  return entities;
}

interface IstReferenceTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  explicitReferenceProvided: boolean;
}

function getIstReferenceTime(receivedAt?: string, now?: Date): IstReferenceTime {
  let baseDate: Date | null = null;
  let explicitReferenceProvided = false;

  if (now instanceof Date && !Number.isNaN(now.getTime())) {
    baseDate = now;
    explicitReferenceProvided = true;
  } else if (typeof receivedAt === 'string' && receivedAt.trim().length > 0) {
    const parsed = new Date(receivedAt);
    if (!Number.isNaN(parsed.getTime())) {
      baseDate = parsed;
      explicitReferenceProvided = true;
    }
  }

  if (!baseDate) {
    baseDate = new Date();
  }

  // Convert UTC timestamp to IST (UTC+05:30 = +19,800,000 ms)
  const istMillis = baseDate.getTime() + (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(istMillis);

  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
    hour: istDate.getUTCHours(),
    minute: istDate.getUTCMinutes(),
    explicitReferenceProvided,
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

function formatYyyyMmDd(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToYmd(
  year: number,
  month: number,
  day: number,
  daysToAdd: number
): string {
  const utc = Date.UTC(year, month - 1, day) + daysToAdd * 86400000;
  const d = new Date(utc);
  return formatYyyyMmDd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

interface ParsedDateToken {
  kind: 'VALID' | 'INVALID';
  dateStr: string | null;
  isDefaulted: boolean;
}

function tryParseDateToken(rawToken: string, ref: IstReferenceTime): ParsedDateToken | null {
  const token = rawToken.toUpperCase().trim();

  // 1. TODAY / AAJ
  if (TODAY_KEYWORDS.has(token)) {
    // Per Section 4.1: If omitted or TODAY / AAJ, defaults to today's date in IST
    // if before 11:00 IST, or tomorrow's date if after 11:00 IST when reference timestamp is used
    const offsetDays = ref.explicitReferenceProvided && ref.hour >= 11 ? 1 : 0;
    return {
      kind: 'VALID',
      dateStr: addDaysToYmd(ref.year, ref.month, ref.day, offsetDays),
      isDefaulted: false,
    };
  }

  // 2. TOMORROW / KAL
  if (TOMORROW_KEYWORDS.has(token)) {
    return {
      kind: 'VALID',
      dateStr: addDaysToYmd(ref.year, ref.month, ref.day, 1),
      isDefaulted: false,
    };
  }

  // 3. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(token);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays) {
      return { kind: 'INVALID', dateStr: null, isDefaulted: false };
    }
    return {
      kind: 'VALID',
      dateStr: formatYyyyMmDd(year, month, day),
      isDefaulted: false,
    };
  }

  // 4. DD/MM or DD-MM or DD.MM
  const sepMatch = /^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?$/.exec(token);
  if (sepMatch) {
    const day = Number(sepMatch[1]);
    const month = Number(sepMatch[2]);
    let year = ref.year;
    if (sepMatch[3]) {
      const rawYear = Number(sepMatch[3]);
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    }
    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays) {
      return { kind: 'INVALID', dateStr: null, isDefaulted: false };
    }
    return {
      kind: 'VALID',
      dateStr: formatYyyyMmDd(year, month, day),
      isDefaulted: false,
    };
  }

  // 5. 4-digit DDMM (e.g. 1804 -> YYYY-04-18, 3213 -> INVALID, 3102 -> INVALID)
  if (/^\d{4}$/.test(token)) {
    const day = Number(token.slice(0, 2));
    const month = Number(token.slice(2, 4));
    const year = ref.year;
    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays) {
      return { kind: 'INVALID', dateStr: null, isDefaulted: false };
    }
    return {
      kind: 'VALID',
      dateStr: formatYyyyMmDd(year, month, day),
      isDefaulted: false,
    };
  }

  return null;
}

/**
 * Normalizes a tracking ID (e.g. "mv-7k4q-9x2" -> "MV7K4Q9X2") and checks whether
 * it matches the MedVeda tracking ID pattern (starts with MV followed by 6-10 base32/alphanumeric chars).
 */
export function normalizeTrackingId(rawToken: string): string | null {
  const cleaned = rawToken.toUpperCase().replace(/[\s\-]/g, '');
  if (/^MV[0-9A-Z]{5,10}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Tokenizes inbound SMS text while preserving date separators (18/04, 18-04)
 * and hyphenated tracking IDs (MV-7K4Q-9X2).
 */
function tokenizeSms(text: string): string[] {
  const replaced = text
    .trim()
    .replace(/[,;:!()\[\]{}"'*#@~_|+=<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!replaced) return [];

  const rawParts = replaced.split(' ');
  const tokens: string[] = [];

  for (const part of rawParts) {
    const trimmed = part.replace(/^[\/\-\.]+|[\/\-\.]+$/g, '');
    if (!trimmed) continue;

    // Keep ? intact
    if (trimmed === '?' || trimmed.endsWith('?')) {
      const withoutQ = trimmed.replace(/\?+/g, '');
      if (withoutQ) tokens.push(withoutQ.toUpperCase());
      tokens.push('?');
      continue;
    }

    // Keep date tokens like 18/04, 18-04, 2026-04-18 intact
    if (
      /^\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?$/.test(trimmed) ||
      /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)
    ) {
      tokens.push(trimmed.toUpperCase());
      continue;
    }

    // Keep hyphenated Tracking IDs like MV-7K4Q-9X2 intact
    if (/^MV-[0-9A-Z\-]+$/i.test(trimmed)) {
      tokens.push(trimmed.toUpperCase());
      continue;
    }

    // Otherwise split on internal slashes or hyphens (e.g. OPD-DHJ01-MED or Y-4821)
    const subParts = trimmed.split(/[\/\-]+/).filter(Boolean);
    for (const sub of subParts) {
      tokens.push(sub.toUpperCase());
    }
  }

  return tokens;
}

function roundConfidence(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 100) / 100;
}

/**
 * Deterministic Inbound SMS Parser for MedVeda OPD Booking.
 */
export function parseInboundSms(input: SmsParseInput): SmsParseResult {
  const messageId = input.messageId ?? '';
  const msisdn = (input.msisdn ?? '').trim();
  const receivedAt =
    input.receivedAt ??
    (input.now instanceof Date ? input.now.toISOString() : new Date().toISOString());
  const refTime = getIstReferenceTime(input.receivedAt, input.now);

  const rawText = (input.text ?? '').trim();
  if (!rawText) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'UNKNOWN',
      entities: createEntities(),
      confidence: 0,
      parseErrors: ['EMPTY_MESSAGE'],
    };
  }

  const tokens = tokenizeSms(rawText);
  if (tokens.length === 0) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'UNKNOWN',
      entities: createEntities(),
      confidence: 0,
      parseErrors: ['EMPTY_MESSAGE'],
    };
  }

  const first = tokens[0];
  const second = tokens[1];

  // =========================================================================
  // 1. HELP Intent: HELP, MADAD, INFO, ?, bare OPD, OPD HELP
  // =========================================================================
  if (
    tokens.length === 1 &&
    (HELP_KEYWORDS.has(first) || first === 'OPD' || first === 'BOOK' || first === 'APPT')
  ) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'HELP',
      entities: createEntities(),
      confidence: 1.0,
      parseErrors: [],
    };
  }

  if (
    HELP_KEYWORDS.has(first) ||
    (tokens.length === 2 && first === 'OPD' && HELP_KEYWORDS.has(second))
  ) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'HELP',
      entities: createEntities(),
      confidence: 0.99,
      parseErrors: [],
    };
  }

  // =========================================================================
  // 2. CONFIRM Intent: Y 4821, YES 4821, CONFIRM 4821, HAAN 4821, bare Y/YES/HAAN/1
  // =========================================================================
  if (CONFIRM_KEYWORDS.has(first) || (tokens.length === 1 && first === '1')) {
    if (tokens.length === 1) {
      return {
        messageId,
        msisdn,
        receivedAt,
        intent: 'CONFIRM',
        entities: createEntities({ confirmCode: null }),
        confidence: 0.95,
        parseErrors: [],
      };
    }

    // Look for a 4-digit confirmation code in remaining tokens
    const codeToken = tokens.slice(1).find((t) => /^\d{4}$/.test(t));
    if (codeToken) {
      return {
        messageId,
        msisdn,
        receivedAt,
        intent: 'CONFIRM',
        entities: createEntities({ confirmCode: codeToken }),
        confidence: 0.99,
        parseErrors: [],
      };
    }

    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'CONFIRM',
      entities: createEntities({ confirmCode: null }),
      confidence: 0.4,
      parseErrors: ['INVALID_CONFIRM_CODE'],
    };
  }

  // =========================================================================
  // 3. CANCEL Intent: CANCEL <TRACKING_ID>, RADD <TRACKING_ID>, N 4821, bare N/NO/NAHI
  // =========================================================================
  if (CANCEL_KEYWORDS.has(first)) {
    if (tokens.length === 1) {
      return {
        messageId,
        msisdn,
        receivedAt,
        intent: 'CANCEL',
        entities: createEntities(),
        confidence: 0.92,
        parseErrors: [],
      };
    }

    for (const candidate of tokens.slice(1)) {
      if ( STOP_WORDS.has(candidate) ) continue;

      const trackingId = normalizeTrackingId(candidate);
      if (trackingId) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'CANCEL',
          entities: createEntities({ trackingId }),
          confidence: 0.99,
          parseErrors: [],
        };
      }

      if (/^\d{4}$/.test(candidate)) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'CANCEL',
          entities: createEntities({ confirmCode: candidate }),
          confidence: 0.98,
          parseErrors: [],
        };
      }
    }

    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'CANCEL',
      entities: createEntities(),
      confidence: 0.4,
      parseErrors: ['INVALID_CANCEL_TARGET'],
    };
  }

  // =========================================================================
  // 4. STATUS Intent: STATUS <TRACKING_ID>, ST <TRACKING_ID>, TOKEN <TRACKING_ID>, STHITI
  // =========================================================================
  if (STATUS_KEYWORDS.has(first)) {
    if (tokens.length === 1) {
      return {
        messageId,
        msisdn,
        receivedAt,
        intent: 'STATUS',
        entities: createEntities(),
        confidence: 0.9,
        parseErrors: [],
      };
    }

    for (const candidate of tokens.slice(1)) {
      if (STOP_WORDS.has(candidate)) continue;
      const trackingId = normalizeTrackingId(candidate);
      if (trackingId) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'STATUS',
          entities: createEntities({ trackingId }),
          confidence: 0.99,
          parseErrors: [],
        };
      }
    }

    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'STATUS',
      entities: createEntities(),
      confidence: 0.4,
      parseErrors: ['INVALID_TRACKING_ID'],
    };
  }

  // =========================================================================
  // 5. LIST Intent: LIST, LIST <DEPT>, HOSP <DEPT>, ASPATAL <DEPT>, SUCHEE <DEPT>
  //    (Note: If ASPATAL/ASPATAAL is followed by BOTH a facility and a department,
  //     e.g. "ASPATAAL DHJ01 MED", treat it as BOOK below.)
  // =========================================================================
  if (LIST_KEYWORDS.has(first)) {
    const restTokens = tokens.slice(1).filter((t) => !STOP_WORDS.has(t) && t !== 'OPD');
    const hasFacility = restTokens.some((t) => matchFacilityToken(t) !== null);
    const hasDept = restTokens.some((t) => matchDepartmentToken(t) !== null);

    // Only treat as LIST if not a full "<FACILITY> <DEPT>" booking command
    if (!(hasFacility && hasDept)) {
      if (restTokens.length === 0) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'LIST',
          entities: createEntities(),
          confidence: 0.99,
          parseErrors: [],
        };
      }

      const deptMatch = matchDepartmentToken(restTokens[0]);
      if (deptMatch) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'LIST',
          entities: createEntities({ deptCode: deptMatch.code }),
          confidence: roundConfidence(0.98 - deptMatch.penalty),
          parseErrors: [],
        };
      }

      const facMatch = matchFacilityToken(restTokens[0]);
      if (facMatch) {
        return {
          messageId,
          msisdn,
          receivedAt,
          intent: 'LIST',
          entities: createEntities({ facilityCode: facMatch.code }),
          confidence: roundConfidence(0.96 - facMatch.penalty),
          parseErrors: [],
        };
      }

      return {
        messageId,
        msisdn,
        receivedAt,
        intent: 'LIST',
        entities: createEntities(),
        confidence: 0.45,
        parseErrors: ['UNKNOWN_DEPARTMENT'],
      };
    }
  }

  // =========================================================================
  // 6. BOOK Intent (Explicit prefix or implicit <HOSP_CODE> <DEPT_CODE>)
  // =========================================================================
  let cursor = 0;
  let hasExplicitBookPrefix = false;

  while (
    cursor < tokens.length &&
    (BOOK_PREFIX_KEYWORDS.has(tokens[cursor]) ||
      tokens[cursor] === 'ASPATAL' ||
      tokens[cursor] === 'ASPATAAL' ||
      (cursor === 0 &&
        (tokens[cursor] === 'DAVA' || tokens[cursor] === 'DAWA') &&
        tokens.length >= 3))
  ) {
    hasExplicitBookPrefix = true;
    cursor++;
  }

  const remainingTokens = tokens.slice(cursor);

  let facilityMatch: EntityMatch<FacilityCode> | null = null;
  let deptMatch: EntityMatch<DepartmentCode> | null = null;
  let parsedDate: ParsedDateToken | null = null;
  let session: OpdSession | null = null;
  const unrecognizedTokens: string[] = [];

  for (const token of remainingTokens) {
    if (STOP_WORDS.has(token) || BOOK_PREFIX_KEYWORDS.has(token)) {
      continue;
    }

    // Session keyword?
    if (SESSION_MAP[token] && session === null) {
      session = SESSION_MAP[token];
      continue;
    }

    // Date token?
    if (parsedDate === null) {
      const dateAttempt = tryParseDateToken(token, refTime);
      if (dateAttempt !== null) {
        parsedDate = dateAttempt;
        continue;
      }
    }

    // Facility token?
    if (facilityMatch === null) {
      const facAttempt = matchFacilityToken(token);
      if (facAttempt !== null) {
        facilityMatch = facAttempt;
        continue;
      }
    }

    // Department token?
    if (deptMatch === null) {
      const deptAttempt = matchDepartmentToken(token);
      if (deptAttempt !== null) {
        deptMatch = deptAttempt;
        continue;
      }
    }

    unrecognizedTokens.push(token);
  }

  const isBookingCandidate =
    hasExplicitBookPrefix || facilityMatch !== null || deptMatch !== null;

  if (!isBookingCandidate) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'UNKNOWN',
      entities: createEntities(),
      confidence: 0,
      parseErrors: ['UNRECOGNIZED_COMMAND'],
    };
  }

  // If neither explicit prefix nor facility match exists, and only a single stray word matched
  // a department amidst unrecognized tokens, treat as UNKNOWN rather than BOOK
  if (!hasExplicitBookPrefix && facilityMatch === null && unrecognizedTokens.length > 0) {
    return {
      messageId,
      msisdn,
      receivedAt,
      intent: 'UNKNOWN',
      entities: createEntities(),
      confidence: 0,
      parseErrors: ['UNRECOGNIZED_COMMAND'],
    };
  }

  const parseErrors: string[] = [];

  if (facilityMatch === null) {
    if (unrecognizedTokens.length > 0) {
      parseErrors.push('UNKNOWN_FACILITY');
    } else {
      parseErrors.push('MISSING_FACILITY');
    }
  }

  if (deptMatch === null) {
    if (unrecognizedTokens.length > 0 && facilityMatch !== null) {
      parseErrors.push('UNKNOWN_DEPARTMENT');
    } else if (unrecognizedTokens.length >= 2 && facilityMatch === null) {
      parseErrors.push('UNKNOWN_DEPARTMENT');
    } else {
      parseErrors.push('MISSING_DEPARTMENT');
    }
  }

  let requestedDate: string | null = null;
  if (parsedDate !== null) {
    if (parsedDate.kind === 'INVALID') {
      parseErrors.push('INVALID_DATE');
      requestedDate = null;
    } else {
      requestedDate = parsedDate.dateStr;
    }
  } else {
    // Default date: today in IST if before 11:00 IST, or tomorrow if >= 11:00 IST
    const offsetDays = refTime.hour >= 11 ? 1 : 0;
    requestedDate = addDaysToYmd(refTime.year, refTime.month, refTime.day, offsetDays);
  }

  const resolvedSession: OpdSession = session ?? 'MORNING';

  // Calculate confidence
  let confidence = 0.98;
  if (!hasExplicitBookPrefix) {
    confidence -= 0.03;
  }
  if (facilityMatch) {
    confidence -= facilityMatch.penalty;
  }
  if (deptMatch) {
    confidence -= deptMatch.penalty;
  }
  if (parsedDate === null) {
    confidence -= 0.01;
  }
  if (unrecognizedTokens.length > 0 && parseErrors.length === 0) {
    confidence -= Math.min(0.12, unrecognizedTokens.length * 0.04);
  }

  // Enforce strict invariant:
  // Any parseError or missing required entity forces confidence < 0.75,
  // and any confidence < 0.75 guarantees parseErrors is non-empty.
  if (!facilityMatch || !deptMatch || !requestedDate || parseErrors.length > 0) {
    confidence = Math.min(confidence, 0.42);
    if (parseErrors.length === 0) {
      parseErrors.push('INCOMPLETE_BOOKING_ENTITIES');
    }
  } else if (confidence < 0.75) {
    parseErrors.push('LOW_CONFIDENCE');
  }

  return {
    messageId,
    msisdn,
    receivedAt,
    intent: 'BOOK',
    entities: createEntities({
      facilityCode: facilityMatch ? facilityMatch.code : null,
      deptCode: deptMatch ? deptMatch.code : null,
      requestedDate,
      session: resolvedSession,
      confirmCode: null,
      trackingId: null,
    }),
    confidence: roundConfidence(confidence),
    parseErrors,
  };
}

export const parseSms = parseInboundSms;
export default parseInboundSms;
