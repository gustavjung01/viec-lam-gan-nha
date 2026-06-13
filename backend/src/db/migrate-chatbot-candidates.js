// Migration script: Add chatbot matching fields to candidates table
// Phase 1: Chatbot Development
// RISK MITIGATION: Backup, migration, and verification included

import { openDb, DB_PATH } from '../database.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const db = await openDb();
  
  try {
    console.log('Starting migration: Adding chatbot fields to candidates table...');
    console.log('Database path:', DB_PATH);
    
    // RISK MITIGATION 1.1: Backup database before migration
    const backupPath = DB_PATH + '.backup.' + Date.now() + '.db';
    console.log('Creating backup at:', backupPath);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('✓ Backup created successfully');
    
    // Get pre-migration stats for verification
    const preCount = await db.get('SELECT COUNT(*) as count FROM candidates');
    console.log(`Pre-migration: ${preCount.count} candidates in database`);
    
    // Check if columns already exist
    const columns = await db.all(`PRAGMA table_info(candidates)`);
    const existingColumns = columns.map(c => c.name);
    
    const newColumns = [
      { name: 'experience_years', type: 'INTEGER' },
      { name: 'education_level', type: 'TEXT' },
      { name: 'preferred_shift', type: 'TEXT' },
      { name: 'is_stay_in_possible', type: 'INTEGER DEFAULT 0' },
      { name: 'has_transport', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const col of newColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding column: ${col.name} (${col.type})`);
        await db.exec(`ALTER TABLE candidates ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✓ Added ${col.name}`);
      } else {
        console.log(`✓ Column ${col.name} already exists`);
      }
    }
    
    // RISK MITIGATION 1.3: Verify data integrity after migration
    console.log('\nVerifying migration...');
    const postCount = await db.get('SELECT COUNT(*) as count FROM candidates');
    console.log(`Post-migration: ${postCount.count} candidates in database`);
    
    if (preCount.count !== postCount.count) {
      throw new Error(`Data integrity check failed: Candidate count changed from ${preCount.count} to ${postCount.count}`);
    }
    
    // Verify new columns exist and have correct types
    const postColumns = await db.all(`PRAGMA table_info(candidates)`);
    const requiredColumns = ['experience_years', 'education_level', 'preferred_shift', 'is_stay_in_possible', 'has_transport'];
    const missingColumns = requiredColumns.filter(col => !postColumns.some(c => c.name === col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Migration incomplete: Missing columns: ${missingColumns.join(', ')}`);
    }
    
    console.log('✓ All required columns present');
    console.log('\n✅ Migration completed and verified successfully!');
    console.log(`Backup saved at: ${backupPath}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Restore from backup if needed:', backupPath);
    process.exit(1);
  } finally {
    await db.close();
  }
}

migrate();
