import assert from 'node:assert/strict';
import {
  computeCrockfordCheckChar,
  CROCKFORD_ALPHABET,
  formatTrackingId,
  generateTrackingId,
  hashConfirmCode,
  hashMsisdn,
  maskName,
  maskPhoneLast4,
  normalizeCrockford,
  normalizeMsisdn,
  signQrPayload,
  validateTrackingId,
  verifyQrPayload,
} from '../packages/contracts/index.ts';
import { parseInboundSms } from '../packages/sms-parser/index.ts';
import {
  getTodayIstDateString,
  OpdBookingError,
  SqliteOpdBookingStore,
} from '../backend/src/infrastructure/db/sqlite-opd-booking.store.ts';
import { OpdBookingCoreUseCase } from '../backend/src/application/use-cases/opd-booking-core.use-case.ts';
import {
  checkSmsRateLimit,
  DLT_TEMPLATES,
  resetSmsRateLimiter,
  validateGsm7SingleSegment,
} from '../backend/src/infrastructure/sms/sms-gateway.adapter.ts';
import { OpdSmsOrchestrator } from '../backend/src/application/use-cases/opd-sms-orchestrator.use-case.ts';

interface TestScenario {
  name: string;
  fn: () => Promise<void> | void;
}

const scenarios: TestScenario[] = [];

function test(name: string, fn: () => Promise<void> | void): void {
  scenarios.push({ name, fn });
}

function createIsolatedHarness(): {
  store: SqliteOpdBookingStore;
  core: OpdBookingCoreUseCase;
  orchestrator: OpdSmsOrchestrator;
  today: string;
  cleanup: () => void;
} {
  resetSmsRateLimiter();
  const store = new SqliteOpdBookingStore(':memory:');
  const core = new OpdBookingCoreUseCase(store);
  const orchestrator = new OpdSmsOrchestrator(store, core);
  const today = getTodayIstDateString();
  return {
    store,
    core,
    orchestrator,
    today,
    cleanup: () => {
      resetSmsRateLimiter();
      store.close();
    },
  };
}

// ============================================================================
// SCENARIO 1: CHANNEL 1 — WEB / PWA BOOKING END-TO-END
// ============================================================================

