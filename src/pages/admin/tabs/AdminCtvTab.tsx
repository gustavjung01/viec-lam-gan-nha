import { useMemo, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import type { CTVAccount } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';
import { AdminFilterBar } from '../components/AdminFilterBar';

interface AdminCtvTabProps {
  ctvAccounts: CTVAccount[];
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onAction: (actionName: string, endpoint: string, body?: any) => void;
}

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  province: '',
  district: '',
};

function safeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function statusLabel(status: string) {
  return ({ active: 'Hoạt động', pending: 'Chờ duyệt', rejected: 'Từ chối', blocked: 'Bị khóa' } as Record<string, string>)[status] || status;
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-800';
}

export function AdminCtvTab({ ctvAccounts, onSearch, onFilter, onAction }: AdminCtvTabProps) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filteredCtvAccounts = useMemo(() => {
    const q = safeText(filters.search);
    const province = safeText(filters.province);
    const district = safeText(filters.district);
    return ctvAccounts.filter((ctv) => {
      const matchesSearch = !q || [ctv.name, ctv.phone, ctv.email, ctv.ctv_code].some((value) => safeText(value).includes(q));
      const matchesStatus = filters.status === 'all' || ctv.status === filters.status;
      const matchesProvince = !province || safeText(ctv.province).includes(province);
      const matchesDistrict = !district || safeText(ctv.district).includes(district);
      return matchesSearch && matchesStatus && matchesProvince && matchesDistrict;
    });
  }, [ctvAccounts, filters]);

  const updateFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key === 'search') onSearch(value);
    if (key === 'status') onFilter(value);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    onSearch('');
    onFilter('all');
  };

  const actionButtons = (ctv: CTVAccount) => (
    <div className="flex flex-wrap gap-2">
      {ctv.status === 'pending' && (
        <>
          <button onClick={() => onAction('Duyệt CTV', `/admin/ctv/${ctv.id}/approve`)} className="min-h-10 rounded-xl bg-green-50 px-3 text-sm font-bold text-green-700">Duyệt</button>
          <button onClick={() => { const reason = prompt('Lý do từ chối:'); if (reason) onAction('Từ chối CTV', `/admin/ctv/${ctv.id}/reject`, { reason }); }} className="min-h-10 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700">Từ chối</button>
        </>
      )}
      {ctv.status === 'active' && (
        <button onClick={() => { const reason = prompt('Lý do khóa:'); if (reason) onAction('Khóa CTV', `/admin/ctv/${ctv.id}/block`, { reason }); }} className="min-h-10 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700">Khóa</button>
      )}
      {ctv.status === 'blocked' && (
        <button onClick={() => onAction('Mở khóa CTV', `/admin/ctv/${ctv.id}/unblock`)} className="min-h-10 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700">Mở khóa</button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminFilterBar
        title="Bộ lọc CTV"
        count={filteredCtvAccounts.length}
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'search', value: filters.search, placeholder: 'Tên, SĐT, email, mã CTV' },
          { key: 'status', label: 'Trạng thái', type: 'select', value: filters.status, options: [
            { value: 'all', label: 'Tất cả trạng thái' },
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'blocked', label: 'Bị khóa' },
            { value: 'rejected', label: 'Từ chối' },
          ]},
          { key: 'province', label: 'Tỉnh/Thành', type: 'text', value: filters.province, placeholder: 'TP.HCM, Hà Nội...' },
          { key: 'district', label: 'Quận/Huyện', type: 'text', value: filters.district, placeholder: 'Quận/Huyện' },
        ]}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      <div className="grid gap-3 md:hidden">
        {filteredCtvAccounts.map((ctv) => (
          <article key={ctv.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{ctv.name}</h3>
                <p className="font-mono text-xs text-slate-500">{ctv.ctv_code}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(ctv.status)}`}>{statusLabel(ctv.status)}</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{ctv.phone || '-'}</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{[ctv.district, ctv.province].filter(Boolean).join(', ') || '-'}</div>
              {ctv.email && <p className="truncate text-xs text-slate-500">{ctv.email}</p>}
            </div>
            <div className="mt-4">{actionButtons(ctv)}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr><th className={TH_CLASS}>Họ tên</th><th className={TH_CLASS}>Liên hệ</th><th className={TH_CLASS}>Khu vực</th><th className={TH_CLASS}>Trạng thái</th><th className={TH_CLASS}>Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredCtvAccounts.map((ctv) => (
                <tr key={ctv.id} className="transition-colors hover:bg-slate-50">
                  <td className={TD_CLASS}><div className="font-medium text-slate-900">{ctv.name}</div><div className="text-xs text-slate-500">Mã: {ctv.ctv_code}</div></td>
                  <td className={TD_CLASS}><div className="text-slate-900">{ctv.phone}</div>{ctv.email && <div className="text-xs text-slate-500">{ctv.email}</div>}</td>
                  <td className={TD_CLASS}><div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /><span>{ctv.province || '-'}</span></div>{ctv.district && <div className="ml-5 text-xs text-slate-500">{ctv.district}</div>}</td>
                  <td className={TD_CLASS}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(ctv.status)}`}>{statusLabel(ctv.status)}</span></td>
                  <td className={TD_CLASS}>{actionButtons(ctv)}</td>
                </tr>
              ))}
              {filteredCtvAccounts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy CTV nào</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
