================================================================================
MEDVEDA - OPD BOOKING FEATURE: IMPLEMENTATION PLAN
Web/PWA + QR at hospital + SMS booking (feature-phone / low-connectivity)
Prepared for handoff to Antigravity | Date: 11 Oct 2026
================================================================================

HOW TO USE THIS FILE WITH ANTIGRAVITY
- Put this file in the repo as /docs/PLAN.md (rename .txt to .md if you like).
- Start with Agent A0 (Architect). A0 produces the shared contracts first
  (OpenAPI + JSON schemas). All other agents read /packages/contracts and this
  plan as ground truth. Do not change a contract without telling A0.
- Section 9 lists the agents, their inputs, outputs and dependencies.
- Section 4.3 lists real SMS providers and how to reach a REAL (not mock) feature.


--------------------------------------------------------------------------------
1. GOAL AND SCOPE
--------------------------------------------------------------------------------
One booking core, three channels:

 1) Web/PWA booking from home (smartphone users, optional ABHA login).
 2) QR scan at hospital: walk-in generates a token without standing in queue.
 3) SMS booking: patient texts a short command -> server parses SMS to JSON ->
    holds a slot -> asks for confirmation by SMS -> patient confirms -> final
    SMS with TRACKING ID + TOKEN NUMBER. Patient shows that SMS at the Token
    Counter.

Out of scope for v1: payments, teleconsultation, USSD/IVR (future channels),
full HMIS integration.

Design principle: channels are thin adapters. Slot allocation, token numbers,
state transitions and audit live in ONE Booking Core service, so a web booking
and an SMS booking can never conflict.


--------------------------------------------------------------------------------
2. END-TO-END FLOWS
--------------------------------------------------------------------------------
2.1 Web/PWA
  Search facility -> department -> date -> session -> confirm. Optional ABHA
  verification (ABDM sandbox first). Result screen: token number, Tracking ID,
  signed QR for the counter. A confirmation SMS is also sent (offline copy).

2.2 QR at hospital
  Each department shows a static QR = signed deep link (facility, department).
  Scan -> PWA opens prefilled -> phone number + OTP (or ABHA) -> same-day token.
  A second QR variant opens the phone's SMS app with a prefilled booking text
  (sms: URI), which doubles as SMS onboarding.

2.3 SMS
  Patient SMS
    -> Gateway (inbound MO webhook)
    -> Ingress API (verify, dedupe, store raw)
    -> Queue -> Parser -> Booking Orchestrator
    -> Slot hold (TTL 10 min) + confirm code
    -> Outbound SMS "please confirm"
    -> Patient replies "Y 4821"
    -> Orchestrator confirms, allocates token, issues Tracking ID
    -> Outbound SMS "CONFIRMED + Tracking ID + token"
    -> Patient shows SMS at Token Counter

2.4 Counter
  Staff enters Tracking ID (or scans app QR). Console shows token number,
  department, session, patient name (masked), phone last 4 digits. Staff marks
  ARRIVED and can print a slip. SMS-only patients are verified by showing the
  SMS plus the last 4 digits of their number.


--------------------------------------------------------------------------------
3. SMS PROTOCOL (USER-FACING)
--------------------------------------------------------------------------------
Short, case-insensitive, tolerant of spaces/typos, English + transliterated
Hindi keywords.

  Intent    Example SMS                          Notes
  --------  -----------------------------------  ------------------------------
  Book      OPD DHJ01 MED   |  OPD DHJ01 MED 1210   facility code, dept code,
                                                    optional DDMM date
  List      LIST  |  LIST MED                    returns nearby codes
  Confirm   Y 4821  |  Y                         4-digit confirm code; bare Y
                                                 only if exactly one pending hold
  Cancel    CANCEL MV7K4Q9X  |  N 4821
  Status    STATUS MV7K4Q9X
  Help      HELP

Outbound 1 (confirmation request):
  MedVeda: OPD Medicine, DH Jamshedpur, 12 Oct, Token ~27. Reply Y 4821 within
  10 min to confirm.

Outbound 2 (final):
  MedVeda: CONFIRMED. Token 27, Medicine, DH Jamshedpur, 12 Oct, report
  9:30-10:30 AM. Tracking ID MV7K4Q9X. Show this SMS at Token Counter.

Rules: keep GSM-7 messages near 160 chars (Unicode/Hindi = 70 chars per segment,
costs more). NEVER send diagnosis or clinical data by SMS.

Parsed JSON contract (Parser output):
  {
    "messageId": "gw-8f3a...",
    "msisdn": "+91XXXXXXXXXX",
    "receivedAt": "2026-10-11T08:12:44Z",
    "intent": "BOOK",
    "entities": { "facilityCode": "DHJ01", "deptCode": "MED",
                  "date": "2026-10-12" },
    "confidence": 0.97,
    "parseErrors": []
  }
Low confidence or missing entities NEVER create a booking; the patient gets a
short help reply.