test('1. Channel 1 — Web/PWA Booking E2E (Browse Facilities -> Depts -> Sessions -> Book -> Verify Token, Tracking ID, Signed QR & DLT SMS)', () => {
  const { store, core, today, cleanup } = createIsolatedHarness();
  try {
    // 1. Browse active facilities
    const facilities = core.listFacilities({ activeOnly: true });
    const facilityCodes = facilities.map((f) => f.code);
    for (const expectedCode of ['DHJ01', 'SBMC01', 'SDH01', 'RIMS01', 'CHC01']) {
      assert.ok(
        facilityCodes.includes(expectedCode),
        `Expected seeded facility ${expectedCode} in ${facilityCodes.join(', ')}`
      );
    }

    // 2. Browse departments for DHJ01
    const departments = core.listDepartments('DHJ01');
    const deptCodes = departments.map((d) => d.code);
    for (const expectedDept of ['MED', 'CAR', 'NEU', 'PED', 'ORT', 'GYN', 'ENT', 'OPH']) {
      assert.ok(
        deptCodes.includes(expectedDept),
        `Expected department ${expectedDept} in DHJ01`
      );
    }

    // 3. Browse sessions (MORNING & AFTERNOON) for DHJ01 MED
    const sessions = core.listSessions({
      facilityCode: 'DHJ01',
      deptCode: 'MED',
      date: today,
    });
    assert.equal(sessions.length, 2, 'Expected MORNING and AFTERNOON sessions');
    const morningSession = sessions.find((s) => s.session === 'MORNING');
    const afternoonSession = sessions.find((s) => s.session === 'AFTERNOON');
    assert.ok(morningSession, 'Expected MORNING session');
    assert.ok(afternoonSession, 'Expected AFTERNOON session');
    assert.ok(morningSession.totalCapacity > 0);
    assert.ok(morningSession.reservedSmsQuota > 0);

    // 4. Create first Web booking
    const webBooking1 = core.createWebOrQrBooking({
      facilityCode: 'DHJ01',
      deptCode: 'MED',
      date: today,
      session: 'MORNING',
      phone: '9876543210',
      patientName: 'Ramesh Kumar',
      abhaAddress: 'ramesh.kumar@abdm',
      abhaVerified: true,
      channel: 'WEB',
    });

    assert.equal(webBooking1.status, 'CONFIRMED');
    assert.equal(webBooking1.channel, 'WEB');
    assert.equal(webBooking1.tokenNumber, 1, 'First confirmed booking should receive Token #1');
    assert.match(
      webBooking1.trackingId,
      /^MV-[0-9A-HJ-KM-NP-TV-Z]{4}-[0-9A-HJ-KM-NP-TV-Z]{3}$/,
      `Tracking ID ${webBooking1.trackingId} must follow MV-XXXX-XXX Crockford Base32 format`
    );

    // Verify Crockford Base32 modulo-32 check character
    const checkValidation = validateTrackingId(webBooking1.trackingId, { strictLength: true });
    assert.equal(checkValidation.valid, true, 'Tracking ID modulo-32 check character must be valid');
    const normPayload = normalizeCrockford(webBooking1.trackingId);
    assert.equal(normPayload.length, 7);
    assert.equal(
      computeCrockfordCheckChar(normPayload.slice(0, 6)),
      normPayload[6],
      'Check character must match computeCrockfordCheckChar(body6)'
    );

    // Verify HMAC-SHA256 signed QR payload and deep link
    assert.ok(webBooking1.qrDeepLink.startsWith('/q/'));
    const qrCheck = core.verifyQrDeepLink(webBooking1.qrDeepLink);
    assert.equal(qrCheck.valid, true, 'Signed QR deep link must verify cleanly');
    assert.equal(qrCheck.expired, false);
    assert.equal(qrCheck.payload?.type, 'BOOKING');
    assert.equal(qrCheck.payload?.trackingId, webBooking1.trackingId);
    assert.equal(qrCheck.payload?.tokenNumber, 1);

    // Verify single-segment DLT confirmation SMS in sms_outbox
    const outboxMessages = store.listSmsMessages({
      msisdn: '+919876543210',
      direction: 'OUTBOUND',
    });
    assert.equal(outboxMessages.length, 1);
    const sms1 = outboxMessages[0];
    assert.equal(sms1.templateId, DLT_TEMPLATES.BOOKING_CONFIRMED.templateId);
    assert.ok(sms1.body.includes('CONFIRMED Token #1'));
    assert.ok(sms1.body.includes(webBooking1.trackingId));
    assert.ok(sms1.body.length <= 160, `Confirmation SMS length (${sms1.body.length}) must be <= 160 chars`);
    assert.equal(validateGsm7SingleSegment(sms1.body).valid, true);

    // 5. Create second Web booking on same session -> verify sequential Token #2
    const webBooking2 = core.createWebOrQrBooking({
      facilityCode: 'DHJ01',
      deptCode: 'MED',
      date: today,
      session: 'MORNING',
      phone: '9876543211',
      patientName: 'Sita Devi',
      channel: 'WEB',
    });
    assert.equal(webBooking2.tokenNumber, 2, 'Second booking on same session must receive Token #2');
    assert.notEqual(webBooking2.trackingId, webBooking1.trackingId);
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 2: CHANNEL 2 — HOSPITAL DEPARTMENT QR WALK-IN END-TO-END
// ============================================================================

test('2. Channel 2 — Hospital Department QR Walk-In E2E (Department Posters, Deep Link Verification, Tampered & Expired QR Rejection)', () => {
  const { core, today, cleanup } = createIsolatedHarness();
  try {
    // 1. Generate department posters for DHJ01
    const posterBundle = core.generateDepartmentPosters('DHJ01', today);
    assert.equal(posterBundle.facility.code, 'DHJ01');
    assert.ok(posterBundle.posters.length >= 5);

    const medPoster = posterBundle.posters.find((p) => p.deptCode === 'MED');
    assert.ok(medPoster, 'Expected MED department poster');
    assert.ok(medPoster.qrDeepLink.startsWith('/q/'));
    assert.equal(medPoster.smsCommand, 'OPD DHJ01 MED');
    assert.ok(medPoster.smsUri.startsWith('sms:'));
    assert.ok(medPoster.smsUri.includes(encodeURIComponent('OPD DHJ01 MED')));

    // 2. Verify /q/<signedPayload> deep link via verifyQrDeepLink
    const verifiedPoster = core.verifyQrDeepLink(medPoster.qrDeepLink);
    assert.equal(verifiedPoster.valid, true);
    assert.equal(verifiedPoster.expired, false);
    assert.equal(verifiedPoster.payload?.type, 'DEPT_WALKIN');
    assert.equal(verifiedPoster.payload?.facilityCode, 'DHJ01');
    assert.equal(verifiedPoster.payload?.deptCode, 'MED');
    assert.equal(verifiedPoster.facility?.code, 'DHJ01');
    assert.equal(verifiedPoster.department?.code, 'MED');

    // 3. Create QR_WALKIN booking using the poster's signed QR token
    const walkinBooking = core.createWebOrQrBooking({
      phone: '9123456780',
      patientName: 'Birsa Munda',
      qrToken: medPoster.qrToken,
      channel: 'QR_WALKIN',
    });
    assert.equal(walkinBooking.status, 'CONFIRMED');
    assert.equal(walkinBooking.channel, 'QR_WALKIN');
    assert.equal(walkinBooking.booking.facilityCode, 'DHJ01');
    assert.equal(walkinBooking.booking.deptCode, 'MED');
    assert.equal(walkinBooking.tokenNumber, 1);

    // 4. Verify tampered QR token is rejected (QR_SIGNATURE_MISMATCH / INVALID_QR_TOKEN)
    const [encodedPart, sigPart] = medPoster.qrToken.split('.');
    const flippedLastChar = sigPart.endsWith('A') ? 'B' : 'A';
    const tamperedQrToken = `${encodedPart}.${sigPart.slice(0, -1)}${flippedLastChar}`;

    const tamperedCheck = core.verifyQrDeepLink(`/q/${tamperedQrToken}`);
    assert.equal(tamperedCheck.valid, false, 'Tampered QR token must fail verification');
    assert.match(tamperedCheck.error || '', /signature/i);

    assert.throws(
      () =>
        core.createWebOrQrBooking({
          phone: '9123456781',
          qrToken: tamperedQrToken,
          channel: 'QR_WALKIN',
        }),
      (err: unknown) =>
        err instanceof OpdBookingError &&
        err.code === 'INVALID_QR_TOKEN' &&
        /signature/i.test(err.message),
      'Booking with tampered QR token must throw INVALID_QR_TOKEN (QR_SIGNATURE_MISMATCH)'
    );

    // 5. Verify expired QR token is rejected (QR_EXPIRED / INVALID_QR_TOKEN)
    const expiredQrToken = signQrPayload({
      type: 'DEPT_WALKIN',
      id: 'dept_dhj01_med',
      facilityCode: 'DHJ01',
      deptCode: 'MED',
      date: today,
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    });

    const expiredCheck = core.verifyQrDeepLink(`/q/${expiredQrToken}`);
    assert.equal(expiredCheck.valid, false, 'Expired QR token must be invalid');
    assert.equal(expiredCheck.expired, true, 'Expired QR token must flag expired: true');
    assert.match(expiredCheck.error || '', /expired/i);

    assert.throws(
      () =>
        core.createWebOrQrBooking({
          phone: '9123456782',
          qrToken: expiredQrToken,
          channel: 'QR_WALKIN',
        }),
      (err: unknown) =>
        err instanceof OpdBookingError &&
        err.code === 'INVALID_QR_TOKEN' &&
        /expired/i.test(err.message),
      'Booking with expired QR token must throw INVALID_QR_TOKEN (QR_EXPIRED)'
    );
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 3: CHANNEL 3 — 2-WAY SMS BOOKING LOOP E2E (ALL 3 GATEWAY ADAPTERS)
// ============================================================================

test('3. Channel 3 — 2-Way SMS Booking Loop E2E (Simulator, Android SMS Gateway sms:received, MSG91, Bare Y, STATUS, LIST, HELP, CANCEL)', () => {
  const { store, orchestrator, cleanup } = createIsolatedHarness();
  try {
    // --- 3A. Built-in Simulator Webhook Format: OPD DHJ01 MED -> Y <code> ---
    const holdTurnSim = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-001',
      msisdn: '+919800000001',
      text: 'OPD DHJ01 MED',
    });

    assert.equal(holdTurnSim.duplicate, false);
    assert.equal(holdTurnSim.provider, 'simulator');
    assert.equal(holdTurnSim.parsed.intent, 'BOOK');
    assert.equal(holdTurnSim.actionTaken, 'HOLD_CREATED');
    assert.ok(holdTurnSim.booking, 'Hold booking record should be created');
    assert.equal(holdTurnSim.booking.status, 'PENDING_CONFIRMATION');
    assert.equal(holdTurnSim.booking.facilityCode, 'DHJ01');
    assert.equal(holdTurnSim.booking.deptCode, 'MED');
    assert.match(holdTurnSim.booking.confirmCode || '', /^\d{4}$/, '4-digit confirmCode must be generated');
    assert.ok(holdTurnSim.booking.holdExpiresAt, '10-minute holdExpiresAt must be set');
    assert.ok(holdTurnSim.replyText.includes(`Reply Y ${holdTurnSim.booking.confirmCode}`));
    assert.ok(holdTurnSim.characterCount <= 160);
    assert.equal(holdTurnSim.segments, 1);

    const confirmCode1 = holdTurnSim.booking.confirmCode!;
    const confirmTurnSim = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-002',
      msisdn: '+919800000001',
      text: `Y ${confirmCode1}`,
    });

    assert.equal(confirmTurnSim.actionTaken, 'BOOKING_CONFIRMED');
    assert.ok(confirmTurnSim.booking);
    assert.equal(confirmTurnSim.booking.status, 'CONFIRMED');
    assert.equal(confirmTurnSim.booking.tokenNumber, 1, 'Token #1 allocated on confirmation');
    assert.ok(confirmTurnSim.replyText.includes('CONFIRMED Token #1'));
    assert.ok(confirmTurnSim.replyText.includes(confirmTurnSim.booking.trackingId));
    assert.ok(confirmTurnSim.characterCount <= 160);
    assert.equal(confirmTurnSim.segments, 1);

    // --- 3B. Android SMS Gateway (`capcom6/android-sms-gateway` `sms:received`) + Bare "Y" Confirmation ---
    const androidHoldTurn = orchestrator.handleInboundSms('android-gateway', {
      event: 'sms:received',
      payload: {
        messageId: 'and-mo-101',
        phoneNumber: '+919800000002',
        message: 'OPD DHJ01 MED',
        receivedAt: new Date().toISOString(),
      },
    });

    assert.equal(androidHoldTurn.provider, 'android-gateway');
    assert.equal(androidHoldTurn.actionTaken, 'HOLD_CREATED');
    assert.equal(androidHoldTurn.booking?.status, 'PENDING_CONFIRMATION');
    assert.match(androidHoldTurn.booking?.confirmCode || '', /^\d{4}$/);

    // Reply with bare "Y" (without 4-digit code) -> matches single active hold for +919800000002
    const androidConfirmTurn = orchestrator.handleInboundSms('android-gateway', {
      event: 'sms:received',
      payload: {
        messageId: 'and-mo-102',
        phoneNumber: '+919800000002',
        message: 'Y',
        receivedAt: new Date().toISOString(),
      },
    });

    assert.equal(androidConfirmTurn.provider, 'android-gateway');
    assert.equal(androidConfirmTurn.actionTaken, 'BOOKING_CONFIRMED');
    assert.equal(androidConfirmTurn.booking?.status, 'CONFIRMED');
    assert.equal(androidConfirmTurn.booking?.tokenNumber, 2, 'Sequential Token #2 allocated in same session');
    assert.ok(androidConfirmTurn.replyText.includes('CONFIRMED Token #2'));
    assert.ok(androidConfirmTurn.characterCount <= 160);

    // --- 3C. MSG91 Virtual Number Webhook Format (Hindi transliterated department) ---
    const msg91HoldTurn = orchestrator.handleInboundSms('msg91', {
      msgid: 'msg91-mo-201',
      sender: '919800000003',
      content: 'OPD DHJ01 DIL',
      keyword: 'OPD',
    });

    assert.equal(msg91HoldTurn.provider, 'msg91');
    assert.equal(msg91HoldTurn.actionTaken, 'HOLD_CREATED');
    assert.equal(msg91HoldTurn.booking?.deptCode, 'CAR', 'DIL should resolve to Cardiology (CAR)');

    const msg91ConfirmTurn = orchestrator.handleInboundSms('msg91', {
      msgid: 'msg91-mo-202',
      sender: '919800000003',
      content: `HAAN ${msg91HoldTurn.booking?.confirmCode}`,
    });

    assert.equal(msg91ConfirmTurn.actionTaken, 'BOOKING_CONFIRMED');
    assert.equal(msg91ConfirmTurn.booking?.status, 'CONFIRMED');
    assert.equal(msg91ConfirmTurn.booking?.tokenNumber, 1, 'First Cardiology token is #1');

    // --- 3D. STATUS <trackingId>, LIST MED, HELP, and CANCEL <trackingId> ---
    const trackedId = confirmTurnSim.booking!.trackingId;

    const statusTurn = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-003',
      msisdn: '+919800000001',
      text: `STATUS ${trackedId}`,
    });
    assert.equal(statusTurn.actionTaken, 'STATUS_RETURNED');
    assert.ok(statusTurn.replyText.includes('CONFIRMED'));
    assert.ok(statusTurn.replyText.includes('Token #1'));
    assert.ok(statusTurn.characterCount <= 160);

    const listTurn = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-004',
      msisdn: '+919800000001',
      text: 'LIST MED',
    });
    assert.equal(listTurn.actionTaken, 'FACILITIES_LISTED');
    assert.ok(listTurn.replyText.includes('DHJ01'));
    assert.ok(listTurn.replyText.includes('RIMS01'));
    assert.ok(listTurn.characterCount <= 160);

    const helpTurn = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-005',
      msisdn: '+919800000001',
      text: 'HELP',
    });
    assert.equal(helpTurn.actionTaken, 'HELP_SENT');
    assert.ok(helpTurn.replyText.includes('OPD <HOSP> <DEPT>'));
    assert.ok(helpTurn.characterCount <= 160);

    const cancelTurn = orchestrator.handleInboundSms('simulator', {
      messageId: 'sim-mo-006',
      msisdn: '+919800000001',
      text: `CANCEL ${trackedId}`,
    });
    assert.equal(cancelTurn.actionTaken, 'BOOKING_CANCELLED');
    assert.equal(cancelTurn.booking?.status, 'CANCELLED');
    assert.ok(cancelTurn.replyText.includes('CANCELLED'));
    assert.ok(cancelTurn.characterCount <= 160);

    // Verify Delivery Receipt (DLR) webhook updates sms_outbox
    const dlrResult = orchestrator.handleDeliveryReceipt('android-gateway', {
      event: 'sms:delivered',
      payload: {
        messageId: androidConfirmTurn.outboundSms.providerMessageId,
        status: 'DELIVERED',
      },
    });
    assert.equal(dlrResult.updated, true);
    assert.equal(dlrResult.dlrStatus, 'DELIVERED');

    // Verify all outbound SMS rows in sms_outbox are <= 160 chars
    const allOutbound = store.listSmsMessages({ direction: 'OUTBOUND', limit: 100 });
    assert.ok(allOutbound.length >= 9);
    for (const msg of allOutbound) {
      assert.ok(msg.body.length <= 160, `Outbound SMS exceeded 160 chars: ${msg.body}`);
    }
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 4: RACE-CONDITION, CONCURRENCY & 25% RESERVED SMS QUOTA EQUITY
// ============================================================================

