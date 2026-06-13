import { Briefcase } from 'lucide-react';
import type { Campaign } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';

interface AdminCampaignTabProps {
  campaigns: Campaign[];
  onAction: (actionName: string, endpoint: string, body?: any) => void;
}

export function AdminCampaignTab({ campaigns, onAction }: AdminCampaignTabProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={TH_CLASS}>Chiến dịch</th>
                <th scope="col" className={TH_CLASS}>Công ty</th>
                <th scope="col" className={TH_CLASS}>Trạng thái</th>
                <th scope="col" className={TH_CLASS}>Hiển thị</th>
                <th scope="col" className={TH_CLASS}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-slate-50 transition-colors">
                  <td className={TD_CLASS}>
                    <div className="font-medium text-slate-900">{campaign.title}</div>
                    <div className="text-slate-500 text-xs">Mã: {campaign.campaign_code}</div>
                    <div className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                      <Briefcase className="h-3 w-3" />
                      <span>{campaign.total_leads} leads</span>
                    </div>
                  </td>
                  <td className={TD_CLASS}>
                    <div className="text-slate-900">{campaign.company_name}</div>
                    <div className="text-slate-500 text-xs">Mã: {campaign.company_code}</div>
                  </td>
                  <td className={TD_CLASS}>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                        campaign.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800'}`}
                    >
                      {campaign.status === 'active' ? 'Hoạt động' :
                       campaign.status === 'pending' ? 'Chờ duyệt' : 'Đã đóng'}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${campaign.visibility === 'public_candidate' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}
                    >
                      {campaign.visibility === 'public_candidate' ? 'Public (Ứng viên)' : 'Private (Chỉ CTV)'}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
                     {campaign.status === 'pending' && (
                        <button
                          onClick={() => onAction('Duyệt chiến dịch', `/admin/campaigns/${campaign.id}/approve`)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Duyệt
                        </button>
                    )}
                    {campaign.status === 'active' && (
                       <button
                         onClick={() => onAction('Đóng chiến dịch', `/admin/campaigns/${campaign.id}/close`)}
                         className="text-red-600 hover:text-red-900 font-medium"
                       >
                         Đóng
                       </button>
                    )}
                     {campaign.status === 'closed' && (
                       <button
                         onClick={() => onAction('Mở lại chiến dịch', `/admin/campaigns/${campaign.id}/reopen`)}
                         className="text-blue-600 hover:text-blue-900 font-medium"
                       >
                         Mở lại
                       </button>
                    )}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy chiến dịch nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
