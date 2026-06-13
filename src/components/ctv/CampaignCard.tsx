import { formatCurrency } from '../../mocks/campaignData';
import { Calendar, MapPin, Building2, Banknote } from 'lucide-react';

interface Campaign {
  id: string;
  campaign_code: string;
  title: string;
  company_name: string;
  province: string;
  district: string;
  salary_text: string;
  ctv_reward_amount: number;
  bounty_amount: number;
  end_date?: string;
  shift_text?: string;
  requirements?: string;
}

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const daysLeft = campaign.end_date 
    ? Math.ceil((new Date(campaign.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div 
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-green-300 border border-transparent"
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 line-clamp-2">{campaign.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <Building2 className="h-3 w-3" />
          <span>{campaign.company_name}</span>
        </div>
      </div>

      {/* Location */}
      <div className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-slate-400" />
        <span>{campaign.province}{campaign.district ? ` - ${campaign.district}` : ''}</span>
      </div>

      {/* Salary & Reward */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-slate-700">{campaign.salary_text || 'Thỏa thuận'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            HH: {formatCurrency(campaign.ctv_reward_amount)}
          </span>
        </div>
      </div>

      {/* Deadline */}
      {daysLeft !== null && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          <span>
            {daysLeft > 0 
              ? `Còn ${daysLeft} ngày` 
              : daysLeft === 0 
                ? 'Hết hạn hôm nay' 
                : 'Đã hết hạn'}
          </span>
        </div>
      )}

      {/* Click hint */}
      <div className="mt-3 text-center text-xs text-green-600 font-medium">
        Click xem chi tiết
      </div>
    </div>
  );
}

export default CampaignCard;
