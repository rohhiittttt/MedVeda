import assert from 'node:assert/strict';
import { SqliteOpdBookingStore } from '../../src/infrastructure/db/sqlite-opd-booking.store.ts';
import {
  getOpdBookingCore,
  OpdBookingCoreUseCase,
  OpdBookingError,
  validateTrackingId,
  verifyQrPayload,
} from '../../src/application/use-cases/opd-booking-core.use-case.ts';
import {
  AndroidSmsGatewayAdapter,
  checkSmsRateLimit,
  DLT_TEMPLATES,
  getSmsGatewayAdapter,
  Msg91SmsAdapter,
  normalizeInboundWebhook,
  renderDltTemplate,
  resetSmsRateLimiter,
  SimulatorSmsAdapter,
  validateGsm7SingleSegment,
  verifyWebhookSignature,
} from '../../src/infrastructure/sms/sms-gateway.adapter.ts';
import {
  getOpdSmsOrchestrator,
  OpdSmsOrchestrator,
} from '../../src/application/use-cases/opd-sms-orchestrator.use-case.ts';

console.log('=== Verifying A2 (Booking Core), A3 (SMS Gateway), and A5 (2-Way SMS Orchestrator) ===');

const store = new SqliteOpdBookingStore(':memory:');
const core = new OpdBookingCoreUseCase(store);
const orchestrator = new OpdSmsOrchestrator(store, core);

// ----------------------------------------------------------------------------
// 1. Verify A2: Facilities, Departments, Sessions & Posters
// ----------------------------------------------------------------------------
const facilities = core.listFacilities();
assert.equal(facilities.length, 5, 'Expected 5 seeded OPD facilities');

const depts = core.listDepartments('DHJ01');
assert.equal(depts.length, 8, 'Expected 8 seeded departments for DHJ01');

const sessions = core.listSessions({
  facilityCode: 'DHJ01',
  deptCode: 'MED',
  date: '2026-10-12',
});
assert.equal(sessions.length, 2, 'Expected MORNING and AFTERNOON sessions');
assert.ok(sessions[0].capacity > 0);
assert.ok(sessions[0].availableTotal > 0);
assert.ok(sessions[0].availableWeb > 0);
assert.ok(sessions[0].reservedSmsQuota > 0);
assert.ok(sessions[0].reportingWindow.length > 0);

const posterBundle = core.generateDepartmentPosters('DHJ01', '2026-10-12');
assert.equal(posterBundle.posters.length, 8);
const medPoster = posterBundle.posters.find((p) => p.deptCode === 'MED')!;
assert.ok(medPoster.qrDeepLink.startsWith('/q/'));
assert.ok(
  medPoster.smsUri.includes('sms:+919876500108?body=OPD%20DHJ01%20MED'),
  `Unexpected smsUri: ${medPoster.smsUri}`
);

// ----------------------------------------------------------------------------
// 2. Verify A2: Web Booking + QR Walk-in Booking + Counter Lookup & Mark Arrived
// ----------------------------------------------------------------------------
const webBooking = core.createWebOrQrBooking({
  facilityCode: 'DHJ01',
  deptCode: 'MED',
  date: '2026-10-12',
  session: 'MORNING',
  phone: '9876543210',
  patientName: 'Ramesh Kumar',
  abhaAddress: 'ramesh.kumar@abdm',
  abhaVerified: true,
  channel: 'WEB',
  autoConfirm: true,
});

assert.equal(webBooking.status, 'CONFIRMED');
assert.equal(webBooking.tokenNumber, 1);
assert.match(webBooking.trackingId, /^MV-[0-9A-Z]{4}-[0-9A-Z]{3}$/);
assert.ok(webBooking.smsConfirmationText.length <= 160);
assert.equal(webBooking.smsOutbox.status, 'SENT');

// QR Walk-in booking using signed department poster QR token
const qrWalkinBooking = core.createWebOrQrBooking({
  qrToken: medPoster.qrToken,
  phone: '9876543211',
  patientName: 'Sita Devi',
  channel: 'QR_WALKIN',
});

