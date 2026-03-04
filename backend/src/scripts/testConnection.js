/**
 * Test script to verify Google Sheets connection and data reading
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { SHEETS } = require('../config/googleSheets');
const db = require('../services/sheetsService');

async function test() {
  console.log('🔍 Testing Google Sheets connection...\n');

  try {
    // Test 1: Read all users
    console.log('📖 Reading users from Google Sheets...');
    const users = await db.getAll(SHEETS.USERS);
    console.log(`   ✓ Found ${users.length} user(s)\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found! Run seed script:');
      console.log('   node src/scripts/seed.js\n');
      return;
    }

    // Test 2: Show all users
    console.log('👥 Users in database:');
    users.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email} (${u.role}) - ${u.name || 'no name'}`);
      if (u.password_hash) {
        console.log(`      Password hash: ${u.password_hash.substring(0, 20)}...`);
      } else {
        console.log(`      ⚠️  No password hash!`);
      }
    });

    // Test 3: Try to find specific user
    console.log('\n🔎 Testing login query...');
    const testEmail = 'client@alpha.ru';
    const user = await db.findOne(SHEETS.USERS, (u) => u.email === testEmail);
    
    if (user) {
      console.log(`   ✓ Found user: ${user.email}`);
      console.log(`      Role: ${user.role}`);
      console.log(`      Name: ${user.name || 'N/A'}`);
      console.log(`      Password hash exists: ${!!user.password_hash}`);
      console.log(`      Hash length: ${user.password_hash?.length || 0}`);
    } else {
      console.log(`   ❌ User "${testEmail}" not found!`);
    }

    // Test 4: Check admin user
    console.log('\n🔎 Checking admin user...');
    const admin = await db.findOne(SHEETS.USERS, (u) => u.email === 'admin@mts.ru');
    if (admin) {
      console.log(`   ✓ Admin found: ${admin.email}`);
      console.log(`      Password hash exists: ${!!admin.password_hash}`);
    } else {
      console.log(`   ❌ Admin not found!`);
    }

    console.log('\n✅ Connection test complete!');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\nStack:', err.stack);
    
    if (err.message.includes('PERMISSION_DENIED') || err.message.includes('403')) {
      console.error('\n💡 Tip: Make sure the spreadsheet is shared with:');
      console.error('   ' + process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    }
    
    if (err.message.includes('Unable to parse range')) {
      console.error('\n💡 Tip: Make sure all sheets exist and have headers.');
      console.error('   Run: node src/scripts/setupSheets.js <SPREADSHEET_ID>');
    }
  }
}

test();
