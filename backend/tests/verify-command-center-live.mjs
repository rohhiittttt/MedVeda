/**
 * Live HTTP Verification Script for Feature 09: District Admin Command Center (MV-DAC)
 * Executes live REST API calls against http://localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, url, options = {}) {
  try {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok || json.success === false) {
      console.error(`❌ [FAIL] ${name} (Status: ${res.status})`, json);
      return false;
    }
    console.log(`✅ [PASS] ${name} (Status: ${res.status})`);
    return json;
  } catch (err) {
    console.error(`❌ [ERROR] ${name}:`, err.message);
    return false;
  }
}

async function runLiveVerification() {
  console.log('--- STARTING LIVE API VERIFICATION FOR FEATURE 09 (MV-DAC) ---');
  let passes = 0;
  let total = 0;

  async function check(name, url, options) {
    total++;
    const res = await testEndpoint(name, url, options);
    if (res) passes++;
    return res;
  }

  // 1. States Master
  const states = await check('1. Pan-India States Master (36 States/UTs)', `${BASE_URL}/api/command-center/geography/states`);
  if (states && states.count === 36) {
    console.log(`   └─ Confirmed exactly 36 states and UTs available.`);
  }

  // 2. Districts of Maharashtra
  const mhDistricts = await check('2. Districts by State (Maharashtra)', `${BASE_URL}/api/command-center/geography/districts?state_id=maharashtra`);
  if (mhDistricts) {
    console.log(`   └─ Found ${mhDistricts.count} districts in Maharashtra.`);
  }

  // 3. Fuzzy search for Pune
  const puneSearch = await check('3. Fuzzy Search District (query="pune")', `${BASE_URL}/api/command-center/geography/districts?query=pune`);
  if (puneSearch && puneSearch.data.length > 0) {
    console.log(`   └─ Successfully located: ${puneSearch.data[0].name} (${puneSearch.data[0].id})`);
  }

  // 4. S1 Overview for Hazaribagh
  const overview = await check('4. S1 Overview KPIs (Hazaribagh)', `${BASE_URL}/api/command-center/overview?district_id=dist_jhk_hazaribagh`);
  if (overview) {
    console.log(`   └─ Beds: ${overview.data.totalBeds} (${overview.data.availableBedsPercent}% free), ICU: ${overview.data.totalIcuBeds} (${overview.data.availableIcuPercent}% free), Alerts: ${overview.data.openAlerts}`);
  }

  // 5. S2 Facilities Registry
  const facilities = await check('5. S2 Facilities List', `${BASE_URL}/api/command-center/facilities?district_id=dist_jhk_hazaribagh`);
  if (facilities) {
    console.log(`   └─ ${facilities.count} facilities registered in district.`);
  }

  // 6. S2 Facility Detail (fac_01)
  await check('6. S2 Facility Detail (District Sadar Hospital)', `${BASE_URL}/api/command-center/facility/fac_01`);

  // 7. S3 Reporting SLA Matrix
  await check('7. S3 Reporting Compliance Matrix', `${BASE_URL}/api/command-center/reports/matrix?district_id=dist_jhk_hazaribagh&days=7`);

  // 8. S3 Send Urgent Reminder
  await check('8. S3 Trigger SLA Reminder', `${BASE_URL}/api/command-center/reports/remind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facilityId: 'fac_05', actor: 'dho_admin_test' })
  });

  // 9. S4 Threshold Rules
  await check('9. S4 Active Threshold Rules', `${BASE_URL}/api/command-center/rules?district_id=dist_jhk_hazaribagh`);

  // 10. S4 Apply Seasonal Preset
  await check('10. S4 Apply Seasonal Preset (monsoon_fevers)', `${BASE_URL}/api/command-center/rules/preset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ districtId: 'dist_jhk_hazaribagh', preset: 'monsoon_fevers', actor: 'dho_admin_test' })
  });

  // 11. S5 Active Alerts Stream
  const alerts = await check('11. S5 Alerts Stream', `${BASE_URL}/api/command-center/alerts?district_id=dist_jhk_hazaribagh`);
  if (alerts) {
    console.log(`   └─ Found ${alerts.count} alerts active.`);
  }

  // 12. S5 Acknowledge Alert
  await check('12. S5 Acknowledge Alert (CALT-001)', `${BASE_URL}/api/command-center/alerts/CALT-001/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ districtId: 'dist_jhk_hazaribagh', status: 'acknowledged', actor: 'dho_admin_test' })
  });

  // 13. S5 Shortage Forecasts
  const forecasts = await check('13. S5 Shortage Forecasts (7-14d)', `${BASE_URL}/api/command-center/forecasts?district_id=dist_jhk_hazaribagh`);
  if (forecasts && forecasts.data.length > 0) {
    console.log(`   └─ Tracked item: ${forecasts.data[0].resourceName}, Days until stockout: ${forecasts.data[0].daysUntilStockout}`);
  }

  // 14. S6 Outbreak Watch (EARS/CUSUM + Gemini AI brief)
  const outbreak = await check('14. S6 Outbreak Watch & Gemini AI Brief', `${BASE_URL}/api/command-center/outbreak/watch?district_id=dist_jhk_hazaribagh&cluster=acute_fever_rash&days=14`);
  if (outbreak) {
    console.log(`   └─ Z-Score: ${outbreak.data.zScore}, Severity: ${outbreak.data.overallSeverity}`);
    console.log(`   └─ Brief: "${outbreak.data.situationalBrief?.slice(0, 90)}..."`);
  }

  // 15. S7 Transfer Recommendations Recommender
  const recs = await check('15. S7 Surplus Transfer Recommender', `${BASE_URL}/api/command-center/transfers/recommend?facility_id=fac_01&resource_id=oxygen_cylinders&quantity=15`);
  if (recs && recs.data.recommendations.length > 0) {
    const top = recs.data.recommendations[0];
    console.log(`   └─ Top donor: ${top.fromFacilityName} (${top.distanceKm} km, ~${top.estimatedTravelMinutes} mins transit, surplus: ${top.surplusAvailable})`);
  }

  // 16. S7 Create Transfer Request
  const createdReq = await check('16. S7 Create Transfer Request', `${BASE_URL}/api/command-center/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      districtId: 'dist_jhk_hazaribagh',
      type: 'transfer',
      fromFacilityId: 'fac_03',
      fromFacilityName: 'Sheikh Bhikhari Medical College',
      toFacilityId: 'fac_01',
      toFacilityName: 'District Sadar Hospital',
      resourceId: 'oxygen_cylinders',
      resourceName: 'Oxygen Cylinders (B-type)',
      quantityRequested: 15,
      urgency: 'emergency',
      createdBy: 'dho_admin_test'
    })
  });

  // 17. S7 Approve Transfer Request
  if (createdReq && createdReq.data) {
    await check('17. S7 Approve Transfer Request', `${BASE_URL}/api/command-center/requests/${createdReq.data.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', actor: 'dho_admin_test', notes: 'Emergency transfer dispatch approved.' })
    });
  }

  // 18. Dynamic Pan-India Provisioning (Pune, Maharashtra)
  const puneOverview = await check('18. Dynamic Pan-India Generation (Pune, Maharashtra)', `${BASE_URL}/api/command-center/overview?district_id=dist_mh_pune`);
  if (puneOverview) {
    console.log(`   └─ Generated facilities: ${puneOverview.data.totalFacilities}, Total Beds: ${puneOverview.data.totalBeds}`);
  }

  // 19. S8 Audit Trail
  const audit = await check('19. S8 Immutable Audit Trail', `${BASE_URL}/api/command-center/audit?district_id=dist_jhk_hazaribagh`);
  if (audit) {
    console.log(`   └─ ${audit.count} audit records logged.`);
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passes}/${total} ENDPOINTS PASSED SUCCESSFULLY!`);
  console.log(`========================================`);

  if (passes === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runLiveVerification();
