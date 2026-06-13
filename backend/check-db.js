import { initDatabase, getApplications, getApplicationStats } from './src/database.js';

async function main() {
  try {
    await initDatabase();
    
    console.log('\n=== Application Stats ===');
    const stats = await getApplicationStats();
    console.log(stats);
    
    console.log('\n=== Recent Applications ===');
    const apps = await getApplications(5);
    console.table(apps);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
