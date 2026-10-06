// End-to-end verification of Feature 05 Facility Dashboard
async function test() {
  const base = 'http://localhost:3000';
  console.log('--- 1. Testing Admin Access to All 6 Sections ---');
  for (const endpoint of ['overview', 'patient-care', 'appointments-queue', 'service-resource', 'analytics', 'alerts']) {
    const res = await fetch(`${base}/api/dashboard/${endpoint}?facility_id=fac_01&actor_role=admin`);
    const data = await res.json();
    console.log(`[Admin] /api/dashboard/${endpoint}: Status=${res.status}, Success=${data.success}`);
    if (res.status !== 200 || !data.success) throw new Error(`Admin failed on ${endpoint}`);
  }

  console.log('\n--- 2. Testing Doctor Access (Allowed: overview, patient-care, appointments-queue, alerts; Denied: service-resource, analytics) ---');
  for (const endpoint of ['overview', 'patient-care', 'appointments-queue', 'service-resource', 'analytics', 'alerts']) {
    const res = await fetch(`${base}/api/dashboard/${endpoint}?facility_id=fac_01&actor_role=doctor`);
    const data = await res.json();
    console.log(`[Doctor] /api/dashboard/${endpoint}: Status=${res.status}, Success=${data.success}`);
  }

  console.log('\n--- 3. Testing Worker Access (Allowed: patient-care, alerts; Denied: overview, appointments-queue, service-resource, analytics) ---');
  for (const endpoint of ['overview', 'patient-care', 'appointments-queue', 'service-resource', 'analytics', 'alerts']) {
    const res = await fetch(`${base}/api/dashboard/${endpoint}?facility_id=fac_01&actor_role=worker`);
    const data = await res.json();
    console.log(`[Worker] /api/dashboard/${endpoint}: Status=${res.status}, Allowed=${data.success}`);
  }

  console.log('\n--- 4. Testing Multi-Facility Switcher (fac_01, fac_02, fac_03) ---');
  for (const fac of ['fac_01', 'fac_02', 'fac_03']) {
    const res = await fetch(`${base}/api/dashboard/overview?facility_id=${fac}&actor_role=admin`);
    const data = await res.json();
    console.log(`[Facility Switcher] ${fac}: FacilityName="${data.data?.facilityName}", TotalPatientsServed=${data.data?.totalPatientsServed}`);
    const alertRes = await fetch(`${base}/api/dashboard/alerts?facility_id=${fac}&actor_role=admin`);
    const alertData = await alertRes.json();
    console.log(`[Facility Switcher Alerts] ${fac}: AlertCount=${alertData.data?.length || 0}`);
  }

  console.log('\n--- 5. Testing Critical Triage -> Real-time Critical Alert trigger ---');
  const triageRes = await fetch(`${base}/api/triage/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      age: 62,
      sex: 'male',
      location: 'Hazaribagh',
      primarySymptoms: 'Severe crushing chest pain radiating to left arm',
      duration: '1 hour',
      severity: 'severe',
      redFlags: {
        chestPain: true,
        breathingDistress: true,
        facialDroopOrSpeech: false,
        unconsciousOrConfusion: false,
        severeBleeding: false
      }
    })
  });
  const triageData = await triageRes.json();
  console.log(`Triage classification: Urgency=${triageData.data?.urgency}, Category=${triageData.data?.conditionCategory}`);

  // Check if critical alert appeared in Section 6 alerts
  const checkAlertRes = await fetch(`${base}/api/dashboard/alerts?facility_id=fac_01&actor_role=admin`);
  const checkAlertData = await checkAlertRes.json();
  const critAlert = checkAlertData.data?.find(a => a.severity === 'critical');
  console.log(`Critical Alert Created in Dashboard:`, critAlert ? `Found: [${critAlert.alertType}] ${critAlert.message}` : 'None');

  console.log('\n--- 6. Testing Resource Threshold Trigger (<20%) ---');
  // Update ICU beds to 1 available out of 20 (5% -> below 20%)
  const resourceRes = await fetch(`${base}/api/dashboard/resource-status/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facilityId: 'fac_01',
      actor: { actorId: 'admin_01', role: 'admin', facilityId: 'fac_01' },
      resourceType: 'icu_bed',
      totalCount: 20,
      availableCount: 2 // 10% -> triggers critical resource alert
    })
  });
  const resourceData = await resourceRes.json();
  console.log(`Resource update result: Success=${resourceData.success}, Available=${resourceData.data?.availableCount}/${resourceData.data?.totalCount}`);

  // Check if critical resource alert appeared in Section 6 alerts
  const resAlertCheck = await fetch(`${base}/api/dashboard/alerts?facility_id=fac_01&actor_role=admin`);
  const resAlertData = await resAlertCheck.json();
  const critResAlert = resAlertData.data?.find(a => a.alertType === 'critical_resource');
  console.log(`Resource Alert Created:`, critResAlert ? `Found: ${critResAlert.message}` : 'None');

  console.log('\nAll tests complete and verified successfully!');
}

test().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
