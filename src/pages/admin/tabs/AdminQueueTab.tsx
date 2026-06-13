import { useState, useEffect } from 'react';
import { 
  Search, Filter, CheckCircle, XCircle, AlertTriangle, 
  Eye, Shield, Clock, MoreHorizontal, User, Building2,
  MapPin, Phone, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = '/api';

interface Lead {
  id: string;
  lead_code: string;
  campaign_title: string;
  company_name: string;
  candidate_name: string;
  candidate_phone: string;
  province: string;
  district: string;
  status: string;
  submitted_at: string;
  ctv_name: string;
  status_changes: number;
  submitted_ip: string;
  user_agent: string;
}

interface QueueCounts {
  pending: number;
  approved: number;
  rejected: number;
  disputed: number;
  total: number;
}

export function AdminQueueTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('submitted');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [auditReason, setAuditReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, [status]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/queue?status=${status}`);
      const data = await res.json();
      
      if (data.success) {
        setLeads(data.data);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async (action: 'approve' | 'reject' | 'flag_fraud') => {
    if (!selectedLead) return;
    
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/admin/leads/${selectedLead.id}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: 'admin-001',
          action,
          reason: auditReason
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSelectedLead(null);
        setAuditReason('');
        fetchQueue();
      }
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const filteredLeads = leads.filter(l => 
    search === '' || 
    l.lead_code.toLowerCase().includes(search.toLowerCase()) ||
    l.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
    l.campaign_title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {counts && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Chờ duyệt', value: counts.pending, color: 'amber', status: 'submitted' },
            { label: 'Đã duyệt', value: counts.approved, color: 'green', status: 'approved' },
            { label: 'Từ chối', value: counts.rejected, color: 'red', status: 'rejected' },
            { label: 'Tranh chấp', value: counts.disputed, color: 'purple', status: 'disputed' },
            { label: 'Tổng', value: counts.total, color: 'slate', status: 'all' },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => setStatus(stat.status === 'all' ? 'submitted' : stat.status)}
              className={`p-4 rounded-xl text-left transition-all ${
                status === stat.status || (stat.status === 'all' && status === 'submitted')
                  ? `bg-${stat.color}-50 border-2 border-${stat.color}-200` 
                  : 'bg-white border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className={`text-sm text-${stat.color}-600`}>{stat.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm lead theo mã, tên ứng viên, chiến dịch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-slate-200 focus:border-brand-orange focus:ring-brand-orange"
          />
        </div>
        <button className="px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Lọc
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Mã Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Ứng viên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Chiến dịch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">CTV</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Gửi lúc</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Không có lead nào
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-slate-900">{lead.lead_code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{lead.candidate_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {lead.candidate_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{lead.campaign_title}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {lead.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">{lead.ctv_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        {formatDate(lead.submitted_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        lead.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                        lead.status === 'approved' ? 'bg-green-100 text-green-700' :
                        lead.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {lead.status === 'submitted' && <Clock className="h-3 w-3" />}
                        {lead.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                        {lead.status === 'rejected' && <XCircle className="h-3 w-3" />}
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLead(lead)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Chi tiết Lead</h2>
                <button 
                  onClick={() => setSelectedLead(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Lead Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">Mã Lead</label>
                    <div className="font-mono font-medium">{selectedLead.lead_code}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Ứng viên</label>
                    <div className="font-medium">{selectedLead.candidate_name}</div>
                    <div className="text-sm text-slate-600">{selectedLead.candidate_phone}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Khu vực</label>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3" />
                      {selectedLead.district}, {selectedLead.province}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">Chiến dịch</label>
                    <div className="font-medium">{selectedLead.campaign_title}</div>
                    <div className="text-sm text-slate-600">{selectedLead.company_name}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">CTV</label>
                    <div className="font-medium">{selectedLead.ctv_name}</div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Gửi lúc</label>
                    <div className="text-sm">{formatDate(selectedLead.submitted_at)}</div>
                  </div>
                </div>
              </div>

              {/* Anti-Fraud Info */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Thông tin chống gian lận
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">IP:</span>{' '}
                    <span className="font-mono">{selectedLead.submitted_ip || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Thay đổi trạng thái:</span>{' '}
                    <span>{selectedLead.status_changes} lần</span>
                  </div>
                </div>
              </div>

              {/* Audit Actions */}
              {status === 'submitted' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lý do / Ghi chú
                    </label>
                    <textarea
                      value={auditReason}
                      onChange={(e) => setAuditReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                      placeholder="Nhập lý do phê duyệt, từ chối hoặc đánh dấu gian lận..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAudit('approve')}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Duyệt
                    </button>
                    <button
                      onClick={() => handleAudit('reject')}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Từ chối
                    </button>
                    <button
                      onClick={() => handleAudit('flag_fraud')}
                      disabled={processing}
                      className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Gian lận
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
