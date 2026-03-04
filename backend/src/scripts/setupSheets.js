/**
 * One-time setup script:
 * 1. Accepts an existing Google Spreadsheet ID (passed as argument or prompted)
 * 2. Creates all required sheets/tabs with proper column headers
 * 3. Applies formatting (bold headers, colors, frozen row)
 * 4. Writes backend/.env file with all credentials
 *
 * Usage:
 *   node src/scripts/setupSheets.js <SPREADSHEET_ID>
 *
 * Example:
 *   node src/scripts/setupSheets.js 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
 */

const path = require('path');
const fs   = require('fs');
const { google } = require('googleapis');

// ─── Load credentials from JSON key file ──────────────────────────────────────
const KEY_FILE = path.join(__dirname, '../../../gen-lang-client-0658363012-0762bb13e480.json');
const credentials = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));

const ENV_PATH = path.join(__dirname, '../../.env');

// ─── Sheet definitions (name → column headers) ───────────────────────────────
const SHEETS_SCHEMA = {
  users:     ['id', 'email', 'password_hash', 'role', 'tenant_id', 'name', 'created_at'],
  tenants:   ['id', 'name', 'status', 'created_at', 'contact_email', 'description'],
  org_vdcs:  ['id', 'tenant_id', 'name', 'cpu_limit', 'ram_limit', 'disk_limit', 'cpu_used', 'ram_used', 'disk_used', 'created_at'],
  vms:       ['id', 'tenant_id', 'org_vdc_id', 'name', 'status', 'cpu', 'ram', 'disk', 'ip', 'os', 'created_at', 'owner_id'],
  audit_log: ['id', 'user_id', 'tenant_id', 'action', 'resource_type', 'resource_id', 'details', 'timestamp'],
};

const SHEET_COLORS = {
  users:     { red: 0.17, green: 0.24, blue: 0.31 },
  tenants:   { red: 0.11, green: 0.30, blue: 0.24 },
  org_vdcs:  { red: 0.25, green: 0.16, blue: 0.36 },
  vms:       { red: 0.10, green: 0.30, blue: 0.20 },
  audit_log: { red: 0.33, green: 0.20, blue: 0.13 },
};

