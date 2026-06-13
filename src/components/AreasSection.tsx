import { Building2 } from 'lucide-react';
import { areas } from '../data/mockData';

export function AreasSection() {
  return (
    <section id="areas" className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-950">Tìm việc theo khu vực</h2>
          <button className="text-sm font-bold text-blue-700">Xem tất cả</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {areas.map((area) => (
            <button key={area.slug} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-orange-200 hover:bg-orange-50">
              <Building2 className="mb-2 h-5 w-5 text-brand-navy" />
              <div className="text-sm font-bold text-slate-900">{area.name}</div>
              <div className="text-xs text-slate-500">{area.countLabel}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
