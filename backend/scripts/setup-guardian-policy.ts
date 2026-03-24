/**
 * setup-guardian-policy.ts
 *
 * Creates the AquaVera Water Stewardship MRV policy in the Guardian portal
 * via the Guardian REST API. This mirrors the policy previously stored on HFS.
 *
 * Prerequisites:
 *   - Guardian docker containers running (docker compose -f docker-compose-quickstart.yml up -d)
 *   - Standard Registry account created in Guardian UI
 *
 * Run: npx ts-node scripts/setup-guardian-policy.ts
 */

// Use 127.0.0.1 — Docker binds to IPv4 only on Windows, localhost may resolve to IPv6
const GUARDIAN_API = 'http://127.0.0.1:3000/api/v1';
const SR_USERNAME = 'StandardRegistry';
const SR_PASSWORD = 'test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function guardianFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const url = `${GUARDIAN_API}${path}`;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Guardian API ${opts.method || 'GET'} ${path} → ${res.status}: ${body.substring(0, 500)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function login(): Promise<string> {
  console.log('1. Logging in as StandardRegistry...');
  const loginRes = await guardianFetch('/accounts/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SR_USERNAME, password: SR_PASSWORD }),
  });

  const tokenRes = await guardianFetch('/accounts/access-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: loginRes.refreshToken }),
  });
  console.log('   ✓ Authenticated\n');
  return tokenRes.accessToken;
}

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}


// ── Schema Builder ───────────────────────────────────────────────────────────

interface FieldDef {
  name: string;
  title: string;
  description: string;
  fieldType: 'string' | 'number' | 'boolean' | 'integer';
  required: boolean;
  order: number;
}

