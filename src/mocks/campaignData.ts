import type { UserRole } from '../contexts/RoleContext';

// Campaign types
export interface Campaign {
  id: string;
  campaignCode: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  title: string;
  description: string;
  province: string;
  district: string;
  industry: string;
  rewardAmount: number;
  ctvReward: number; // 80%
  platformFee: number; // 20%
  requirements: string[];
  maxLeads: number;
  currentLeads: number;
  status: 'pending' | 'approved' | 'running' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
}

export interface Lead {
  id: string;
  leadCode: string;
  campaignId: string;
  ctvId: string;
  ctvName: string;
  candidateName: string;
  candidatePhone: string;
  candidateProvince: string;
  candidateDistrict: string;
  note?: string;
  status: 'new' | 'submitted' | 'approved' | 'claimed' | 'interviewing' | 'hired' | 'qualified' | 'rejected' | 'disputed' | 'paid';
  submittedAt: string;
  claimedAt?: string;
  claimedByCompanyId?: string;
  rewardAmount: number;
  ctvCommission: number;
  isAnonymous: boolean; // true until claimed
}

export interface Commission {
  id: string;
  leadId: string;
  ctvId: string;
  campaignId: string;
  companyId: string;
  amount: number;
  status: 'pending' | 'approved' | 'ready' | 'paid';
  calculatedAt: string;
}

// Mock campaigns
export const mockCampaigns: Campaign[] = [
  {
    id: 'camp-001',
    campaignCode: 'CMP001',
    companyId: 'comp-001',
    companyCode: 'DEMO01',
    companyName: 'Công ty TNHH ABC',
    title: 'Tuyển bảo vệ ca đêm KCN Tân Bình',
    description: 'Tuyển 5 bảo vệ làm ca đêm tại KCN Tân Bình. Yêu cầu có kinh nghiệm, khỏe mạnh.',
    province: 'TP.HCM',
    district: 'Tân Bình',
    industry: 'Bảo vệ',
    rewardAmount: 600000,
    ctvReward: 480000, // 80%
    platformFee: 120000, // 20%
    requirements: ['Có CMND', 'Đủ 18 tuổi', 'Sức khỏe tốt', 'Kinh nghiệm 1 năm'],
    maxLeads: 20,
    currentLeads: 8,
    status: 'running',
    startDate: '2026-05-01',
    endDate: '2026-06-30',
  },
  {
    id: 'camp-002',
    campaignCode: 'CMP002',
    companyId: 'comp-002',
    companyCode: 'DEMO02',
    companyName: 'Công ty XYZ',
    title: 'Tuyển lao động phổ thông kho hàng',
    description: 'Tuyển 10 lao động phổ thông làm việc tại kho hàng Quận 9. Không yêu cầu kinh nghiệm.',
    province: 'TP.HCM',
    district: 'Quận 9',
    industry: 'Lao động phổ thông',
    rewardAmount: 500000,
    ctvReward: 400000, // 80%
    platformFee: 100000, // 20%
    requirements: ['Có CMND', 'Đủ 18 tuổi', 'Chăm chỉ'],
    maxLeads: 30,
    currentLeads: 15,
    status: 'running',
    startDate: '2026-05-15',
    endDate: '2026-07-15',
  },
];

