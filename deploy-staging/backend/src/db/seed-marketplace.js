/**
 * Marketplace Seed Data
 * Phase 3-lite: Seed local database with test data
 */

import { openDb } from '../database.js';

// Normalize phone number to standard format
function normalizePhone(phone) {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '84' + normalized.substring(1);
  }
  if (!normalized.startsWith('84')) {
    normalized = '84' + normalized;
  }
  return normalized;
}

async function seedDatabase() {
  const db = await openDb();

  console.log('🌱 Seeding marketplace data...');

  // 1. Seed Companies
  const companies = [
    {
      id: 'comp-001',
      company_code: 'CTY012',
      name: 'Công ty TNHH Bảo vệ An Khang',
      phone: '0281234567',
      email: 'contact@ankhang.com',
      address: '123 Lý Thường Kiệt, Q.Tân Bình',
      province: 'TP.HCM',
      district: 'Tân Bình',
      tax_code: '0123456789',
      status: 'active',
      wallet_balance: 5000000,
      credit_limit: 10000000
    },
    {
      id: 'comp-002',
      company_code: 'CTY015',
      name: 'Công ty Logistics XYZ',
      phone: '0289876543',
      email: 'hr@xyzlogistics.com',
      address: '456 Nguyễn Văn Linh, Q.7',
      province: 'TP.HCM',
      district: 'Quận 7',
      tax_code: '9876543210',
      status: 'active',
      wallet_balance: 3000000,
      credit_limit: 5000000
    }
  ];

  for (const company of companies) {
    await db.run(`
      INSERT OR REPLACE INTO companies 
      (id, company_code, name, phone, email, address, province, district, tax_code, status, wallet_balance, credit_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      company.id, company.company_code, company.name, company.phone,
      company.email, company.address, company.province, company.district,
      company.tax_code, company.status, company.wallet_balance, company.credit_limit
    ]);
  }
  console.log('✅ Seeded 2 companies');

  // 2. Seed CTV Accounts
  const ctvs = [
    {
      id: 'ctv-001',
      ctv_code: 'CTV001',
      name: 'Nguyễn Văn An',
      phone: '0901234567',
      email: 'nguyenvanan@email.com',
      zalo_phone: '0901234567',
      bank_account: '123456789',
      bank_name: 'Vietcombank',
      province: 'TP.HCM',
      district: 'Tân Bình',
      status: 'active',
      trust_score: 95,
      total_earned: 2400000
    },
    {
      id: 'ctv-002',
      ctv_code: 'CTV002',
      name: 'Trần Thị Bình',
      phone: '0912345678',
      email: 'tranthibinh@email.com',
      zalo_phone: '0912345678',
      bank_account: '987654321',
      bank_name: 'Techcombank',
      province: 'TP.HCM',
      district: 'Bình Thạnh',
      status: 'active',
      trust_score: 88,
      total_earned: 1200000
    },
    {
      id: 'ctv-003',
      ctv_code: 'CTV003',
      name: 'Lê Văn Cường',
      phone: '0923456789',
      email: 'levancuong@email.com',
      province: 'TP.HCM',
      district: 'Gò Vấp',
      status: 'pending',
      trust_score: 100,
      total_earned: 0
    }
  ];

  for (const ctv of ctvs) {
    await db.run(`
      INSERT OR REPLACE INTO ctv_accounts 
      (id, ctv_code, name, phone, email, zalo_phone, bank_account, bank_name, province, district, status, trust_score, total_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ctv.id, ctv.ctv_code, ctv.name, ctv.phone, ctv.email,
      ctv.zalo_phone, ctv.bank_account, ctv.bank_name,
      ctv.province, ctv.district, ctv.status, ctv.trust_score, ctv.total_earned
    ]);
  }
  console.log('✅ Seeded 3 CTV accounts');

  // 3. Seed Campaigns
  const campaigns = [
    {
      id: 'camp-001',
      campaign_code: 'CMP001',
      company_id: 'comp-001',
      title: 'Tuyển bảo vệ ca đêm KCN Tân Bình',
      description: 'Tuyển 5 bảo vệ làm ca đêm tại KCN Tân Bình. Yêu cầu có kinh nghiệm.',
      job_type: 'Bảo vệ',
      location: 'KCN Tân Bình, TP.HCM',
      province: 'TP.HCM',
      district: 'Tân Bình',
      salary_text: '7-9 triệu/tháng',
      shift_text: 'Ca đêm 22h-6h',
      quantity_needed: 5,
      requirements: JSON.stringify(['Có CMND', 'Đủ 18 tuổi', 'Sức khỏe tốt', 'Kinh nghiệm 1 năm']),
      bounty_amount: 600000,
      ctv_reward_amount: 480000,
      platform_fee_amount: 120000,
      qualification_days: 7,
      max_leads: 20,
      current_leads: 3,
      status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-06-30'
    },
    {
      id: 'camp-002',
      campaign_code: 'CMP002',
      company_id: 'comp-002',
      title: 'Tuyển lao động phổ thông kho hàng Quận 7',
      description: 'Tuyển 10 lao động phổ thông làm việc tại kho hàng Quận 7.',
      job_type: 'Lao động phổ thông',
      location: 'Kho hàng Quận 7, TP.HCM',
      province: 'TP.HCM',
      district: 'Quận 7',
      salary_text: '6-8 triệu/tháng',
      shift_text: 'Ca ngày 8h-17h',
      quantity_needed: 10,
      requirements: JSON.stringify(['Có CMND', 'Đủ 18 tuổi', 'Chăm chỉ']),
      bounty_amount: 500000,
      ctv_reward_amount: 400000,
      platform_fee_amount: 100000,
      qualification_days: 5,
      max_leads: 30,
      current_leads: 2,
      status: 'active',
      start_date: '2026-05-15',
      end_date: '2026-07-15'
    },
    {
      id: 'camp-003',
      campaign_code: 'CMP003',
      company_id: 'comp-001',
      title: 'Tuyển bảo vệ kho hàng Bình Dương',
      description: 'Tuyển 3 bảo vệ cho kho hàng Bình Dương.',
      job_type: 'Bảo vệ',
      location: 'Thủ Dầu Một, Bình Dương',
      province: 'Bình Dương',
      district: 'Thủ Dầu Một',
      salary_text: '8-10 triệu/tháng',
      shift_text: 'Ca 12h',
      quantity_needed: 3,
      requirements: JSON.stringify(['Có CMND/CCCD', 'Không tiền án']),
      bounty_amount: 700000,
      ctv_reward_amount: 560000,
      platform_fee_amount: 140000,
      qualification_days: 7,
      max_leads: 15,
      current_leads: 0,
      status: 'pending',
      start_date: '2026-06-01',
      end_date: '2026-07-30'
    }
  ];

  for (const campaign of campaigns) {
    await db.run(`
      INSERT OR REPLACE INTO campaigns 
      (id, campaign_code, company_id, title, description, job_type, location, province, district, 
       salary_text, shift_text, quantity_needed, requirements, bounty_amount, ctv_reward_amount, 
       platform_fee_amount, qualification_days, max_leads, current_leads, status, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaign.id, campaign.campaign_code, campaign.company_id, campaign.title,
      campaign.description, campaign.job_type, campaign.location, campaign.province,
      campaign.district, campaign.salary_text, campaign.shift_text, campaign.quantity_needed,
      campaign.requirements, campaign.bounty_amount, campaign.ctv_reward_amount,
      campaign.platform_fee_amount, campaign.qualification_days, campaign.max_leads,
      campaign.current_leads, campaign.status, campaign.start_date, campaign.end_date
    ]);
  }
  console.log('✅ Seeded 3 campaigns');

  // 4. Seed Candidates
  const candidates = [
    {
      id: 'cand-001',
      name: 'Trần Văn Bảo',
      phone: '0901111111',
      birth_year: 1990,
      age_range: '30-35',
      province: 'TP.HCM',
      district: 'Tân Bình',
      desired_job: 'Bảo vệ',
      desired_shift: 'Ca đêm',
      consent_status: 'granted'
    },
    {
      id: 'cand-002',
      name: 'Lê Thị Cẩm',
      phone: '0912222222',
      birth_year: 1995,
      age_range: '25-30',
      province: 'TP.HCM',
      district: 'Bình Thạnh',
      desired_job: 'Lao động phổ thông',
      desired_shift: 'Ca ngày',
      consent_status: 'granted'
    },
    {
      id: 'cand-003',
      name: 'Phạm Văn Dũng',
      phone: '0923333333',
      birth_year: 1988,
      age_range: '35-40',
      province: 'TP.HCM',
      district: 'Quận 7',
      desired_job: 'Lao động phổ thông',
      desired_shift: 'Ca ngày',
      consent_status: 'granted'
    },
    {
      id: 'cand-004',
      name: 'Hoàng Thị Em',
      phone: '0934444444',
      birth_year: 1992,
      age_range: '30-35',
      province: 'TP.HCM',
      district: 'Gò Vấp',
      desired_job: 'Bảo vệ',
      desired_shift: 'Ca đêm',
      consent_status: 'granted'
    }
  ];

  for (const candidate of candidates) {
    const normalizedPhone = normalizePhone(candidate.phone);
    await db.run(`
      INSERT OR REPLACE INTO candidates 
      (id, name, phone, normalized_phone, birth_year, age_range, province, district, desired_job, desired_shift, consent_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      candidate.id, candidate.name, candidate.phone, normalizedPhone,
      candidate.birth_year, candidate.age_range, candidate.province,
      candidate.district, candidate.desired_job, candidate.desired_shift,
      candidate.consent_status
    ]);
  }
  console.log('✅ Seeded 4 candidates');

  // 5. Seed Lead Submissions with various statuses
  const leads = [
    // Qualified lead (for 20/80 testing)
    {
      id: 'lead-001',
      lead_code: 'LED001',
      campaign_id: 'camp-001',
      ctv_id: 'ctv-001',
      candidate_id: 'cand-001',
      status: 'qualified',
      is_anonymous: 0,
      claimed_by_company_id: 'comp-001'
    },
    // Claimed but not qualified
    {
      id: 'lead-002',
      lead_code: 'LED002',
      campaign_id: 'camp-001',
      ctv_id: 'ctv-001',
      candidate_id: 'cand-002',
      status: 'claimed',
      is_anonymous: 0,
      claimed_by_company_id: 'comp-001'
    },
    // Submitted, waiting for approval
    {
      id: 'lead-003',
      lead_code: 'LED003',
      campaign_id: 'camp-002',
      ctv_id: 'ctv-002',
      candidate_id: 'cand-003',
      status: 'submitted',
      is_anonymous: 1
    },
    // Disputed lead
    {
      id: 'lead-004',
      lead_code: 'LED004',
      campaign_id: 'camp-001',
      ctv_id: 'ctv-003',
      candidate_id: 'cand-001', // Same phone as lead-001
      status: 'disputed',
      is_anonymous: 1
    }
  ];

  for (const lead of leads) {
    await db.run(`
      INSERT OR REPLACE INTO lead_submissions 
      (id, lead_code, campaign_id, ctv_id, candidate_id, status, is_anonymous, claimed_by_company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lead.id, lead.lead_code, lead.campaign_id, lead.ctv_id,
      lead.candidate_id, lead.status, lead.is_anonymous,
      lead.claimed_by_company_id || null
    ]);

    // Add status history
    await db.run(`
      INSERT OR REPLACE INTO lead_status_history 
      (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `hist-${lead.id}`, lead.id, 'new', lead.status, 'system', 'seed', 'Initial seed data'
    ]);

    // Add phone lock for non-disputed leads
    if (lead.status !== 'disputed') {
      const candidate = candidates.find(c => c.id === lead.candidate_id);
      if (candidate) {
        const normalizedPhone = normalizePhone(candidate.phone);
        await db.run(`
          INSERT OR REPLACE INTO phone_locks 
          (id, normalized_phone, campaign_id, lead_id, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `, [
          `lock-${lead.id}`, normalizedPhone, lead.campaign_id, lead.id,
          '2026-12-31 23:59:59' // Long expiration for seed
        ]);
      }
    }
  }
  console.log('✅ Seeded 4 leads with history and phone locks');

  // 6. Seed Platform Fees and CTV Payouts for qualified lead
  // Lead 001: bounty = 600K, ctv = 480K (80%), platform = 120K (20%)
  await db.run(`
    INSERT OR REPLACE INTO platform_fees 
    (id, lead_id, campaign_id, company_id, fee_amount, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['fee-001', 'lead-001', 'camp-001', 'comp-001', 120000, 'pending']);

  await db.run(`
    INSERT OR REPLACE INTO ctv_payouts 
    (id, lead_id, ctv_id, campaign_id, payout_amount, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['payout-001', 'lead-001', 'ctv-001', 'camp-001', 480000, 'pending']);

  console.log('✅ Seeded platform fees and CTV payouts (20/80 split)');

  // 7. Seed Audit Logs
  const auditLogs = [
    {
      id: 'audit-001',
      entity_type: 'lead',
      entity_id: 'lead-001',
      action: 'submitted',
      actor_role: 'ctv',
      actor_id: 'ctv-001',
      details: JSON.stringify({ campaign: 'CMP001', candidate: 'Trần Văn Bảo' })
    },
    {
      id: 'audit-002',
      entity_type: 'lead',
      entity_id: 'lead-001',
      action: 'claimed',
      actor_role: 'company',
      actor_id: 'comp-001',
      details: JSON.stringify({ bounty_paid: 600000 })
    },
    {
      id: 'audit-003',
      entity_type: 'lead',
      entity_id: 'lead-001',
      action: 'status_changed',
      actor_role: 'admin',
      actor_id: 'admin-001',
      details: JSON.stringify({ from: 'hired', to: 'qualified', reason: 'Completed probation' })
    },
    {
      id: 'audit-004',
      entity_type: 'lead',
      entity_id: 'lead-004',
      action: 'duplicate_detected',
      actor_role: 'system',
      actor_id: 'system',
      details: JSON.stringify({ conflict_with: 'lead-001', phone: '0901111111' })
    }
  ];

  for (const log of auditLogs) {
    await db.run(`
      INSERT OR REPLACE INTO audit_logs 
      (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [log.id, log.entity_type, log.entity_id, log.action, log.actor_role, log.actor_id, log.details]);
  }
  console.log('✅ Seeded audit logs');

  console.log('\n🎉 Marketplace seed completed!');
  console.log('📊 Summary:');
  console.log('   - 2 Companies (CTY012, CTY015)');
  console.log('   - 3 CTV accounts (CTV001 active, CTV002 active, CTV003 pending)');
  console.log('   - 3 Campaigns (2 active, 1 pending)');
  console.log('   - 4 Leads (1 qualified, 1 claimed, 1 submitted, 1 disputed)');
  console.log('   - 20/80 split verified: LED001 = 120K fee + 480K payout');

  await db.close();
}

// Run if called directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  seedDatabase().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}

export { seedDatabase, normalizePhone };