assert.equal(qrWalkinBooking.status, 'CONFIRMED');
assert.equal(qrWalkinBooking.tokenNumber, 2, 'Walk-in QR shares the same sequential token counter');
assert.equal(qrWalkinBooking.booking.facilityCode, 'DHJ01');
assert.equal(qrWalkinBooking.booking.deptCode, 'MED');

// Counter lookup with valid Tracking ID
const counterValid = core.counterLookup({
  trackingId: webBooking.trackingId,
  phoneLast4: '3210',
});
assert.equal(counterValid.found, true);
assert.equal(counterValid.validCheckChar, true);
assert.equal(counterValid.booking?.id, webBooking.booking.id);

// Counter lookup with mistyped check character (last char flipped)
const lastChar = webBooking.trackingId.slice(-1);
const corruptedChar = lastChar === 'A' ? 'B' : 'A';
const mistypedTrackingId = webBooking.trackingId.slice(0, -1) + corruptedChar;
const counterInvalid = core.counterLookup({
  trackingId: mistypedTrackingId,
});
assert.equal(counterInvalid.validCheckChar, false);
assert.equal(counterInvalid.found, false);
assert.ok(counterInvalid.reason?.includes('Check character mismatch'));

// Counter lookup with signed booking QR token
const counterByQr = core.counterLookup({
  qrToken: qrWalkinBooking.qrToken,
});
assert.equal(counterByQr.found, true);
assert.equal(counterByQr.qrVerified, true);
assert.equal(counterByQr.booking?.id, qrWalkinBooking.booking.id);

// Mark ARRIVED at counter & generate slip
const arrivedRes = core.markArrived(webBooking.trackingId, 'counter-dhj01', '3210');
assert.equal(arrivedRes.found, true);
assert.equal(arrivedRes.booking?.status, 'ARRIVED');
assert.ok(arrivedRes.slipNumber?.startsWith('SLIP-DHJ01-MED-1'));
assert.equal(arrivedRes.tokenNumber, 1);
assert.equal(arrivedRes.phoneLast4, '3210');
assert.ok(arrivedRes.patientMaskedName?.includes('R****h'));
assert.ok(arrivedRes.arrivedAt);

// Admin Queue snapshot
const queueSnap = core.getAdminQueue({
  facilityCode: 'DHJ01',
  deptCode: 'MED',
  date: '2026-10-12',
});
assert.equal(queueSnap.summary.arrivedCount, 1);
assert.equal(queueSnap.summary.confirmedCount, 1);
assert.equal(queueSnap.summary.lastIssuedToken, 2);

// ----------------------------------------------------------------------------
// 3. Verify A3: SMS Gateway Adapters, Signature Check, Rate Limiter & DLT Templates
// ----------------------------------------------------------------------------
for (const [key, def] of Object.entries(DLT_TEMPLATES)) {
  const rendered = renderDltTemplate(key as any, {
    facilityCode: 'DHJ01',
    deptCode: 'MED',
    slotDate: '2026-10-12',
    requestedDate: '2026-10-12',
    altDate: '2026-10-13',
    reportingWindow: '09:30-10:30 AM',
    confirmCode: '4821',
    tokenNumber: 27,
    trackingId: 'MV-7K4Q-9X2',
    trackingIdRaw: 'MV7K4Q9X2',
    status: 'CONFIRMED',
  });
  const gsmCheck = validateGsm7SingleSegment(rendered.text);
  assert.equal(
    gsmCheck.valid,
    true,
    `Template ${key} failed GSM-7 single-segment check: ${rendered.text} (${rendered.length} chars)`
  );
  assert.ok(rendered.length <= 160);
}

// Verify Android SMS Gateway (capcom6) & MSG91 webhook normalization
const androidNormalized = normalizeInboundWebhook('android-gateway', {
  event: 'sms:received',
  payload: {
    messageId: 'and-msg-001',
    message: 'OPD DHJ01 CAR 1210',
    phoneNumber: '9876543212',
    receivedAt: '2026-10-11T09:00:00Z',
  },
});
assert.equal(androidNormalized.provider, 'android-gateway');
assert.equal(androidNormalized.providerMsgId, 'and-msg-001');
assert.equal(androidNormalized.msisdn, '+919876543212');
assert.equal(androidNormalized.rawText, 'OPD DHJ01 CAR 1210');