Tracking ID: 8 chars Crockford base32 (no I, L, O, U) + 1 check char, shown as
MV-7K4Q-9X, accepted with or without hyphens. Random, not sequential. The check
char lets the counter console reject typos instantly.

Token number: allocated at confirmation from a per-(facility, department,
session, date) counter using a Postgres row lock. Walk-in/QR tokens use the same
counter so numbering stays consistent.


--------------------------------------------------------------------------------
4. SYSTEM ARCHITECTURE
--------------------------------------------------------------------------------
 [PWA / QR]   [SMS Gateway Provider]   [Counter Console]   [Admin Dashboard]
     |                 |                      |                    |
     v                 v                      v                    v
  API Gateway --- SMS Ingress API ------ Booking Core API ---------+
                       |                       |   |
                  Redis / BullMQ <-------------+   +--> PostgreSQL
                       |                              (bookings, slots,
        +--------------+--------------+                tokens, audit)
        |              |              |
     Parser      Orchestrator   Notification Service
   (intents)    (state machine) (templates, DLT, retries, DLR)


--------------------------------------------------------------------------------
5. BOOKING STATE MACHINE
--------------------------------------------------------------------------------
  RECEIVED -> PARSED -> PENDING_CONFIRMATION (TTL 10 min)
  PENDING_CONFIRMATION -> CONFIRMED  (valid "Y"+code from same msisdn)
  PENDING_CONFIRMATION -> EXPIRED    (TTL reached, slot released)
  PENDING_CONFIRMATION -> CANCELLED  (N / CANCEL)
  CONFIRMED -> ARRIVED -> COMPLETED
  CONFIRMED -> NO_SHOW | CANCELLED
  any -> REJECTED (invalid facility, dept closed, quota full, blocked number)


--------------------------------------------------------------------------------
6. DATA MODEL
--------------------------------------------------------------------------------
  facilities(id, code, name, district, geo, active)
  departments(id, facility_id, code, name)
  sessions(id, department_id, date, start, end, capacity, walkin_reserve)
  patients(id, msisdn, name, abha_number_hash, consent_at)
  bookings(id, tracking_id, patient_id, session_id, token_no,
           channel[web|qr|sms], state, hold_expires_at, confirm_code_hash,
           created_at, confirmed_at, arrived_at)
  token_counters(session_id, last_token)
  sms_inbox(id, provider_msg_id UNIQUE, msisdn, body, received_at, parsed_json,
            status)
  sms_outbox(id, booking_id, template_id, rendered, provider_msg_id, status,
             dlr_status, attempts)
  audit_events(id, actor, action, entity, entity_id, payload, at)
  staff_users(id, facility_id, role[counter|admin], ...)


--------------------------------------------------------------------------------
7. API CONTRACTS
--------------------------------------------------------------------------------
  GET  /v1/facilities
  GET  /v1/facilities/{id}/departments
  GET  /v1/sessions?dept=&date=
  POST /v1/bookings                (web/QR; phone OTP or ABHA token)
  GET  /v1/bookings/{trackingId}
  POST /v1/bookings/{id}/cancel
  POST /v1/sms/inbound/{provider}  (webhook)
  POST /v1/sms/dlr/{provider}      (delivery reports)
  POST /v1/counter/lookup          (tracking ID)
  POST /v1/counter/{id}/arrive
  GET  /v1/admin/queue?facility=&dept=
  Public QR links: /q/{signedPayload} (HMAC-signed, rotated per facility)


--------------------------------------------------------------------------------
9. MULTI-AGENT PLAN FOR ANTIGRAVITY
--------------------------------------------------------------------------------
A0  Architect / Orchestrator: contracts, OpenAPI spec, JSON schemas, ADRs
A1  Data / DB: SQLite/Prisma-compatible persistent schema, seed data, slot-hold & token-counter locking
A2  Booking Core: booking module, Crockford Base32 Tracking ID + check char generator, expiry jobs, audit events
A3  SMS Gateway & Ingress: adapter interface, Simulator, Android SMS Gateway, MSG91 adapters, inbound/DLR webhooks, idempotent inbox
A4  SMS Parser: packages/sms-parser with 100+ labelled test messages (typos, Hindi transliteration, noise), confidence scoring
A5  Notification & Orchestrator: DLT template registry, outbox worker, retry/fallback, reminder scheduler, state-machine orchestrator
A6  Web / PWA ("Book Appointments" inside Doctor Visits): Web/PWA booking from home, QR at hospital walk-in token + sms: URI QR, ABHA/OTP verification, signed QR slip
A7  Counter & Admin Console: Tracking ID lookup (with check-char validation), QR scan, ARRIVED action, slip print, live OPD queue dashboard
A8  QA & Load: E2E tests for all 3 channels, race tests (parallel booking of last slot), duplicate-SMS tests, SMS parser 100+ test suite
A9  Security & Compliance: DPDP Act 2023 compliance, HMAC QR signing, confirm-code hashing, per-msisdn rate limiting, audit log
A10 Docs & Demo: docs, runbook, architecture & verification
