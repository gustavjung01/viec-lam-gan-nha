import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb } from '../src/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: During VPS deployment, the deployment process copies companies.normalized.json 
// and campaigns.normalized.json to this directory before running the script.
const DATA_DIR = '/tmp';
const DRY_RUN = process.argv.includes('--dry-run');

async function importData() {
  console.log(`Starting import... (DRY RUN: ${DRY_RUN})`);
  const db = await openDb();

  try {
    const companiesRaw = await fs.readFile(path.join(DATA_DIR, 'companies.normalized.json'), 'utf8');
    const campaignsRaw = await fs.readFile(path.join(DATA_DIR, 'campaigns.normalized.json'), 'utf8');
    
    const companies = JSON.parse(companiesRaw);
    const campaigns = JSON.parse(campaignsRaw);

    console.log(`Found ${companies.length} companies and ${campaigns.length} campaigns in local data.`);

    let insertedCompanies = 0;
    let updatedCompanies = 0;
    let skippedCompanies = 0;

    // 1. Process Companies
    for (const comp of companies) {
      // Map to schema
      const companyCode = comp.company_code.toUpperCase().replace(/-/g, '_'); // Generate a safe code
      
      const existing = await db.get('SELECT * FROM companies WHERE company_code = ?', companyCode);
      
      if (!existing) {
        if (!DRY_RUN) {
          const id = `comp_${Date.now()}_${Math.floor(Math.random()*1000)}`;
          await db.run(`
            INSERT INTO companies (id, company_code, name, status) 
            VALUES (?, ?, ?, 'active')
          `, [id, companyCode, comp.company_name]);
        }
        insertedCompanies++;
      } else {
        // Update if needed, or skip. Idempotent.
        skippedCompanies++;
      }
    }

    console.log(`Companies - Inserted: ${insertedCompanies}, Updated: ${updatedCompanies}, Skipped: ${skippedCompanies}`);

    let insertedCampaigns = 0;
    let updatedCampaigns = 0;
    let skippedCampaigns = 0;

    // 2. Process Campaigns
    for (const camp of campaigns) {
      const campCompanyCode = camp.company_code.toUpperCase().replace(/-/g, '_');
      const company = await db.get('SELECT id FROM companies WHERE company_code = ?', campCompanyCode);
      
      const companyId = company ? company.id : (DRY_RUN ? 'mock_company_id' : null);

      if (!companyId) {
        console.warn(`WARNING: Company not found for campaign ${camp.campaign_code}. Skipping.`);
        skippedCampaigns++;
        continue;
      }

      // Check if campaign exists
      const existingCamp = await db.get('SELECT * FROM campaigns WHERE campaign_code = ?', camp.campaign_code);
      
      // Data mapping
      const title = camp.title || 'Tuyển nhân viên';
      const jobType = camp.job_type === 'security_guard' ? 'Bảo vệ' : 'Khác';
      const location = camp.location || camp.district || camp.province;
      const province = camp.province;
      const district = camp.district || camp.location;
      const salaryText = camp.salary_text || 'Thỏa thuận';
      const shiftText = camp.shift_text || 'Thỏa thuận';
      const quantityNeeded = camp.quantity_needed || 1;
      const bountyAmount = camp.bounty_amount || 0;
      const ctvRewardAmount = camp.ctv_reward_amount || 0;
      const platformFeeAmount = camp.platform_fee_amount || 0;
      // If no bounty, still make it active and public_candidate as per instructions
      const visibility = 'public_candidate';
      const status = 'active';

      if (!existingCamp) {
        if (!DRY_RUN) {
          const id = `camp_${Date.now()}_${Math.floor(Math.random()*10000)}`;
          await db.run(`
            INSERT INTO campaigns (
              id, campaign_code, company_id, title, job_type, location, province, district, 
              salary_text, shift_text, quantity_needed, bounty_amount, ctv_reward_amount, 
              platform_fee_amount, status, visibility
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, camp.campaign_code, company.id, title, jobType, location, province, district,
            salaryText, shiftText, quantityNeeded, bountyAmount, ctvRewardAmount,
            platformFeeAmount, status, visibility
          ]);
        }
        insertedCampaigns++;
      } else {
        // Idempotent update
        if (!DRY_RUN) {
          await db.run(`
            UPDATE campaigns SET 
              title = ?, job_type = ?, location = ?, province = ?, district = ?, 
              salary_text = ?, shift_text = ?, quantity_needed = ?, bounty_amount = ?, 
              ctv_reward_amount = ?, platform_fee_amount = ?, status = ?, visibility = ?
            WHERE campaign_code = ?
          `, [
            title, jobType, location, province, district, salaryText, shiftText, quantityNeeded, 
            bountyAmount, ctvRewardAmount, platformFeeAmount, status, visibility, camp.campaign_code
          ]);
        }
        updatedCampaigns++;
      }
    }

    console.log(`Campaigns - Inserted: ${insertedCampaigns}, Updated: ${updatedCampaigns}, Skipped: ${skippedCampaigns}`);
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await db.close();
    console.log('Import finished.');
  }
}

importData();
