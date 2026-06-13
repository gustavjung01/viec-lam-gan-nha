import { Link } from 'react-router-dom';
import { Briefcase, Building2, MapPin, ShieldCheck, Sparkles, Users, Eye } from 'lucide-react';
import type { JobCategory, JobPost } from '../lib/types';

const iconByCategory: Record<string, typeof ShieldCheck> = {
  'bao-ve': ShieldCheck,
  'lao-dong-pho-thong': Users,
  'tap-vu': Sparkles,
  'phu-kho': Building2,
  'kho-van': Building2,
  'giao-hang': Briefcase,
  'khac': Briefcase,
};

const colorByCategory: Record<string, string> = {
  'bao-ve': 'bg-blue-50 text-blue-700 border-blue-100',
  'lao-dong-pho-thong': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'tap-vu': 'bg-orange-50 text-orange-700 border-orange-100',
  'phu-kho': 'bg-violet-50 text-violet-700 border-violet-100',
  'kho-van': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'giao-hang': 'bg-rose-50 text-rose-700 border-rose-100',
  'khac': 'bg-slate-50 text-slate-700 border-slate-200',
};

export function JobCard({ job, onApply }: { job: JobPost; onApply: (job: JobPost) => void }) {
  const Icon = iconByCategory[job.category] || Briefcase;
  const color = colorByCategory[job.category] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <article className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
      {/* Top: Icon + Category + Salary */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-brand-navy ring-1 ring-slate-100">
              <Icon className="h-4 w-4" />
            </div>
            <span className={`truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${color}`}>{job.categoryLabel}</span>
          </div>
          <div className="text-right text-xs font-bold text-orange-600 shrink-0">{job.salary}</div>
        </div>
      </div>

      {/* Middle: Title + Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-slate-950 leading-snug">{job.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1 whitespace-nowrap"><Building2 className="h-3 w-3 shrink-0" />{job.companyPublicName || 'Đơn vị đang xác minh'}</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><MapPin className="h-3 w-3 shrink-0" />{job.district}</span>
        </div>
        {job.shift && (
          <div className="mt-0.5 text-xs text-slate-400">{job.shift}</div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {job.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tag}</span>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <Link
          to={`/viec-lam/${job.slug}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Eye className="h-3 w-3 shrink-0" /> Chi tiết
        </Link>
        <button
          onClick={() => onApply(job)}
          className="flex flex-1 items-center justify-center rounded-lg bg-brand-navy px-3 py-2 text-xs font-medium text-white hover:bg-[#0b2d57]"
        >
          Ứng tuyển
        </button>
      </div>
    </article>
  );
}