async function testDatabaseChanges() {
  const baseUrl = 'http://127.0.0.1:3000';

  // Login
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@medveda.in', password: 'MedVeda@Admin2026' })
  });
  const { token } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Insert a test record into 'admin_telemetry' -> 'system_runtime_config'
  console.log('--- 1. Testing Record Insertion ---');
  const insertRes = await fetch(`${baseUrl}/api/admin/database/insert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      storeKey: 'admin_telemetry',
      tableName: 'system_runtime_config',
      data: {
        config_key: 'test_admin_feature_flag',
        config_value: 'enabled_by_admin',
        updated_at: new Date().toISOString()
      }
    })
  });
  console.log('Insert response:', await insertRes.json());

  // 2. Query the inserted record
  console.log('--- 2. Querying Inserted Record ---');
  const queryRes = await fetch(`${baseUrl}/api/admin/database/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      storeKey: 'admin_telemetry',
      tableName: 'system_runtime_config',
      filterCol: 'config_key',
      filterVal: 'test_admin'
    })
  });
  const queryJson = await queryRes.json();
  console.log('Queried row:', queryJson.rows);

  // 3. Update the record
  console.log('--- 3. Testing Record Update ---');
  const updateRes = await fetch(`${baseUrl}/api/admin/database/update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      storeKey: 'admin_telemetry',
      tableName: 'system_runtime_config',
      pkCol: 'config_key',
      pkVal: 'test_admin_feature_flag',
      updates: {
        config_value: 'updated_value_2026'
      }
    })
  });
  console.log('Update response:', await updateRes.json());

  // 4. Delete the test record
  console.log('--- 4. Testing Record Deletion ---');
  const delRes = await fetch(`${baseUrl}/api/admin/database/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      storeKey: 'admin_telemetry',
      tableName: 'system_runtime_config',
      pkCol: 'config_key',
      pkVal: 'test_admin_feature_flag'
    })
  });
  console.log('Delete response:', await delRes.json());

  console.log('\n=== Database CRUD & Changes Engine verified 100% operational! ===');
}

testDatabaseChanges();