async function main() {
  // ── Get Spreadsheet ID ───────────────────────────────────────────────────
  const spreadsheetId = process.argv[2];

  if (!spreadsheetId) {
    console.error('❌ Usage: node src/scripts/setupSheets.js <SPREADSHEET_ID>');
    console.error('');
    console.error('📋 How to get the Spreadsheet ID:');
    console.error('   1. Open Google Sheets: https://sheets.google.com');
    console.error('   2. Create a new blank spreadsheet');
    console.error('   3. Share it with: ' + credentials.client_email);
    console.error('      (Give "Editor" access)');
    console.error('   4. Copy the ID from the URL:');
    console.error('      https://docs.google.com/spreadsheets/d/  <<<ID>>>  /edit');
    console.error('   5. Run: node src/scripts/setupSheets.js <ID>');
    process.exit(1);
  }

  console.log('🔐 Authenticating with Google...');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key:  credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ── Verify access to spreadsheet ─────────────────────────────────────────
  console.log(`📊 Connecting to spreadsheet: ${spreadsheetId}...`);
  let spreadsheet;
  try {
    spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    console.log(`   ✓ Connected: "${spreadsheet.data.properties.title}"`);
  } catch (err) {
    if (err.code === 403 || err.code === 404) {
      console.error('\n❌ Cannot access spreadsheet!');
      console.error('');
      console.error('💡 Make sure you shared the spreadsheet with:');
      console.error('   ' + credentials.client_email);
      console.error('   (Share → Editor access)');
    } else {
      console.error('❌ Error:', err.message);
    }
    process.exit(1);
  }

  const existingSheets = spreadsheet.data.sheets.map((s) => ({
    id:    s.properties.sheetId,
    title: s.properties.title,
  }));

  const existingNames = existingSheets.map((s) => s.title);
  const sheetNames    = Object.keys(SHEETS_SCHEMA);

  // ── 1. Create missing sheets ──────────────────────────────────────────────
  const sheetsToCreate = sheetNames.filter((n) => !existingNames.includes(n));

  if (sheetsToCreate.length > 0) {
    console.log(`\n📋 Creating ${sheetsToCreate.length} sheet(s)...`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetsToCreate.map((name) => ({
          addSheet: {
            properties: {
              title: name,
              gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 },
            },
          },
        })),
      },
    });

    sheetsToCreate.forEach((n) => console.log(`   ✓ Created sheet: ${n}`));
  } else {
    console.log('\n✓ All sheets already exist');
  }

  // Re-fetch to get updated sheet IDs
  const updated = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIdMap = {};
  updated.data.sheets.forEach((s) => {
    sheetIdMap[s.properties.title] = s.properties.sheetId;
  });

  // ── 2. Freeze header row on existing sheets ───────────────────────────────
  const freezeRequests = sheetNames
    .filter((n) => existingNames.includes(n)) // already existed
    .map((name) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheetIdMap[name],
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    }));

  if (freezeRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: freezeRequests },
    });
  }

  // ── 3. Write headers ──────────────────────────────────────────────────────
  console.log('\n📝 Writing column headers...');

  for (const sheetName of sheetNames) {
    const headers = SHEETS_SCHEMA[sheetName];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            `${sheetName}!A1:Z1`,
      valueInputOption: 'RAW',
      requestBody:      { values: [headers] },
    });
    console.log(`   ✓ ${sheetName.padEnd(12)} → ${headers.join(' | ')}`);
  }

  // ── 4. Format headers ─────────────────────────────────────────────────────
  console.log('\n🎨 Applying formatting...');

  const formatRequests = [];

  for (const sheetName of sheetNames) {
    const sheetId = sheetIdMap[sheetName];
    const headers = SHEETS_SCHEMA[sheetName];
    const bgColor = SHEET_COLORS[sheetName];

    // Bold + colored background + white text
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0, endRowIndex: 1,
          startColumnIndex: 0, endColumnIndex: headers.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: bgColor,
            textFormat: {
              bold: true,
              foregroundColor: { red: 1, green: 1, blue: 1 },
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment:   'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // Auto-resize all columns
    formatRequests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: headers.length },
      },
    });

    // Set header row height = 30px
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 30 },
        fields: 'pixelSize',
      },
    });

    // Set min width for 'id' column (wide enough for UUID)
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 300 },
        fields: 'pixelSize',
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests },
  });

  console.log('   ✓ Formatting applied to all sheets');

  // ── 5. Write .env file ────────────────────────────────────────────────────
  console.log('\n⚙️  Writing .env file...');

  const privateKey = credentials.private_key.replace(/\n/g, '\\n');
  const envContent = [
    '# Google Sheets API',
    `GOOGLE_SHEETS_ID=${spreadsheetId}`,
    `GOOGLE_SERVICE_ACCOUNT_EMAIL=${credentials.client_email}`,
    `GOOGLE_PRIVATE_KEY="${privateKey}"`,
    '',
    '# JWT',
    `JWT_SECRET=mts_iaas_${Date.now()}_secret`,
    'JWT_EXPIRES_IN=24h',
    '',
    '# Server',
    'PORT=3001',
    'NODE_ENV=development',
    '',
    '# Frontend URL (for CORS)',
    'FRONTEND_URL=http://localhost:5173',
    '',
  ].join('\n');

  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
  console.log(`   ✓ .env written to: ${ENV_PATH}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  console.log('\n' + '═'.repeat(62));
  console.log('🎉 Setup complete!');
  console.log('═'.repeat(62));
  console.log(`\n📊 Spreadsheet: ${url}`);
  console.log('\n📋 Sheets with headers:');
  Object.entries(SHEETS_SCHEMA).forEach(([name, cols]) => {
    console.log(`   • ${name.padEnd(12)} — ${cols.length} columns`);
  });
  console.log('\n⏭️  Next step — seed demo data:');
  console.log('   node src/scripts/seed.js\n');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
