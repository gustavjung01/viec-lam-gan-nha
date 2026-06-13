import { Search, MapPin } from 'lucide-react';
import type { CTVAccount } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';

interface AdminCtvTabProps {
  ctvAccounts: CTVAccount[];
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onAction: (actionName: string, endpoint: string, body?: any) => void;
}

export function AdminCtvTab({ ctvAccounts, onSearch, onFilter, onAction }: AdminCtvTabProps) {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
            placeholder="Tìm theo tên, SĐT, Email..."
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <select
            onChange={(e) => onFilter(e.target.value)}
            className="block w-full rounded-xl border-0 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
            defaultValue="all"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="active">Đang hoạt động</option>
            <option value="blocked">Bị khóa</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={TH_CLASS}>Họ tên</th>
                <th scope="col" className={TH_CLASS}>Liên hệ</th>
                <th scope="col" className={TH_CLASS}>Khu vực</th>
                <th scope="col" className={TH_CLASS}>Trạng thái</th>
                <th scope="col" className={TH_CLASS}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {ctvAccounts.map((ctv) => (
                <tr key={ctv.id} className="hover:bg-slate-50 transition-colors">
                  <td className={TD_CLASS}>
                    <div className="font-medium text-slate-900">{ctv.name}</div>
                    <div className="text-slate-500 text-xs">Mã: {ctv.ctv_code}</div>
                  </td>
                  <td className={TD_CLASS}>
                    <div className="text-slate-900">{ctv.phone}</div>
                    {ctv.email && <div className="text-slate-500 text-xs">{ctv.email}</div>}
                  </td>
                  <td className={TD_CLASS}>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{ctv.province || '-'}</span>
                    </div>
                  </td>
                  <td className={TD_CLASS}>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${ctv.status === 'active' ? 'bg-green-100 text-green-800' :
                        ctv.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        ctv.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'}`}
                    >
                      {ctv.status === 'active' ? 'Hoạt động' :
                       ctv.status === 'pending' ? 'Chờ duyệt' :
                       ctv.status === 'rejected' ? 'Từ chối' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
                    {ctv.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onAction('Duyệt CTV', `/admin/ctv/${ctv.id}/approve`)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Lý do từ chối:');
                            if (reason) onAction('Từ chối CTV', `/admin/ctv/${ctv.id}/reject`, { reason });
                          }}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                    {ctv.status === 'active' && (
                       <button
                         onClick={() => {
                           const reason = prompt('Lý do khóa:');
                           if (reason) onAction('Khóa CTV', `/admin/ctv/${ctv.id}/block`, { reason });
                         }}
                         className="text-red-600 hover:text-red-900 font-medium"
                       >
                         Khóa
                       </button>
                    )}
                     {ctv.status === 'blocked' && (
                       <button
                         onClick={() => onAction('Mở khóa CTV', `/admin/ctv/${ctv.id}/unblock`)}
                         className="text-blue-600 hover:text-blue-900 font-medium"
                       >
                         Mở khóa
                       </button>
                    )}
                  </td>
                </tr>
              ))}
              {ctvAccounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Không tìm thấy CTV nào
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