function buildSchemaDocument(schemaName: string, description: string, fields: FieldDef[]) {
  const properties: Record<string, any> = {
    '@context': {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      readOnly: true,
    },
    type: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      readOnly: true,
    },
    id: { type: 'string', readOnly: true },
    policyId: {
      title: 'policyId',
      description: 'policyId',
      readOnly: true,
      type: 'string',
      '$comment': `{"term":"policyId","@id":"https://www.schema.org/text"}`,
    },
    ref: {
      title: 'ref',
      description: 'ref',
      readOnly: true,
      type: 'string',
      '$comment': `{"term":"ref","@id":"https://www.schema.org/text"}`,
    },
  };

  const required = ['@context', 'type'];

  for (const field of fields) {
    properties[field.name] = {
      title: field.title,
      description: field.description,
      readOnly: false,
      type: field.fieldType,
      '$comment': JSON.stringify({
        term: field.name,
        '@id': `https://www.schema.org/${field.fieldType === 'number' ? 'Number' : field.fieldType === 'boolean' ? 'Boolean' : 'text'}`,
        orderPosition: field.order,
      }),
    };
    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    '$id': `#${schemaName}`,
    '$comment': JSON.stringify({ '@id': `#${schemaName}`, term: schemaName }),
    title: schemaName,
    description,
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function buildSchemaPayload(
  schemaName: string,
  description: string,
  entity: string,
  fields: FieldDef[],
  topicId: string
) {
  return {
    name: schemaName,
    description,
    entity,
    topicId,
    document: buildSchemaDocument(schemaName, description, fields),
    fields: fields.map((f) => ({
      name: f.name,
      title: f.title,
      description: f.description,
      type: f.fieldType,
      required: f.required,
    })),
  };
}


// ── Schema Definitions ───────────────────────────────────────────────────────

function getSensorDataFields(): FieldDef[] {
  return [
    { name: 'flow_rate_liters_per_min', title: 'Flow Rate (L/min)', description: 'Water flow rate in liters per minute', fieldType: 'number', required: true, order: 0 },
    { name: 'total_volume_liters', title: 'Total Volume (L)', description: 'Total water volume in liters', fieldType: 'number', required: true, order: 1 },
    { name: 'water_quality_ph', title: 'Water Quality pH', description: 'pH level (5.0-9.5)', fieldType: 'number', required: true, order: 2 },
    { name: 'water_quality_tds', title: 'Total Dissolved Solids', description: 'TDS in ppm (max 2000)', fieldType: 'number', required: true, order: 3 },
    { name: 'water_quality_turbidity', title: 'Turbidity (NTU)', description: 'Turbidity in NTU (max 10.0)', fieldType: 'number', required: true, order: 4 },
    { name: 'reservoir_level_percent', title: 'Reservoir Level (%)', description: 'Reservoir fill level percentage', fieldType: 'number', required: true, order: 5 },
    { name: 'gps_latitude', title: 'GPS Latitude', description: 'Sensor GPS latitude', fieldType: 'number', required: false, order: 6 },
    { name: 'gps_longitude', title: 'GPS Longitude', description: 'Sensor GPS longitude', fieldType: 'number', required: false, order: 7 },
    { name: 'reading_timestamp', title: 'Reading Timestamp', description: 'ISO 8601 timestamp', fieldType: 'string', required: true, order: 8 },
    { name: 'data_hash', title: 'Data Hash', description: 'SHA-256 hash for integrity verification', fieldType: 'string', required: true, order: 9 },
  ];
}

function getMRVReportFields(): FieldDef[] {
  return [
    { name: 'project_id', title: 'Project ID', description: 'Unique project identifier', fieldType: 'string', required: true, order: 0 },
    { name: 'project_name', title: 'Project Name', description: 'Water stewardship project name', fieldType: 'string', required: true, order: 1 },
    { name: 'project_type', title: 'Project Type', description: 'conservation|restoration|recycling|access|efficiency', fieldType: 'string', required: true, order: 2 },
    { name: 'period_start', title: 'Period Start', description: 'Verification period start date', fieldType: 'string', required: true, order: 3 },
    { name: 'period_end', title: 'Period End', description: 'Verification period end date', fieldType: 'string', required: true, order: 4 },
    { name: 'total_readings', title: 'Total Readings', description: 'Expected sensor readings count', fieldType: 'integer', required: true, order: 5 },
    { name: 'verified_readings', title: 'Verified Readings', description: 'Readings passing hash check', fieldType: 'integer', required: true, order: 6 },
    { name: 'data_completeness_pct', title: 'Data Completeness (%)', description: 'Min 80% required', fieldType: 'number', required: true, order: 7 },
    { name: 'anomaly_rate_pct', title: 'Anomaly Rate (%)', description: 'Max 5% allowed', fieldType: 'number', required: true, order: 8 },
    { name: 'hash_mismatches', title: 'Hash Mismatches', description: 'Integrity failure count', fieldType: 'integer', required: true, order: 9 },
    { name: 'net_water_impact_liters', title: 'Net Water Impact (L)', description: 'Impact above baseline', fieldType: 'number', required: true, order: 10 },
    { name: 'baseline_daily_liters', title: 'Baseline Daily (L)', description: 'Daily baseline usage', fieldType: 'number', required: true, order: 11 },
    { name: 'base_credits', title: 'Base Credits', description: 'impact / 1000', fieldType: 'number', required: true, order: 12 },
    { name: 'quality_tier', title: 'Quality Tier', description: 'tier_1|tier_2|tier_3', fieldType: 'string', required: true, order: 13 },
    { name: 'quality_multiplier', title: 'Quality Multiplier', description: '1.0|1.2|1.5', fieldType: 'number', required: true, order: 14 },
    { name: 'water_stress_zone', title: 'Water Stress Zone', description: 'low|medium|high|extreme', fieldType: 'string', required: true, order: 15 },
    { name: 'stress_multiplier', title: 'Stress Multiplier', description: '1.0|1.3|1.5|2.0', fieldType: 'number', required: true, order: 16 },
    { name: 'final_wsc_minted', title: 'Final WSC Minted', description: 'WSC tokens to mint', fieldType: 'number', required: true, order: 17 },
    { name: 'verification_passed', title: 'Verification Passed', description: 'All checks passed', fieldType: 'boolean', required: true, order: 18 },
    { name: 'verification_reason', title: 'Verification Reason', description: 'Pass/fail reason', fieldType: 'string', required: true, order: 19 },
  ];
}


// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   AquaVera Guardian Policy Setup                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const token = await login();

  // Step 2: Find or create policy
  console.log('2. Checking for existing AquaVera MRV policy...');
  const policyTag = 'AquaVera_WSC_MRV';

  const existingPolicies = await guardianFetch('/policies', { headers: authHeaders(token) });
  const policyList = Array.isArray(existingPolicies) ? existingPolicies : (existingPolicies?.body || []);
  let policy = policyList.find((p: any) => p.policyTag === policyTag);

  if (policy) {
    console.log(`   ✓ Found existing policy: ${policy.id || policy._id}\n`);
  } else {
    console.log('   Creating new policy...');
    const createRes = await guardianFetch('/policies', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: 'AquaVera Water Stewardship MRV',
        description:
          'Measurement, Reporting, and Verification policy for water stewardship credits on the AquaVera platform. ' +
          'Validates sensor data integrity, anomaly rates, data completeness, and calculates WSC token minting amounts. ' +
          'Aligned with AWS International Water Stewardship Standard, GRI 303, UN SDG 6, and CDP Water Security.',
        policyTag,
        topicDescription: 'AquaVera MRV Policy Topic',
        policyRoles: ['Operator', 'Verifier'],
      }),
    });
    if (Array.isArray(createRes)) {
      policy = createRes.find((p: any) => p.policyTag === policyTag) || createRes[createRes.length - 1];
    } else {
      policy = createRes;
    }
    console.log(`   ✓ Policy created: ${policy.id || policy._id}\n`);
  }

  const policyId = policy.id || policy._id;
  const topicId = policy.topicId;
  console.log(`   Policy ID:  ${policyId}`);
  console.log(`   Topic ID:   ${topicId}`);
  console.log(`   Status:     ${policy.status}\n`);

  // Step 3: Create Sensor Data schema
  console.log('3. Creating AquaVera_SensorData schema...');
  const sensorPayload = buildSchemaPayload(
    'AquaVera_SensorData',
    'IoT sensor reading data for water stewardship MRV — flow rate, volume, pH, TDS, turbidity, reservoir level, GPS, timestamp, and data hash.',
    'VC',
    getSensorDataFields(),
    topicId
  );
  await guardianFetch(`/schemas/${topicId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(sensorPayload),
  });
  console.log('   ✓ Sensor Data schema created (10 fields)\n');

  // Step 4: Create MRV Report schema
  console.log('4. Creating AquaVera_MRVReport schema...');
  const mrvPayload = buildSchemaPayload(
    'AquaVera_MRVReport',
    'MRV verification report for water stewardship credit calculation — project details, verification metrics, credit calculation, and pass/fail status.',
    'VC',
    getMRVReportFields(),
    topicId
  );
  await guardianFetch(`/schemas/${topicId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(mrvPayload),
  });
  console.log('   ✓ MRV Report schema created (20 fields)\n');

  // Step 5: Publish schemas
  console.log('5. Publishing schemas...');
  const allSchemas = await guardianFetch(`/schemas/${topicId}`, { headers: authHeaders(token) });
  const schemaList = Array.isArray(allSchemas) ? allSchemas : (allSchemas?.body || []);

  for (const schema of schemaList) {
    const schemaId = schema.id || schema._id;
    const name = schema.name;
    if (name === 'AquaVera_SensorData' || name === 'AquaVera_MRVReport') {
      if (schema.status !== 'PUBLISHED') {
        try {
          await guardianFetch(`/schemas/${schemaId}/publish`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({ version: '1.0.0' }),
          });
          console.log(`   ✓ Published: ${name}`);
        } catch (err: any) {
          console.log(`   ⚠ Could not publish ${name}: ${err.message}`);
        }
      } else {
        console.log(`   ✓ Already published: ${name}`);
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SETUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Policy ID:    ${policyId}`);
  console.log(`  Policy Name:  ${policy.name}`);
  console.log(`  Policy Tag:   ${policyTag}`);
  console.log(`  Topic ID:     ${topicId}`);
  console.log(`  Status:       ${policy.status}`);
  console.log('');
  console.log('  Schemas:');
  console.log('    • AquaVera_SensorData  — 10 fields (sensor readings)');
  console.log('    • AquaVera_MRVReport   — 20 fields (verification report)');
  console.log('');
  console.log('  Open Guardian UI → http://localhost:3000');
  console.log('  Go to Manage Policies → AquaVera Water Stewardship MRV');
  console.log('  The policy and schemas are ready for workflow configuration.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n✗ Setup failed:', err.message || err);
  process.exit(1);
});
