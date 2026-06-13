import { Link } from 'react-router-dom';
import type { JobPost } from '../lib/types';
import { JobCard } from './JobCard';
import { useJobs } from '../hooks/useJobs';
import { Loader2 } from 'lucide-react';

export function JobsSection({ onApply }: { onApply: (job: JobPost) => void }) {
  const { jobs, loading } = useJobs();
  
  // Use first 6 jobs as featured
  const featuredJobs = jobs.slice(0, 6);

  return (
    <section id="jobs" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-950 md:text-3xl">Việc làm nổi bật</h2>
          <p className="mt-1 text-slate-500">Không hiển thị tên công ty, chỉ dùng mã nội bộ để điều phối hồ sơ.</p>
        </div>
        <Link 
          to="/viec-lam"
          className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 md:block"
        >
          Xem tất cả
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featuredJobs.map((job: JobPost) => (
            <JobCard key={job.id} job={job} onApply={onApply} />
          ))}
        </div>
      )}
      
      <div className="mt-6 text-center md:hidden">
        <Link 
          to="/viec-lam"
          className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Xem tất cả việc làm
        </Link>
      </div>
    </section>
  );
}
