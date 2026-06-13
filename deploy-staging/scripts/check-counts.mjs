import { openDb } from './src/database.js';

const db = await openDb();
const tables = ['companies', 'ctv_accounts', 'campaigns', 'candidates', 'lead_submissions', 'lead_claims', 'lead_status_history', 'platform_fees', 'ctv_payouts', 'wallet_transactions', 'audit_logs', 'phone_locks'];

console.log('📊 Database Counts:');
console.log('===================');
for (const t of tables) {
  try {
    const c = await db.get(`SELECT COUNT(*) as n FROM ${t}`);
    console.log(`${t}: ${c.n}`);
  } catch (e) {
    console.log(`${t}: ERROR - ${e.message}`);
  }
}
await db.close();
