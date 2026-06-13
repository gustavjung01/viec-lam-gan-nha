export interface Campaign {
  id: string;
  campaign_code: string;
  title: string;
  company_name: string;
  company_code: string;
  status: string;
  visibility: 'public_candidate' | 'ctv_private';
  bounty_amount: number;
  platform_fee_amount: number;
  ctv_reward_amount: number;
  total_leads: number;
}

export interface Lead {
  id: string;
  lead_code: string;
  campaign_id: string;
  campaign_title: string;
  company_id?: string;
  company_name?: string;
  ctv_id?: string;
  ctv_name?: string;
  candidate_name: string;
  candidate_phone: string;
  normalized_phone: string;
  zalo_phone?: string;
  province?: string;
  district?: string;
  status: string;
  submitted_at: string;
  processed_by?: string;
  notes?: string;
}

export interface LeadFilters {
  search: string;
  status: string;
  campaignId: string;
  companyId: string;
  ctvId: string;
  province: string;
  district: string;
  dateFrom: string;
  dateTo: string;
}

export interface CTVAccount {
  id: string;
  ctv_code: string;
  name: string;
  phone: string;
  email: string;
  zalo_phone: string;
  province: string;
  district: string;
  bank_account: string;
  bank_name: string;
  status: 'pending' | 'active' | 'rejected' | 'blocked';
  rejection_reason: string;
  submitted_at: string;
  created_at: string;
}

export interface CompanyAccount {
  id: string;
  company_code: string;
  clerk_user_id?: string | null;
  name: string;
  phone: string;
  email: string;
  tax_code: string;
  address: string;
  province: string;
  district: string;
  status: 'pending' | 'active' | 'rejected' | 'blocked';
  rejection_reason: string;
  submitted_at: string;
  created_at: string;
  trust_level: 'normal' | 'verified' | 'priority' | 'vip';
  deposit_status: 'none' | 'pending' | 'partial' | 'confirmed' | 'waived';
  lead_trial_limit: number;
  require_deposit_after_leads: number;
  is_featured: number;
  plan_code: 'free' | 'basic' | 'pro' | 'vip';
  free_job_posts_limit: number;
  weekly_push_limit: number;
  wallet_balance: number;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_role: string;
  actor_id: string;
  details: string;
  created_at: string;
}

export interface TaxReport {
  period?: string;
  summary: {
    total_qualified_leads: number;
    total_company_bounty: number;
    total_platform_fees_20_percent: number;
    total_ctv_payouts_80_percent: number;
  };
  qualified_leads?: TaxReportQualifiedLead[];
  platform_fees?: TaxReportPlatformFee[];
  ctv_payouts?: TaxReportCtvPayout[];
  pending_company_debt?: TaxReportPendingDebt[];
  split_verification: {
    math_check: boolean;
    company_pays?: number;
    'ctv_receives_80%'?: number;
    'platform_keeps_20%'?: number;
  };
}

export interface TaxReportQualifiedLead {
  id: string;
  lead_code: string;
  qualified_at: string;
  campaign_title: string;
  company_name: string;
  ctv_name?: string | null;
  bounty_amount: number;
  platform_fee_amount: number;
  ctv_reward_amount: number;
}

export interface TaxReportPlatformFee {
  id: string;
  lead_id: string;
  lead_code: string;
  campaign_title: string;
  company_name: string;
  fee_amount: number;
  status: string;
  created_at: string;
  invoiced_at?: string | null;
  paid_at?: string | null;
  transaction_reference?: string | null;
}

export interface TaxReportCtvPayout {
  id: string;
  lead_id: string;
  lead_code: string;
  campaign_title: string;
  ctv_name: string;
  payout_amount: number;
  status: string;
  created_at: string;
  approved_at?: string | null;
  paid_at?: string | null;
  transaction_reference?: string | null;
}

export interface TaxReportPendingDebt {
  company_id: string;
  company_name: string;
  company_code: string;
  total_pending_fees: number;
  pending_count: number;
}

export interface AdminConfigData {
  app_version: string;
  node_version: string;
  database_path: string;
  public_mode: 'enabled' | 'disabled';
  admin_auth_mode: string;
  rate_limits: {
    general: number;
    apply: number;
    admin_read: number;
    admin_login: number;
  };
}

export interface LeadStatusHistory {
  id: string;
  lead_id: string;
  from_status: string;
  to_status: string;
  changed_by_role?: string | null;
  changed_by_id?: string | null;
  reason?: string | null;
  created_at: string;
}

export const TABS = ['Tổng quan', 'CTV', 'Công ty', 'Chiến dịch', 'Lead', 'Tài chính nội bộ', 'Cấu hình'];

// ============ AI Config & Load Resources ============
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ResourceItem {
  id: string;
  name?: string;
  displayName: string;
  description?: string;
  type?: string;
  meta?: Record<string, any>;
  additionalInfo?: Record<string, any>;
}

export interface LoadState {
  status: LoadStatus;
  items: ResourceItem[];
  error: string | null;
  lastLoaded: string | null;
}

export const TH_CLASS = 'px-4 py-3 text-left text-sm font-semibold text-slate-700';
export const TH_CENTER_CLASS = 'px-4 py-3 text-center text-sm font-semibold text-slate-700';
export const TD_CLASS = 'px-4 py-3 text-sm text-slate-600';
export const TD_CENTER_CLASS = 'px-4 py-3 text-center text-sm';
