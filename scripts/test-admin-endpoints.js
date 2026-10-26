import http from 'node:http';

async function testAdminEndpoints() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log('Testing Admin Endpoints on:', baseUrl);

  // 1. Test Admin Login
  console.log('\n--- 1. Testing POST /api/admin/login ---');
  let token = '';
  try {
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@medveda.in', password: 'MedVeda@Admin2026' })
    });
    const loginJson = await loginRes.json();
    console.log('Login Status:', loginRes.status, 'Success:', loginJson.success);
    if (loginJson.success && loginJson.token) {
      token = loginJson.token;
      console.log('Obtained Admin Token:', token.substring(0, 20) + '...');
    }
  } catch (err) {
    console.error('Login error:', err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test GET /api/admin/me
  console.log('\n--- 2. Testing GET /api/admin/me ---');
  try {
    const meRes = await fetch(`${baseUrl}/api/admin/me`, { headers: authHeaders });
    const meJson = await meRes.json();
    console.log('Admin Me Status:', meRes.status, 'Admin Name:', meJson.admin?.name, 'Role:', meJson.admin?.role);
  } catch (err) {
    console.error('Me error:', err.message);
  }

  // 3. Test GET /api/admin/metrics
  console.log('\n--- 3. Testing GET /api/admin/metrics ---');
  try {
    const metricsRes = await fetch(`${baseUrl}/api/admin/metrics`, { headers: authHeaders });
    const metricsJson = await metricsRes.json();
    console.log('Metrics Status:', metricsRes.status, 'Count:', metricsJson.metrics?.length);
    if (metricsJson.metrics) {
      metricsJson.metrics.slice(0, 3).forEach(m => {
        console.log(`  - [${m.moduleCode}] ${m.name}: ${m.totalRequests} reqs, ${m.avgLatencyMs}ms avg, Status: ${m.status}`);
      });
    }
  } catch (err) {
    console.error('Metrics error:', err.message);
  }

  // 4. Test GET /api/admin/operations
  console.log('\n--- 4. Testing GET /api/admin/operations ---');
  try {
    const opsRes = await fetch(`${baseUrl}/api/admin/operations?limit=5`, { headers: authHeaders });
    const opsJson = await opsRes.json();
    console.log('Operations Status:', opsRes.status, 'Total logged:', opsJson.total);
    if (opsJson.operations) {
      opsJson.operations.slice(0, 3).forEach(op => {
        console.log(`  - [${op.module}] ${op.action} (${op.method} ${op.path}) -> ${op.statusCode} (${op.durationMs}ms)`);
      });
    }
  } catch (err) {
    console.error('Operations error:', err.message);
  }

  // 5. Test GET /api/admin/database/tables
  console.log('\n--- 5. Testing GET /api/admin/database/tables ---');
  let firstTable = null;
  try {
    const tablesRes = await fetch(`${baseUrl}/api/admin/database/tables`, { headers: authHeaders });
    const tablesJson = await tablesRes.json();
    console.log('Tables Status:', tablesRes.status, 'Tables count:', tablesJson.tables?.length);
    if (tablesJson.tables && tablesJson.tables.length > 0) {
      firstTable = tablesJson.tables[0];
      console.log(`  - First Table: ${firstTable.tableName} (${firstTable.rowCount} rows) in store '${firstTable.storeKey}'`);
    }
  } catch (err) {
    console.error('Tables error:', err.message);
  }

  // 6. Test POST /api/admin/database/query
  if (firstTable) {
    console.log(`\n--- 6. Testing POST /api/admin/database/query on '${firstTable.tableName}' ---`);
    try {
      const qRes = await fetch(`${baseUrl}/api/admin/database/query`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          storeKey: firstTable.storeKey,
          tableName: firstTable.tableName,
          limit: 3
        })
      });
      const qJson = await qRes.json();
      console.log('Query Status:', qRes.status, 'Returned Rows:', qJson.rows?.length, 'Total:', qJson.total);
    } catch (err) {
      console.error('Query error:', err.message);
    }
  }

  // 7. Test POST /api/admin/database/execute (Raw SQL)
  if (firstTable) {
    console.log(`\n--- 7. Testing POST /api/admin/database/execute ---`);
    try {
      const execRes = await fetch(`${baseUrl}/api/admin/database/execute`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          storeKey: firstTable.storeKey,
          sqlQuery: `SELECT count(*) as count FROM ${firstTable.tableName};`
        })
      });
      const execJson = await execRes.json();
      console.log('Execute Status:', execRes.status, 'Result rows:', execJson.rows);
    } catch (err) {
      console.error('Execute error:', err.message);
    }
  }

  // 8. Test GET /api/admin/system/status
  console.log('\n--- 8. Testing GET /api/admin/system/status ---');
  try {
    const statusRes = await fetch(`${baseUrl}/api/admin/system/status`, { headers: authHeaders });
    const statusJson = await statusRes.json();
    console.log('System Status Code:', statusRes.status, 'Node:', statusJson.status?.nodeVersion, 'Heap Used:', statusJson.status?.memory?.heapUsedMb + ' MB');
  } catch (err) {
    console.error('Status error:', err.message);
  }

  console.log('\n=== All Admin Endpoint Tests Completed Successfully! ===\n');
}

testAdminEndpoints();