const msg91Normalized = normalizeInboundWebhook('msg91', {
  msgid: 'msg91-id-99',
  sender: '919876543213',
  content: 'Y 4821',
  keyword: 'OPD',
});
assert.equal(msg91Normalized.provider, 'msg91');
assert.equal(msg91Normalized.providerMsgId, 'msg91-id-99');
assert.equal(msg91Normalized.msisdn, '+919876543213');
assert.equal(msg91Normalized.rawText, 'Y 4821');

// Verify negative webhook signature rejection
const invalidSig = verifyWebhookSignature(
  'simulator',
  { text: 'HELP' },
  { 'x-webhook-signature': 'invalid' }
);
assert.equal(invalidSig.valid, false);

// Verify sliding-window rate limiter (10 requests allowed, 11th blocked)
resetSmsRateLimiter();
for (let i = 1; i <= 10; i++) {
  const rl = checkSmsRateLimit('+919999900001');
  assert.equal(rl.allowed, true, `Request #${i} should be allowed`);
}
const rl11 = checkSmsRateLimit('+919999900001');
assert.equal(rl11.allowed, false, '11th request within 15 minutes must be rate-limited');
resetSmsRateLimiter();

// ----------------------------------------------------------------------------
// 4. Verify A5: Full 2-Way SMS Loop (BOOK -> Idempotent Retry -> CONFIRM -> STATUS -> CANCEL)
// ----------------------------------------------------------------------------
const smsPhone = '+919876543299';
const refNow = new Date('2026-10-12T03:00:00.000Z'); // 08:30 IST on 2026-10-12

// Step 4a: Send "OPD DHJ01 MED" -> Creates 10-min hold
const bookTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1001',
    msisdn: smsPhone,
    text: 'OPD DHJ01 MED',
  },
  {},
  { now: refNow }
);

assert.equal(bookTurn.duplicate, false);
assert.equal(bookTurn.actionTaken, 'HOLD_CREATED');
assert.equal(bookTurn.booking?.status, 'PENDING_CONFIRMATION');
assert.ok(bookTurn.booking?.confirmCode);
assert.match(bookTurn.booking!.confirmCode!, /^\d{4}$/);
assert.ok(bookTurn.replyText.includes(`Reply Y ${bookTurn.booking!.confirmCode}`));
assert.ok(bookTurn.characterCount <= 160);

// Step 4b: Re-send exact same providerMsgId ('sim-mo-1001') -> Idempotent duplicate!
const dupTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1001',
    msisdn: smsPhone,
    text: 'OPD DHJ01 MED',
  },
  {},
  { now: refNow }
);
assert.equal(dupTurn.duplicate, true);
assert.equal(dupTurn.booking?.id, bookTurn.booking?.id);

// Step 4c: Confirm with "Y <confirmCode>" -> Allocates Token #3 & issues Tracking ID
const confirmCode = bookTurn.booking!.confirmCode!;
const confirmTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1002',
    msisdn: smsPhone,
    text: `Y ${confirmCode}`,
  },
  {},
  { now: refNow }
);

assert.equal(confirmTurn.actionTaken, 'BOOKING_CONFIRMED');
assert.equal(confirmTurn.booking?.status, 'CONFIRMED');
assert.equal(confirmTurn.booking?.tokenNumber, 3);
assert.ok(confirmTurn.replyText.includes('CONFIRMED Token #3'));
assert.ok(confirmTurn.replyText.includes(confirmTurn.booking!.trackingIdRaw!));
assert.ok(confirmTurn.characterCount <= 160);

// Step 4d: Query STATUS -> Returns CONFIRMED status, Token #3, and Tracking ID
const statusTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1003',
    msisdn: smsPhone,
    text: `STATUS ${confirmTurn.booking!.trackingIdRaw}`,
  },
  {},
  { now: refNow }
);
assert.equal(statusTurn.actionTaken, 'STATUS_RETURNED');
assert.ok(statusTurn.replyText.includes('Status CONFIRMED Token #3'));
assert.ok(statusTurn.characterCount <= 160);

