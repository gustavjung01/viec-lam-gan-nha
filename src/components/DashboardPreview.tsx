import { Briefcase, Eye, Users } from 'lucide-react';
import { featuredJobs } from '../data/mockData';

const stats = [
  ['Lượt xem tin', '12.450', '+18%', Eye],
  ['Lượt ứng tuyển', '1.256', '+22%', Users],
  ['Tin đang bật', '18', '+5%', Briefcase],
] as const;

export function DashboardPreview() {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-950">Dashboard công ty</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">7 ngày qua</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {stats.map(([label, value, growth, Icon]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <Icon className="mb-3 h-5 w-5 text-blue-700" />
            <div className="text-sm font-semibold text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
            <div className="mt-1 text-xs font-bold text-emerald-600">{growth}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500">
          <div>Tin tuyển</div><div>Mã</div><div>Ứng tuyển</div><div>Trạng thái</div>
        </div>
        {featuredJobs.slice(0, 3).map((job, index) => (
          <div key={job.id} className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800">{job.title}</div>
            <div className="text-slate-500">{job.companyCode} - {job.targetCode}</div>
            <div className="font-bold text-slate-900">{126 - index * 28}</div>
            <div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Đang bật</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