// Mock leads
export const mockLeads: Lead[] = [
  {
    id: 'lead-001',
    leadCode: 'LED001',
    campaignId: 'camp-001',
    ctvId: 'ctv-001',
    ctvName: 'Nguyễn Văn A',
    candidateName: 'Trần Văn B',
    candidatePhone: '0901234567',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Tân Bình',
    note: 'Có kinh nghiệm bảo vệ 2 năm',
    status: 'claimed',
    submittedAt: '2026-05-20T10:00:00Z',
    claimedAt: '2026-05-20T14:00:00Z',
    claimedByCompanyId: 'comp-001',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: false,
  },
  {
    id: 'lead-002',
    leadCode: 'LED002',
    campaignId: 'camp-001',
    ctvId: 'ctv-001',
    ctvName: 'Nguyễn Văn A',
    candidateName: 'Lê Thị C',
    candidatePhone: '0912345678',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Bình Tân',
    note: 'Muốn làm ca ngày',
    status: 'approved',
    submittedAt: '2026-05-21T09:00:00Z',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: true,
  },
  {
    id: 'lead-003',
    leadCode: 'LED003',
    campaignId: 'camp-002',
    ctvId: 'ctv-002',
    ctvName: 'Phạm Thị D',
    candidateName: 'Hoàng Văn E',
    candidatePhone: '0923456789',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Thủ Đức',
    status: 'submitted',
    submittedAt: '2026-05-22T08:00:00Z',
    rewardAmount: 500000,
    ctvCommission: 400000,
    isAnonymous: true,
  },
  // Additional leads for comprehensive testing
  {
    id: 'lead-004',
    leadCode: 'LED004',
    campaignId: 'camp-001',
    ctvId: 'ctv-001',
    ctvName: 'Nguyễn Văn A',
    candidateName: 'Phạm Văn F',
    candidatePhone: '0934567890',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Quận 7',
    note: 'Phỏng vấn lúc 14h thứ 6',
    status: 'interviewing',
    submittedAt: '2026-05-18T10:00:00Z',
    claimedAt: '2026-05-18T15:00:00Z',
    claimedByCompanyId: 'comp-001',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: false,
  },
  {
    id: 'lead-005',
    leadCode: 'LED005',
    campaignId: 'camp-001',
    ctvId: 'ctv-001',
    ctvName: 'Nguyễn Văn A',
    candidateName: 'Trần Thị G',
    candidatePhone: '0945678901',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Tân Bình',
    note: 'Đã nhận việc, bắt đầu làm 1/6',
    status: 'hired',
    submittedAt: '2026-05-15T09:00:00Z',
    claimedAt: '2026-05-15T14:00:00Z',
    claimedByCompanyId: 'comp-001',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: false,
  },
  {
    id: 'lead-006',
    leadCode: 'LED006',
    campaignId: 'camp-002',
    ctvId: 'ctv-002',
    ctvName: 'Phạm Thị D',
    candidateName: 'Lê Văn H',
    candidatePhone: '0956789012',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Bình Thạnh',
    status: 'rejected',
    submittedAt: '2026-05-20T16:00:00Z',
    rewardAmount: 500000,
    ctvCommission: 400000,
    isAnonymous: true,
  },
  {
    id: 'lead-007',
    leadCode: 'LED007',
    campaignId: 'camp-001',
    ctvId: 'ctv-003',
    ctvName: 'Lê Thị E',
    candidateName: 'Nguyễn Văn I',
    candidatePhone: '0901234567',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Gò Vấp',
    note: 'Tranh chấp: cùng SĐT với LED002',
    status: 'disputed',
    submittedAt: '2026-05-21T11:00:00Z',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: true,
  },
  {
    id: 'lead-008',
    leadCode: 'LED008',
    campaignId: 'camp-001',
    ctvId: 'ctv-001',
    ctvName: 'Nguyễn Văn A',
    candidateName: 'Hoàng Thị K',
    candidatePhone: '0967890123',
    candidateProvince: 'TP.HCM',
    candidateDistrict: 'Phú Nhuận',
    note: 'Hoa hồng đã thanh toán',
    status: 'paid',
    submittedAt: '2026-05-10T08:00:00Z',
    claimedAt: '2026-05-10T12:00:00Z',
    claimedByCompanyId: 'comp-001',
    rewardAmount: 600000,
    ctvCommission: 480000,
    isAnonymous: false,
  },
];

// Mock commissions
export const mockCommissions: Commission[] = [
  {
    id: 'comm-001',
    leadId: 'lead-001',
    ctvId: 'ctv-001',
    campaignId: 'camp-001',
    companyId: 'comp-001',
    amount: 480000,
    status: 'ready',
    calculatedAt: '2026-05-20T14:00:00Z',
  },
  {
    id: 'comm-002',
    leadId: 'lead-002',
    ctvId: 'ctv-001',
    campaignId: 'camp-001',
    companyId: 'comp-001',
    amount: 480000,
    status: 'approved',
    calculatedAt: '2026-05-21T09:00:00Z',
  },
];

// Helper functions
export function getCampaignsForRole(role: UserRole, userId?: string): Campaign[] {
  switch (role) {
    case 'admin':
      return mockCampaigns;
    case 'company':
      return mockCampaigns.filter(c => c.companyId === userId || c.status === 'running');
    case 'ctv':
    case 'candidate':
    case 'guest':
      return mockCampaigns.filter(c => c.status === 'running');
    default:
      return [];
  }
}

export function getLeadsForRole(role: UserRole, userId?: string): Lead[] {
  switch (role) {
    case 'admin':
      return mockLeads;
    case 'company':
      return mockLeads.filter(l => 
        l.claimedByCompanyId === userId || 
        (l.isAnonymous && l.status === 'approved')
      );
    case 'ctv':
      return mockLeads.filter(l => l.ctvId === userId);
    default:
      return [];
  }
}

export function getCommissionsForCTV(ctvId: string): Commission[] {
  return mockCommissions.filter(c => c.ctvId === ctvId);
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount);
}
