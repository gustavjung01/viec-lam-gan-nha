import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { CampaignCard } from '../../components/ctv/CampaignCard';
import { CampaignDetailModal } from '../../components/ctv/CampaignDetailModal';
import { Loader2, AlertCircle, Search, ArrowLeft } from 'lucide-react';

const API_URL = '/api';

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
  status: string;
}

export function CTVCampaignsPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();

        const res = await fetch(`${API_URL}/ctv/campaigns`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          throw new Error('Không thể tải danh sách chiến dịch');
        }

        const data = await res.json();
        // Filter only active campaigns
        const activeCampaigns = (data.data || []).filter(
          (c: Campaign) => c.status === 'active' || c.status === 'running'
        );
        setCampaigns(activeCampaigns);
      } catch (err) {
        setError('Không thể tải danh sách chiến dịch. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [getToken]);

  const handleCampaignClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleSelectCampaign = () => {
    if (selectedCampaign) {
      // Navigate to dashboard with campaign pre-selected
      navigate(`/ctv/dashboard?campaign=${selectedCampaign.id}`);
    }
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.province.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.district && c.district.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
            <Link to="/ctv/dashboard" className="inline-flex items-center gap-2 text-sm hover:text-green-100">
              <ArrowLeft className="h-4 w-4" />
              Về Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Chiến dịch tuyển dụng</h1>
          </div>
        </header>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
            <Link to="/ctv/dashboard" className="inline-flex items-center gap-2 text-sm hover:text-green-100">
              <ArrowLeft className="h-4 w-4" />
              Về Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Chiến dịch tuyển dụng</h1>
          </div>
        </header>
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-2 text-lg font-semibold text-red-900">Lỗi tải dữ liệu</h2>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link to="/ctv/dashboard" className="inline-flex items-center gap-2 text-sm text-green-100 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Về Dashboard
              </Link>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">Chiến dịch tuyển dụng</h1>
              <p className="mt-1 text-green-100">Chọn chiến dịch phù hợp để giới thiệu ứng viên</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{campaigns.length}</p>
              <p className="text-sm text-green-100">chiến dịch đang mở</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, công ty, khu vực..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-slate-500">
          Hiển thị {filteredCampaigns.length} / {campaigns.length} chiến dịch
        </div>

        {/* Campaign Grid */}
        {filteredCampaigns.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center">
            <p className="text-slate-500">Không tìm thấy chiến dịch phù hợp</p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="mt-4 text-green-600 hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => handleCampaignClick(campaign)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectCampaign}
      />
    </div>
  );
}

export default CTVCampaignsPage;
