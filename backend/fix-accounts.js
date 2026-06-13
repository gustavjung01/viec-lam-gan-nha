import { openDb } from './src/database.js';

async function fix() {
  const db = await openDb();
  
  console.log('Checking for pending accounts...');
  
  // Update all pending/rejected companies to active
  const companies = await db.all('SELECT id, name, status FROM companies');
  console.log('Current companies:', companies);
  
  const companyResult = await db.run("UPDATE companies SET status = 'active' WHERE status IN ('pending', 'rejected', 'approved')");
  console.log(`Updated ${companyResult.changes} companies to active`);

  // Update all pending/rejected CTV to active
  const ctv = await db.all('SELECT id, name, status FROM ctv_accounts');
  console.log('Current CTVs:', ctv);
  
  const ctvResult = await db.run("UPDATE ctv_accounts SET status = 'active' WHERE status IN ('pending', 'rejected', 'approved')");
  console.log(`Updated ${ctvResult.changes} CTV accounts to active`);

  await db.close();
  process.exit(0);
}

fix();
