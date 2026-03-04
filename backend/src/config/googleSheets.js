const { google } = require('googleapis');

/**
 * Google Sheets DB Schema:
 *
 * Sheet "users":       id | email | password_hash | role | tenant_id | name | created_at
 * Sheet "tenants":     id | name  | status | created_at | contact_email | description
 * Sheet "org_vdcs":    id | tenant_id | name | cpu_limit | ram_limit | disk_limit | cpu_used | ram_used | disk_used | created_at
 * Sheet "vms":         id | tenant_id | org_vdc_id | name | status | cpu | ram | disk | ip | os | created_at | owner_id
 * Sheet "audit_log":   id | user_id | tenant_id | action | resource_type | resource_id | details | timestamp
 */

const SHEETS = {
  USERS: 'users',
  TENANTS: 'tenants',
  ORG_VDCS: 'org_vdcs',
  VMS: 'vms',
  AUDIT_LOG: 'audit_log',
};

const SHEET_HEADERS = {
  [SHEETS.USERS]: ['id', 'email', 'password_hash', 'role', 'tenant_id', 'name', 'created_at'],
  [SHEETS.TENANTS]: ['id', 'name', 'status', 'created_at', 'contact_email', 'description'],
  [SHEETS.ORG_VDCS]: ['id', 'tenant_id', 'name', 'cpu_limit', 'ram_limit', 'disk_limit', 'cpu_used', 'ram_used', 'disk_used', 'created_at'],
  [SHEETS.VMS]: ['id', 'tenant_id', 'org_vdc_id', 'name', 'status', 'cpu', 'ram', 'disk', 'ip', 'os', 'created_at', 'owner_id'],
  [SHEETS.AUDIT_LOG]: ['id', 'user_id', 'tenant_id', 'action', 'resource_type', 'resource_id', 'details', 'timestamp'],
};

function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function getSheetsClient() {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

module.exports = { SHEETS, SHEET_HEADERS, getSheetsClient };