test('4. Race-Condition & Concurrency Test (Last Remaining Slot Contention + 25% Reserved SMS/Walk-in Quota Enforcement)', async () => {
  const { store, core, orchestrator, today, cleanup } = createIsolatedHarness();
  try {
    // Ensure sessions exist for DHJ01 ORT today
    const sessions = store.ensureSessionsForDate('DHJ01', 'ORT', today);
    const morningSession = sessions.find((s) => s.session === 'MORNING')!;

    // Configure session to capacity = 4, walkin_reserve (reservedSmsQuota) = 1
    // This means webCeiling = 4 - 1 = 3 slots for WEB; 1 slot reserved for SMS / QR_WALKIN
    store
      .getDatabase()
      .prepare('UPDATE sessions SET capacity = 4, walkin_reserve = 1, booked_count = 0, held_count = 0, status = ? WHERE id = ?')
      .run('OPEN', morningSession.id);

    // 1. Book 3 WEB appointments (fills the Web ceiling: 4 - 1 = 3)
    for (let i = 1; i <= 3; i++) {
      const res = core.createWebOrQrBooking({
        sessionId: morningSession.id,
        phone: `970000000${i}`,
        patientName: `Web Patient ${i}`,
        channel: 'WEB',
      });
      assert.equal(res.status, 'CONFIRMED');
      assert.equal(res.tokenNumber, i);
    }

    // 2. A 4th WEB booking must be blocked by the 25% reserved SMS/walk-in quota!
    assert.throws(
      () =>
        core.createWebOrQrBooking({
          sessionId: morningSession.id,
          phone: '9700000004',
          patientName: 'Blocked Web Patient',
          channel: 'WEB',
        }),
      (err: unknown) =>
        err instanceof OpdBookingError && err.code === 'WEB_QUOTA_FULL',
      '4th WEB booking must be rejected with WEB_QUOTA_FULL when only reserved SMS/walk-in quota remains'
    );

    // 3. Now fire parallel contenders for the LAST remaining slot (Slot #4 of 4)
    //    across SMS and QR_WALKIN channels (plus a WEB contender with allowReservedQuota=true)
    const contenders = [
      Promise.resolve().then(() =>
        core.createWebOrQrBooking({
          sessionId: morningSession.id,
          phone: '9700000011',
          patientName: 'Contender QR Walk-In',
          channel: 'QR_WALKIN',
        })
      ),
      Promise.resolve().then(() =>
        orchestrator.handleInboundSms('simulator', {
          messageId: 'race-sms-1',
          msisdn: '+919700000012',
          text: 'OPD DHJ01 ORT MORNING',
        })
      ),
      Promise.resolve().then(() =>
        core.createWebOrQrBooking({
          sessionId: morningSession.id,
          phone: '9700000013',
          patientName: 'Contender Counter',
          channel: 'COUNTER',
        })
      ),
    ];

    const outcomes = await Promise.allSettled(contenders);

    // Verify how many succeeded in claiming the 4th and final slot
    const finalSession = store.getSessionById(morningSession.id)!;
    assert.equal(
      finalSession.bookedCount + finalSession.heldCount,
      4,
      'Total occupied slots (booked + held) must never exceed session capacity (4)'
    );
    assert.equal(finalSession.availableCount, 0);
    assert.equal(finalSession.status, 'FULL');

    // Verify token_counters never double-allocates the same token_no
    const confirmedRows = store
      .getDatabase()
      .prepare(
        `SELECT token_no FROM bookings WHERE session_id = ? AND status = 'CONFIRMED' ORDER BY token_no ASC`
      )
      .all(morningSession.id) as Array<{ token_no: number }>;

    const tokens = confirmedRows.map((r) => r.token_no);
    const uniqueTokens = new Set(tokens);
    assert.equal(
      tokens.length,
      uniqueTokens.size,
      `Duplicate token numbers detected: ${tokens.join(', ')}`
    );
    assert.deepEqual(
      tokens,
      [1, 2, 3, 4],
      'Sequential tokens 1..4 must be allocated with zero gaps or duplicates'
    );

    // Ensure that at least one contender succeeded and the other contenders were cleanly rejected or fell back to AFTERNOON
    const fulfilledCount = outcomes.filter((o) => o.status === 'fulfilled').length;
    const rejectedCount = outcomes.filter((o) => o.status === 'rejected').length;
    assert.ok(fulfilledCount >= 1);
    assert.ok(
      rejectedCount >= 1,
      'Competing direct session contenders for the last slot must receive a clean SESSION_FULL rejection'
    );
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 5: IDEMPOTENCY & DUPLICATE WEBHOOK DELIVERY
// ============================================================================

test('5. Idempotency & Duplicate Webhook Delivery (Replayed provider_msg_id creates no duplicate booking or outbound SMS)', () => {
  const { store, orchestrator, cleanup } = createIsolatedHarness();
  try {
    const webhookPayload = {
      event: 'sms:received',
      payload: {
        messageId: 'gw-idempotent-msg-999',
        phoneNumber: '+919600000001',
        message: 'OPD DHJ01 MED',
        receivedAt: '2026-10-11T09:00:00.000Z',
      },
    };

    // First delivery
    const firstTurn = orchestrator.handleInboundSms('android-gateway', webhookPayload);
    assert.equal(firstTurn.duplicate, false);
    assert.equal(firstTurn.deduplicated, false);
    assert.equal(firstTurn.actionTaken, 'HOLD_CREATED');
    assert.ok(firstTurn.booking);

    const bookingsAfterFirst = store.listBookingsByPhone('+919600000001');
    const outboxAfterFirst = store.listSmsMessages({
      msisdn: '+919600000001',
      direction: 'OUTBOUND',
    });
    const inboxAfterFirst = store.listSmsMessages({
      msisdn: '+919600000001',
      direction: 'INBOUND',
    });
    assert.equal(bookingsAfterFirst.length, 1);
    assert.equal(outboxAfterFirst.length, 1);
    assert.equal(inboxAfterFirst.length, 1);

    // Second delivery (exact same provider_msg_id replayed by gateway)
    const secondTurn = orchestrator.handleInboundSms('android-gateway', webhookPayload);
    assert.equal(secondTurn.duplicate, true, 'Replayed webhook must return duplicate: true');
    assert.equal(secondTurn.deduplicated, true, 'Replayed webhook must return deduplicated: true');
    assert.equal(secondTurn.booking?.id, firstTurn.booking.id);

    // Also test database-level idempotency with a fresh orchestrator instance sharing the same store
    const freshOrchestrator = new OpdSmsOrchestrator(store);
    const thirdTurn = freshOrchestrator.handleInboundSms('android-gateway', webhookPayload);
    assert.equal(thirdTurn.duplicate, true, 'DB-backed sms_inbox deduplication must also flag duplicate: true');

    const bookingsAfterReplay = store.listBookingsByPhone('+919600000001');
    const outboxAfterReplay = store.listSmsMessages({
      msisdn: '+919600000001',
      direction: 'OUTBOUND',
    });
    const inboxAfterReplay = store.listSmsMessages({
      msisdn: '+919600000001',
      direction: 'INBOUND',
    });

    assert.equal(bookingsAfterReplay.length, 1, 'No second hold/booking may be created on replay');
    assert.equal(outboxAfterReplay.length, 1, 'No second outbound SMS may be queued on replay');
    assert.equal(inboxAfterReplay.length, 1, 'sms_inbox UNIQUE(provider_msg_id) must prevent duplicate rows');
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 6: EXPIRED HOLD CONFIRMATION & AUTOMATIC SLOT RELEASE
// ============================================================================

test('6. Expired Hold Confirmation & Automatic Slot Release (10-min TTL expiry releases capacity for next patient)', () => {
  const { store, orchestrator, today, cleanup } = createIsolatedHarness();
  try {
    // Set DHJ01 NEU MORNING capacity to 1 so we can verify capacity lock & release
    const sessions = store.ensureSessionsForDate('DHJ01', 'NEU', today);
    const morning = sessions.find((s) => s.session === 'MORNING')!;
    store
      .getDatabase()
      .prepare('UPDATE sessions SET capacity = 1, walkin_reserve = 1, booked_count = 0, held_count = 0, status = ? WHERE id = ?')
      .run('OPEN', morning.id);

    const t0 = new Date(`${today}T03:00:00.000Z`);

    // 1. Patient A creates a 10-minute SMS hold at t0
    const holdTurn = orchestrator.handleInboundSms(
      'simulator',
      {
        messageId: 'exp-mo-1',
        msisdn: '+919500000001',
        text: 'OPD DHJ01 NEU MORNING',
      },
      undefined,
      { now: t0 }
    );

    assert.equal(holdTurn.actionTaken, 'HOLD_CREATED');
    const holdId = holdTurn.booking!.id;
    const confirmCode = holdTurn.booking!.confirmCode!;

    const sessionWhileHeld = store.getSessionById(morning.id)!;
    assert.equal(sessionWhileHeld.heldCount, 1, 'Slot must be held while TTL is active');
    assert.equal(sessionWhileHeld.availableCount, 0, 'Remaining capacity is 0 while held');

    // 2. Advance simulated clock by 11 minutes (past 10-min TTL) and attempt `Y <confirmCode>`
    const tPlus11Min = new Date(t0.getTime() + 11 * 60 * 1000);
    const lateConfirmTurn = orchestrator.handleInboundSms(
      'simulator',
      {
        messageId: 'exp-mo-2',
        msisdn: '+919500000001',
        text: `Y ${confirmCode}`,
      },
      undefined,
      { now: tPlus11Min }
    );

    assert.equal(lateConfirmTurn.actionTaken, 'HOLD_EXPIRED');
    assert.equal(lateConfirmTurn.booking?.status, 'EXPIRED');
    assert.ok(
      lateConfirmTurn.replyText.includes('EXPIRED'),
      `Expected hold-expired reply instructions, got: ${lateConfirmTurn.replyText}`
    );
    assert.ok(
      lateConfirmTurn.replyText.includes('Send OPD DHJ01 NEU to re-book'),
      'Expired reply must instruct patient how to re-book'
    );

    // 3. Verify capacity was automatically released back to the session pool
    const sessionAfterExpiry = store.getSessionById(morning.id)!;
    assert.equal(sessionAfterExpiry.heldCount, 0, 'Expired hold must release heldCount to 0');
    assert.equal(sessionAfterExpiry.bookedCount, 0);
    assert.equal(sessionAfterExpiry.availableCount, 1, 'Slot capacity must be available for next patient');
    assert.equal(sessionAfterExpiry.status, 'OPEN');

    // 4. Verify Patient B can now book and confirm that released slot
    const nextHoldTurn = orchestrator.handleInboundSms(
      'simulator',
      {
        messageId: 'exp-mo-3',
        msisdn: '+919500000002',
        text: 'OPD DHJ01 NEU MORNING',
      },
      undefined,
      { now: tPlus11Min }
    );
    assert.equal(nextHoldTurn.actionTaken, 'HOLD_CREATED');
    assert.equal(nextHoldTurn.booking?.sessionId, morning.id, 'Next patient must get the released MORNING slot');

    const nextConfirmTurn = orchestrator.handleInboundSms(
      'simulator',
      {
        messageId: 'exp-mo-4',
        msisdn: '+919500000002',
        text: `Y ${nextHoldTurn.booking!.confirmCode}`,
      },
      undefined,
      { now: new Date(tPlus11Min.getTime() + 60 * 1000) }
    );
    assert.equal(nextConfirmTurn.actionTaken, 'BOOKING_CONFIRMED');
    assert.equal(nextConfirmTurn.booking?.tokenNumber, 1);

    // Verify HOLD_EXPIRED audit event was recorded
    const expiredAudits = store.listAuditEvents({
      entityType: 'BOOKING',
      entityId: holdId,
    });
    assert.ok(
      expiredAudits.some((e) => e.action === 'HOLD_EXPIRED'),
      'Audit trail must record HOLD_EXPIRED event'
    );
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 7: COUNTER LOOKUP, CROCKFORD CHECK-CHAR TYPO REJECTION & LIVE QUEUE
// ============================================================================

test('7. Counter Lookup, Crockford Base32 Check-Char Typo Rejection & Live Queue (Hyphenated, Unhyphenated, 7-Char, Typo Catch & Mark Arrived)', () => {
  const { core, today, cleanup } = createIsolatedHarness();
  try {
    // Create a confirmed booking
    const created = core.createWebOrQrBooking({
      facilityCode: 'DHJ01',
      deptCode: 'CAR',
      date: today,
      session: 'MORNING',
      phone: '9431009988',
      patientName: 'Anjali Sharma',
      channel: 'WEB',
    });

    const formattedId = created.trackingId; // e.g. MV-XXXX-XXX
    const unhyphenatedId = created.trackingIdRaw; // e.g. MVXXXXXXX
    const short7CharId = normalizeCrockford(formattedId); // e.g. XXXXXXX

    // 1. Lookup with hyphenated MV-XXXX-XXX
    const lookup1 = core.counterLookup({ trackingId: formattedId });
    assert.equal(lookup1.validCheckChar, true);
    assert.equal(lookup1.checksumValid, true);
    assert.equal(lookup1.found, true);
    assert.equal(lookup1.booking?.id, created.booking.id);
    assert.equal(lookup1.booking?.phoneLast4, '9988');

    // 2. Lookup with unhyphenated MVXXXXXXX
    const lookup2 = core.counterLookup({ trackingId: unhyphenatedId });
    assert.equal(lookup2.validCheckChar, true);
    assert.equal(lookup2.found, true);
    assert.equal(lookup2.booking?.id, created.booking.id);

    // 3. Lookup with 7-char XXXXXXX (without MV prefix) + visual ambiguity lowercase/O/I/l tolerance
    const lookup3 = core.counterLookup({ trackingId: short7CharId.toLowerCase() });
    assert.equal(lookup3.validCheckChar, true);
    assert.equal(lookup3.found, true);
    assert.equal(lookup3.booking?.id, created.booking.id);

    // 4. Corrupt 1 character in the tracking ID -> assert counterLookup immediately flags validCheckChar: false!
    const origChar = short7CharId[2];
    const replacementChar =
      CROCKFORD_ALPHABET[(CROCKFORD_ALPHABET.indexOf(origChar) + 1) % 32];
    const corrupted7 =
      short7CharId.slice(0, 2) + replacementChar + short7CharId.slice(3);
    const corruptedFormatted = formatTrackingId(corrupted7);

    const typoLookup = core.counterLookup({ trackingId: corruptedFormatted });
    assert.equal(
      typoLookup.validCheckChar,
      false,
      'Single-character typo in Tracking ID must fail modulo-32 check-char validation'
    );
    assert.equal(typoLookup.checksumValid, false);
    assert.equal(typoLookup.found, false);
    assert.match(typoLookup.reason || '', /Check character mismatch/i);

    // 5. Mark booking ARRIVED at counter & verify OPD slip generation
    const arrivedRes = core.markArrived(formattedId, 'counter-dhj01', '9988');
    assert.equal(arrivedRes.found, true);
    assert.equal(arrivedRes.validCheckChar, true);
    assert.equal(arrivedRes.booking?.status, 'ARRIVED');
    assert.ok(arrivedRes.booking?.arrivedAt);
    assert.ok(arrivedRes.slip, 'Printable OPD slip must be returned on markArrived');
    assert.equal(arrivedRes.slip.tokenNumber, 1);
    assert.equal(arrivedRes.slip.trackingId, formattedId);
    assert.equal(arrivedRes.slip.facilityCode, 'DHJ01');
    assert.equal(arrivedRes.slip.deptCode, 'CAR');
    assert.equal(arrivedRes.slip.phoneLast4, '9988');
    assert.equal(arrivedRes.slip.maskedPatientName, 'A****i S****a');

    // 6. Add another confirmed booking and check getAdminQueue live counts
    core.createWebOrQrBooking({
      facilityCode: 'DHJ01',
      deptCode: 'CAR',
      date: today,
      session: 'MORNING',
      phone: '9431007766',
      patientName: 'Vikram Singh',
      channel: 'QR_WALKIN',
    });

    const queueSnap = core.getAdminQueue({
      facilityCode: 'DHJ01',
      deptCode: 'CAR',
      date: today,
    });
    assert.equal(queueSnap.facilityCode, 'DHJ01');
    assert.equal(queueSnap.deptCode, 'CAR');
    assert.equal(queueSnap.summary.arrivedCount, 1, 'Admin queue must show 1 ARRIVED patient');
    assert.equal(queueSnap.summary.confirmedCount, 1, 'Admin queue must show 1 CONFIRMED waiting patient');
    assert.equal(queueSnap.summary.lastIssuedToken, 2);
    assert.equal(queueSnap.summary.currentServingToken, 1);
    assert.equal(queueSnap.summary.byChannel.WEB, 1);
    assert.equal(queueSnap.summary.byChannel.QR_WALKIN, 1);
  } finally {
    cleanup();
  }
});

// ============================================================================
// SCENARIO 8: SECURITY, DPDP ACT 2023 & TRAI DLT COMPLIANCE INVARIANTS
// ============================================================================

test('8. Security & DPDP Invariants (SHA-256 Phone & Confirm-Code Hashing, PII Masking, Zero Clinical Data in SMS, <=160 Chars, Webhook Signature & Rate Limiting)', () => {
  const { store, core, orchestrator, today, cleanup } = createIsolatedHarness();
  try {
    // 1. Create booking & inspect raw SQLite patients and bookings tables for SHA-256 hashing
    const bookingRes = core.createSlotHold({
      facilityCode: 'DHJ01',
      deptCode: 'MED',
      date: today,
      session: 'MORNING',
      phone: '9876501234',
      patientName: 'Priya Verma',
      channel: 'SMS',
    });

    const rawPatientRow = store
      .getDatabase()
      .prepare('SELECT msisdn, msisdn_hash, phone_last4, name FROM patients WHERE msisdn = ?')
      .get('+919876501234') as {
      msisdn: string;
      msisdn_hash: string;
      phone_last4: string;
      name: string;
    };

    assert.ok(rawPatientRow);
    assert.equal(rawPatientRow.msisdn_hash, hashMsisdn('+919876501234'));
    assert.match(
      rawPatientRow.msisdn_hash,
      /^[a-f0-9]{64}$/,
      'patients.msisdn_hash must be a 64-hex-char SHA-256 digest'
    );
    assert.equal(rawPatientRow.phone_last4, '1234');

    const rawBookingRow = store
      .getDatabase()
      .prepare('SELECT confirm_code, confirm_code_hash FROM bookings WHERE id = ?')
      .get(bookingRes.booking.id) as {
      confirm_code: string;
      confirm_code_hash: string;
    };
    assert.equal(
      rawBookingRow.confirm_code_hash,
      hashConfirmCode(rawBookingRow.confirm_code),
      'bookings.confirm_code_hash must store SHA-256 hash of confirm_code'
    );

    // 2. Verify maskName and maskPhoneLast4 mask PII on counter & admin queue responses
    assert.equal(maskName('Priya Verma'), 'P***a V***a');
    assert.equal(maskPhoneLast4('+919876501234'), '1234');
    const lookup = core.counterLookup({ trackingId: bookingRes.trackingId });
    assert.equal(lookup.slip?.maskedPatientName, 'P***a V***a');
    assert.equal(lookup.slip?.phoneLast4, '1234');

    // 3. Verify invalid webhook signatures (x-webhook-signature: invalid) are rejected with 401
    assert.throws(
      () =>
        orchestrator.handleInboundSms(
          'msg91',
          {
            msgid: 'forged-msg-001',
            sender: '919876501234',
            content: 'OPD DHJ01 MED',
          },
          { 'x-webhook-signature': 'invalid' }
        ),
      (err: unknown) =>
        err instanceof OpdBookingError &&
        err.code === 'INVALID_WEBHOOK_SIGNATURE' &&
        err.statusCode === 401,
      'Webhook with x-webhook-signature: invalid must be rejected with 401 INVALID_WEBHOOK_SIGNATURE'
    );

    // Verify HMAC webhook secret enforcement when webhookSecret is configured
    assert.throws(
      () =>
        orchestrator.handleInboundSms(
          'android-gateway',
          {
            event: 'sms:received',
            payload: {
              messageId: 'unauth-msg-002',
              phoneNumber: '+919876501234',
              message: 'OPD DHJ01 MED',
            },
          },
          { 'x-webhook-signature': 'wrong-hmac-digest' },
          { webhookSecret: 'prod-webhook-secret-2026' }
        ),
      (err: unknown) =>
        err instanceof OpdBookingError &&
        err.code === 'INVALID_WEBHOOK_SIGNATURE',
      'Mismatched HMAC signature must be rejected when webhookSecret is configured'
    );

    // 4. Verify Per-MSISDN Rate Limiter (10 SMS / 15 minutes allowed, 11th rejected with 429)
    const spamPhone = '+919999888877';
    resetSmsRateLimiter(spamPhone);
    const fixedNow = new Date('2026-10-11T10:00:00.000Z');

    for (let i = 1; i <= 10; i++) {
      const turn = orchestrator.handleInboundSms(
        'simulator',
        {
          messageId: `rate-msg-${i}`,
          msisdn: spamPhone,
          text: 'HELP',
        },
        undefined,
        { now: new Date(fixedNow.getTime() + i * 1000) }
      );
      assert.equal(turn.actionTaken, 'HELP_SENT');
    }

    assert.throws(
      () =>
        orchestrator.handleInboundSms(
          'simulator',
          {
            messageId: 'rate-msg-11',
            msisdn: spamPhone,
            text: 'HELP',
          },
          undefined,
          { now: new Date(fixedNow.getTime() + 11 * 1000) }
        ),
      (err: unknown) =>
        err instanceof OpdBookingError &&
        err.code === 'SMS_RATE_LIMIT_EXCEEDED' &&
        err.statusCode === 429,
      '11th SMS within 15 minutes from same MSISDN must throw 429 SMS_RATE_LIMIT_EXCEEDED'
    );

    // 5. Low-confidence / ambiguous SMS never creates a booking
    const ambiguousParsed = parseInboundSms({
      messageId: 'ambig-01',
      msisdn: '+919876509999',
      text: 'I have severe chest pain and diabetes fever please prescribe medicine',
    });
    assert.notEqual(
      ambiguousParsed.intent,
      'BOOK',
      'Free-text clinical symptoms without facility/booking command must never produce a valid BOOK intent'
    );

    // 6. Inspect every DLT template and every sms_outbox row:
    //    - Must be <= 160 characters (single GSM-7 segment)
    //    - Must contain ZERO clinical/diagnosis/symptom terms
    const forbiddenClinicalRegex =
      /\b(diagnosis|disease|symptom|hiv|tb|tuberculosis|cancer|diabetes|hypertension|pregnant|pregnancy|fever|prescription|rx|blood\s*pressure|infection)\b/i;

    const allOutbox = store.listSmsMessages({ direction: 'OUTBOUND', limit: 200 });
    assert.ok(allOutbox.length > 0);
    for (const msg of allOutbox) {
      const gsmCheck = validateGsm7SingleSegment(msg.body);
      assert.equal(
        gsmCheck.valid,
        true,
        `sms_outbox message (${msg.id}) failed GSM-7 single-segment check: ${gsmCheck.reason}`
      );
      assert.ok(msg.body.length <= 160);
      assert.equal(
        forbiddenClinicalRegex.test(msg.body),
        false,
        `DPDP violation: sms_outbox message contains clinical terms: ${msg.body}`
      );
    }
  } finally {
    cleanup();
  }
});

// ============================================================================
// RUNNER
// ============================================================================

async function runSuite(): Promise<void> {
  console.log('================================================================================');
  console.log('MEDVEDA OPD BOOKING — A8 E2E, CONCURRENCY & SECURITY TEST SUITE');
  console.log('================================================================================');

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    const startMs = performance.now();
    try {
      await scenario.fn();
      const elapsedMs = (performance.now() - startMs).toFixed(1);
      console.log(`  [PASS] ${scenario.name} (${elapsedMs} ms)`);
      passed++;
    } catch (err) {
      const elapsedMs = (performance.now() - startMs).toFixed(1);
      console.error(`  [FAIL] ${scenario.name} (${elapsedMs} ms)`);
      console.error(err);
      failed++;
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Scenarios: ${scenarios.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runSuite();