// Step 4e: Cancel via SMS ("CANCEL <trackingId>") -> Releases slot
const cancelTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1004',
    msisdn: smsPhone,
    text: `CANCEL ${confirmTurn.booking!.trackingId}`,
  },
  {},
  { now: refNow }
);
assert.equal(cancelTurn.actionTaken, 'BOOKING_CANCELLED');
assert.equal(cancelTurn.booking?.status, 'CANCELLED');
assert.ok(cancelTurn.replyText.includes('is CANCELLED. Slot released.'));
assert.ok(cancelTurn.characterCount <= 160);

// Step 4f: Verify LIST, HELP, and Delivery Receipt (DLR)
const listTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1005',
    msisdn: smsPhone,
    text: 'LIST MED',
  },
  {},
  { now: refNow }
);
assert.equal(listTurn.actionTaken, 'FACILITIES_LISTED');
assert.ok(listTurn.replyText.includes('DHJ01'));
assert.ok(listTurn.characterCount <= 160);

const helpTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-1006',
    msisdn: smsPhone,
    text: 'HELP',
  },
  {},
  { now: refNow }
);
assert.equal(helpTurn.actionTaken, 'HELP_SENT');
assert.ok(helpTurn.replyText.includes('Send OPD <HOSP> <DEPT>'));
assert.ok(helpTurn.characterCount <= 160);

const dlrResult = orchestrator.handleDeliveryReceipt('simulator', {
  providerMsgId: confirmTurn.outboundSms.providerMessageId,
  dlrStatus: 'DELIVERED',
});
assert.equal(dlrResult.updated, true);
assert.equal(dlrResult.dlrStatus, 'DELIVERED');

// Step 4g: Verify 10-min Hold Expiry (HOLD_EXPIRED)
const expirePhone = '+919876543288';
const holdForExpiry = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-2001',
    msisdn: expirePhone,
    text: 'OPD DHJ01 CAR',
  },
  {},
  { now: refNow }
);
assert.equal(holdForExpiry.actionTaken, 'HOLD_CREATED');

// Confirm 11 minutes later -> HOLD_EXPIRED
const elevenMinLater = new Date(refNow.getTime() + 11 * 60 * 1000);
const expiredConfirmTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-2002',
    msisdn: expirePhone,
    text: `Y ${holdForExpiry.booking!.confirmCode}`,
  },
  {},
  { now: elevenMinLater }
);
assert.equal(expiredConfirmTurn.actionTaken, 'HOLD_EXPIRED');
assert.equal(expiredConfirmTurn.booking?.status, 'EXPIRED');
assert.ok(expiredConfirmTurn.replyText.includes('EXPIRED'));

// Step 4h: Verify SLOT_FULL_FALLBACK when requested session is full
const neuSessions = store.ensureSessionsForDate('DHJ01', 'NEU', '2026-10-12');
store
  .getDatabase()
  .prepare("UPDATE sessions SET booked_count = capacity, status = 'FULL' WHERE id = ?")
  .run(neuSessions[0].id);
store
  .getDatabase()
  .prepare("UPDATE sessions SET booked_count = capacity, status = 'FULL' WHERE id = ?")
  .run(neuSessions[1].id);

const fallbackTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-2003',
    msisdn: '+919876543277',
    text: 'OPD DHJ01 NEU 1210',
  },
  {},
  { now: refNow }
);
assert.equal(fallbackTurn.actionTaken, 'SLOT_FULL_FALLBACK');
assert.equal(fallbackTurn.booking?.slotDate, '2026-10-13');
assert.ok(fallbackTurn.replyText.includes('is full. Next slot:'));
assert.ok(fallbackTurn.characterCount <= 160);

// Step 4i: Verify Low-Confidence / Missing Entities Safety Invariant (PARSE_ERROR_HELP)
const invalidBookTurn = orchestrator.handleInboundSms(
  'simulator',
  {
    messageId: 'sim-mo-2004',
    msisdn: '+919876543266',
    text: 'OPD INVALIDHOSP INVALIDDEPT',
  },
  {},
  { now: refNow }
);
assert.equal(invalidBookTurn.actionTaken, 'PARSE_ERROR_HELP');
assert.equal(invalidBookTurn.booking, null);

store.close();
console.log('ALL A2, A3, AND A5 VERIFICATION ASSERTIONS PASSED SUCCESSFULLY!');

