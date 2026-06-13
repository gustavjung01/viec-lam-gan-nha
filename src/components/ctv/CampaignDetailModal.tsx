import { formatCurrency } from '../../mocks/campaignData';
import { X, Building2, MapPin, Banknote, Award, Clock, FileText, Briefcase } from 'lucide-react';

interface Campaign {
  id: string;
  campaign_code: string;
  title: string;
  company_name: string;
  province: string;
  district: string;
  salary_text: string;
  shift_text?: string;
  ctv_reward_amount: number;
  bounty_amount: number;
  end_date?: string;
  qualification_days?: number;
  requirements?: string;
  description?: string;
  job_type?: string;
  location?: string;
  quantity_needed?: number;
}

interface CampaignDetailModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
}

function textToRequirementList(value: string) {
  return value
    .split(/\r?\n|•|;|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseRequirements(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof parsed === 'string') {
      return textToRequirementList(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed).map(item => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    // requirements có thể là text thường từ admin/import cũ, không được để crash modal.
  }

  return textToRequirementList(raw);
}

export function CampaignDetailModal({ campaign, isOpen, onClose, onSelect }: CampaignDetailModalProps) {
  if (!isOpen || !campaign) return null;

  const daysLeft = campaign.end_date 
    ? Math.ceil((new Date(campaign.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const requirements = parseRequirements(campaign.requirements);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <span className="text-xs font-medium text-slate-500">{campaign.campaign_code}</span>
            <h2 className="text-xl font-bold text-slate-900">{campaign.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Company & Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Công ty</p>
                <p className="font-medium text-slate-900">{campaign.company_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-orange-50 p-2">
                <MapPin className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Khu vực</p>
                <p className="font-medium text-slate-900">
                  {campaign.province}{campaign.district ? ` - ${campaign.district}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Salary & Reward */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Lương</p>
                <p className="font-medium text-slate-900">{campaign.salary_text || 'Thỏa thuận'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-50 p-2">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Hoa hồng CTV</p>
                <p className="font-bold text-green-600">{formatCurrency(campaign.ctv_reward_amount)}</p>
                <p className="text-xs text-slate-400">/ứng viên được nhận</p>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="rounded-lg bg-slate-50 p-4 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Chi tiết công việc
            </h3>
            
            {campaign.job_type && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Loại công việc:</span>
                <span className="font-medium text-slate-700">{campaign.job_type}</span>
              </div>
            )}
            
            {campaign.shift_text && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Ca làm:</span>
                <span className="font-medium text-slate-700">{campaign.shift_text}</span>
              </div>
            )}
            
            {campaign.quantity_needed && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Số lượng cần:</span>
                <span className="font-medium text-slate-700">{campaign.quantity_needed} người</span>
              </div>
            )}
            
            {campaign.qualification_days && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Thời gian xét duyệt:</span>
                <span className="font-medium text-slate-700">{campaign.qualification_days} ngày</span>
              </div>
            )}

            {daysLeft !== null && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Hạn chót:</span>
                <span className={`font-medium ${daysLeft > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {daysLeft > 0 
                    ? `Còn ${daysLeft} ngày` 
                    : daysLeft === 0 
                      ? 'Hết hạn hôm nay' 
                      : 'Đã hết hạn'}
                </span>
              </div>
            )}
          </div>

          {/* Requirements */}
          {requirements.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Yêu cầu
              </h3>
              <ul className="space-y-2">
                {requirements.map((req: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {campaign.description && (
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Mô tả chi tiết</h3>
              <p className="text-sm text-slate-600 whitespace-pre-line">{campaign.description}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onSelect();
                onClose();
              }}
              disabled={daysLeft !== null && daysLeft < 0}
              className="flex-1 rounded-lg bg-green-600 py-2.5 font-medium text-white hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {daysLeft !== null && daysLeft < 0 ? 'Đã hết hạn' : 'Chọn chiến dịch này'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignDetailModal;
