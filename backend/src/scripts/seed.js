/**
 * Seed script: creates initial admin user and demo data
 * Run: node src/scripts/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initializeSheets } = require('../services/sheetsService');
const db = require('../services/sheetsService');
const { SHEETS } = require('../config/googleSheets');

async function seed() {
  console.log('🌱 Seeding database...');

  await initializeSheets();

  // ─── Admin user ───────────────────────────────────────────────────────────
  const existing = await db.findOne(SHEETS.USERS, (u) => u.email === 'admin@mts.ru');
  if (!existing) {
    const adminUser = {
      id: uuidv4(),
      email: 'admin@mts.ru',
      password_hash: await bcrypt.hash('admin123', 10),
      role: 'admin',
      tenant_id: '',
      name: 'Administrator',
      created_at: new Date().toISOString(),
    };
    await db.insert(SHEETS.USERS, adminUser);
    console.log('✅ Admin user created: admin@mts.ru / admin123');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ─── Demo tenants ─────────────────────────────────────────────────────────
  const tenantA_existing = await db.findOne(SHEETS.TENANTS, (t) => t.name === 'Tenant Alpha');
  let tenantAId;

  if (!tenantA_existing) {
    tenantAId = uuidv4();
    await db.insert(SHEETS.TENANTS, {
      id: tenantAId,
      name: 'Tenant Alpha',
      status: 'active',
      created_at: new Date().toISOString(),
      contact_email: 'alpha@example.com',
      description: 'Первый демо-тенант',
    });
    console.log('✅ Tenant Alpha created');
  } else {
    tenantAId = tenantA_existing.id;
    console.log('ℹ️  Tenant Alpha already exists');
  }

  // ─── Client user for Tenant A ─────────────────────────────────────────────
  const clientExisting = await db.findOne(SHEETS.USERS, (u) => u.email === 'client@alpha.ru');
  if (!clientExisting) {
    await db.insert(SHEETS.USERS, {
      id: uuidv4(),
      email: 'client@alpha.ru',
      password_hash: await bcrypt.hash('client123', 10),
      role: 'client',
      tenant_id: tenantAId,
      name: 'Client Alpha',
      created_at: new Date().toISOString(),
    });
    console.log('✅ Client user created: client@alpha.ru / client123');
  } else {
    console.log('ℹ️  Client user already exists');
  }

  // ─── Org VDC for Tenant A ─────────────────────────────────────────────────
  const vdcExisting = await db.findOne(SHEETS.ORG_VDCS, (v) => v.tenant_id === tenantAId);
  let vdcId;
  if (!vdcExisting) {
    vdcId = uuidv4();
    await db.insert(SHEETS.ORG_VDCS, {
      id: vdcId,
      tenant_id: tenantAId,
      name: 'Alpha-VDC-01',
      cpu_limit: '32',
      ram_limit: '64',
      disk_limit: '1000',
      cpu_used: '0',
      ram_used: '0',
      disk_used: '0',
      created_at: new Date().toISOString(),
    });
    console.log('✅ Org VDC created: Alpha-VDC-01');
  } else {
    vdcId = vdcExisting.id;
    console.log('ℹ️  Org VDC already exists');
  }

  // ─── Demo VM ──────────────────────────────────────────────────────────────
  const vmExisting = await db.findOne(SHEETS.VMS, (v) => v.tenant_id === tenantAId);
  if (!vmExisting && vdcId) {
    await db.insert(SHEETS.VMS, {
      id: uuidv4(),
      tenant_id: tenantAId,
      org_vdc_id: vdcId,
      name: 'web-server-01',
      status: 'running',
      cpu: '4',
      ram: '8',
      disk: '100',
      ip: '10.10.1.10',
      os: 'Ubuntu 22.04',
      created_at: new Date().toISOString(),
      owner_id: '',
    });
    // Update VDC used resources
    await db.updateById(SHEETS.ORG_VDCS, vdcId, {
      cpu_used: '4',
      ram_used: '8',
      disk_used: '100',
    });
    console.log('✅ Demo VM created: web-server-01');
  } else {
    console.log('ℹ️  Demo VM already exists');
  }

  console.log('\n🎉 Seed complete!');
  console.log('   Admin:  admin@mts.ru    / admin123');
  console.log('   Client: client@alpha.ru / client123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
