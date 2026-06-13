import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApplyModal } from '../components/ApplyModal';
import { JobCard } from '../components/JobCard';
import { SearchCategoryGrid } from '../components/SearchCategoryGrid';
import { categories, provinces } from '../data/mockData';
import type { JobPost } from '../lib/types';
import { Building2, ChevronDown, Filter, MapPin, Search, SlidersHorizontal, X, Loader2 } from 'lucide-react';
import { useJobs } from '../hooks/useJobs';

// Salary bucket values for filtering
const SALARY_BUCKETS = [
  { label: '5 - 7 triệu', value: '5-7', min: 5, max: 7 },
  { label: '7 - 10 triệu', value: '7-10', min: 7, max: 10 },
  { label: '10 - 15 triệu', value: '10-15', min: 10, max: 15 },
  { label: 'Trên 15 triệu', value: '15+', min: 15, max: Infinity },
];

const categoryLabels: Record<string, string> = {
  'bao-ve': 'Bảo vệ',
  'tap-vu': 'Tạp vụ',
  'kho-van': 'Kho / Xưởng',
  'giao-hang': 'Giao hàng',
  'ca-dem': 'Ca đêm',
  'lao-dong-pho-thong': 'Lao động phổ thông',
  'phu-kho': 'Phụ kho',
};

const tagLabels: Record<string, string> = {
  'gan-nha': 'Việc gần nhà',
  'co-cho-o-lai': 'Có chỗ ở lại',
};

// Extract districts from jobs list based on selected province
function getDistricts(jobs: JobPost[], province: string): string[] {
  if (!province || !jobs) return [];
  const districts = jobs
    .filter(j => (j.province || '').trim().toLowerCase() === province.trim().toLowerCase() && j.district)
    .map(j => j.district.trim());
  // Deduplicate and sort
  return [...new Set(districts)].sort();
}

// Parse salary number from "9.000.000đ/tháng" format
function parseSalary(salaryStr: string): number {
  if (!salaryStr) return 0;
  const numbers = salaryStr.replace(/[^\d]/g, '');
  return parseInt(numbers) || 0;
}

// Build active filter list for banner
interface ActiveFilter {
  key: string;
  label: string;
}

export function JobsPage() {
  const { jobs: allJobs, loading: jobsLoading } = useJobs();
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Read all filter params
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const province = searchParams.get('province') || '';
  const district = searchParams.get('district') || '';
  const salary = searchParams.get('salary') || '';
  const shift = searchParams.get('shift') || '';
  const tag = searchParams.get('tag') || '';

  // Local state for UI controls
  const [localQ, setLocalQ] = useState(q);
  const [localProvince, setLocalProvince] = useState(province);
  const [localDistrict, setLocalDistrict] = useState(district);
  const [localCategory, setLocalCategory] = useState(category);
  const [localSalary, setLocalSalary] = useState(salary);

  // Cascading: districts depend on province
  const availableDistricts = useMemo(() => getDistricts(allJobs, localProvince), [allJobs, localProvince]);

  // When province changes, reset district
  const handleProvinceChange = (val: string) => {
    setLocalProvince(val);
    setLocalDistrict(''); // reset district
  };

  // Apply all filters from params
  const filteredJobs = useMemo(() => {
    let jobs = allJobs;

    if (q) {
      const qLower = q.toLowerCase();
      jobs = jobs.filter((j: JobPost) =>
        j.title.toLowerCase().includes(qLower) ||
        j.province.toLowerCase().includes(qLower) ||
        j.district.toLowerCase().includes(qLower) ||
        j.categoryLabel.toLowerCase().includes(qLower)
      );
    }

    if (category) {
      jobs = jobs.filter((j: JobPost) => j.category === category);
    }

    if (province) {
      jobs = jobs.filter((j: JobPost) => (j.province || '').trim().toLowerCase() === province.trim().toLowerCase());
    }

    if (district) {
      jobs = jobs.filter((j: JobPost) => (j.district || '').trim().toLowerCase() === district.trim().toLowerCase());
    }

    if (salary) {
      const bucket = SALARY_BUCKETS.find(b => b.value === salary);
      if (bucket) {
        jobs = jobs.filter((j: JobPost) => {
          const s = parseSalary(j.salary);
          return s >= bucket.min * 1_000_000 && s < bucket.max * 1_000_000;
        });
      }
    }

    if (shift === 'ca-dem') {
      const s = (shift || '').toLowerCase();
      jobs = jobs.filter((j: JobPost) => {
        const jShift = (j.shift || '').toLowerCase();
        return jShift.includes('đêm') || jShift.includes('ngày/đêm');
      });
    }

    if (tag === 'gan-nha') {
      jobs = jobs.filter((j: JobPost) => {
        const haystack = [j.title, j.district, j.province, j.address || '', ...(j.tags || [])].join(' ').toLowerCase();
        return haystack.includes('gần nhà') || haystack.includes('gan nha');
      });
    }

    if (tag === 'co-cho-o-lai') {
      jobs = jobs.filter((j: JobPost) => {
        const haystack = [j.title, ...(j.tags || [])].join(' ').toLowerCase();
        return haystack.includes('chỗ ở lại') || haystack.includes('cho o lai') || haystack.includes('ở lại');
      });
    }

    return jobs;
  }, [allJobs, q, category, province, district, salary, shift, tag]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  
  // Clamp currentPage if filters reduce total pages below current page
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }

  const pagedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage]);

  // Generate pagination buttons
  const pageButtons = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pageButtons.push(i);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      pageButtons.push("...");
    }
  }
  const uniqueButtons = [...new Set(pageButtons)];

  // Build active filter badges
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];
    if (q) filters.push({ key: 'q', label: `"${q}"` });
    if (category) filters.push({ key: 'category', label: categoryLabels[category] || category });
    if (province) filters.push({ key: 'province', label: province });
    if (district) filters.push({ key: 'district', label: district });
    if (salary) {
      const bucket = SALARY_BUCKETS.find(b => b.value === salary);
      filters.push({ key: 'salary', label: bucket?.label || salary });
    }
    if (shift === 'ca-dem') filters.push({ key: 'shift', label: 'Ca đêm' });
    if (tag) filters.push({ key: 'tag', label: tagLabels[tag] || tag });
    return filters;
  }, [q, category, province, district, salary, shift, tag]);

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (localQ) params.set('q', localQ);
    if (localCategory) params.set('category', localCategory);
    if (localProvince) params.set('province', localProvince);
    if (localDistrict) params.set('district', localDistrict);
    if (localSalary) params.set('salary', localSalary);
    setSearchParams(params);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setLocalQ('');
    setLocalCategory('');
    setLocalProvince('');
    setLocalDistrict('');
    setLocalSalary('');
    setSearchParams(new URLSearchParams());
    setCurrentPage(1);
  };

  const handleRemoveFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    // Sync local state
    if (key === 'q') setLocalQ('');
    if (key === 'category') setLocalCategory('');
    if (key === 'province') { setLocalProvince(''); setLocalDistrict(''); }
    if (key === 'district') setLocalDistrict('');
    if (key === 'salary') setLocalSalary('');
    setSearchParams(params);
  };

  // Sync local province/district from URL on mount/change
  useState(() => {
    setLocalProvince(province);
    setLocalDistrict(district);
    setLocalCategory(category);
    setLocalSalary(salary);
    setLocalQ(q);
  });

  return (
    <main className="min-h-screen bg-brand-surface">
      {selectedJob && <ApplyModal job={selectedJob} onClose={() => setSelectedJob(null)} />}

      {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-950 font-medium">Việc làm</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* Search bar with working filters */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm việc làm..."
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={localProvince}
              onChange={(e) => handleProvinceChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 focus:border-brand-blue focus:outline-none"
            >
              <option value="">Tỉnh/Thành</option>
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={localCategory}
              onChange={(e) => setLocalCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 focus:border-brand-blue focus:outline-none"
            >
              <option value="">Ngành nghề</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={localSalary}
              onChange={(e) => setLocalSalary(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 focus:border-brand-blue focus:outline-none"
            >
              <option value="">Mức lương</option>
              {SALARY_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <button
              onClick={handleApplyFilters}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#0b2d57]"
            >
              <Search className="h-4 w-4" /> Tìm kiếm
            </button>
          </div>
        </div>

        {/* Active filters banner */}
        {activeFilters.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-navy/5 px-4 py-3 ring-1 ring-brand-navy/10">
            <span className="text-sm font-semibold text-brand-navy">Đang lọc:</span>
            {activeFilters.map(f => (
              <button
                key={f.key}
                onClick={() => handleRemoveFilter(f.key)}
                className="flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
              >
                {f.label} <X className="h-3 w-3" />
              </button>
            ))}
            <Link
              to="/viec-lam"
              onClick={handleResetFilters}
              className="ml-2 flex items-center gap-1 text-xs font-semibold text-brand-orange hover:text-orange-600"
            >
              <X className="h-3 w-3" /> Xóa tất cả
            </Link>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr_280px]">
          {/* Sidebar filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center gap-2 font-bold text-slate-950">
                <Filter className="h-5 w-5" /> Bộ lọc
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tỉnh/Thành phố</label>
                  <select
                    value={localProvince}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
                  >
                    <option value="">Tất cả</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Quận/Huyện</label>
                  <select
                    value={localDistrict}
                    onChange={(e) => setLocalDistrict(e.target.value)}
                    disabled={!localProvince}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue disabled:opacity-50"
                  >
                    <option value="">Tất cả</option>
                    {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Ngành nghề</label>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <label key={cat.value} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={localCategory === cat.value}
                          onChange={(e) => {
                            setLocalCategory(e.target.checked ? cat.value : '');
                            setTimeout(handleApplyFilters, 0);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Mức lương</label>
                  <div className="space-y-2">
                    {SALARY_BUCKETS.map((bucket) => (
                      <label key={bucket.value} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={localSalary === bucket.value}
                          onChange={(e) => {
                            setLocalSalary(e.target.checked ? bucket.value : '');
                            setTimeout(handleApplyFilters, 0);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                        />
                        {bucket.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleResetFilters}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            </div>
          </aside>

          {/* Job list */}
          <div>
            <SearchCategoryGrid />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-black text-slate-950 md:text-2xl">
                {activeFilters.length > 0 ? `Kết quả lọc (${filteredJobs.length})` : 'Việc làm phù hợp'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>Tìm thấy <strong className="text-slate-950">{filteredJobs.length}</strong> việc làm</span>
                <select className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <option>Mới nhất</option>
                  <option>Lương cao nhất</option>
                  <option>Gần nhất</option>
                </select>
              </div>
            </div>

            {/* Empty state */}
            {jobsLoading ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                <p className="mt-4 text-slate-500">Đang tải danh sách việc làm...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-slate-500">Không tìm thấy việc làm phù hợp.</p>
                <Link
                  to="/viec-lam"
                  onClick={handleResetFilters}
                  className="mt-4 inline-block rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0b2d57]"
                >
                  Xem tất cả việc làm
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {pagedJobs.map((job: JobPost) => (
                  <JobCard key={job.id} job={job} onApply={setSelectedJob} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >Trước</button>
                {uniqueButtons.map((btn, i) => (
                  btn === "..." ? (
                    <span key={`dots-${i}`} className="px-2 text-slate-500">...</span>
                  ) : (
                    <button 
                      key={btn} 
                      onClick={() => setCurrentPage(Number(btn))}
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${currentPage === btn ? 'bg-brand-navy font-bold text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {btn}
                    </button>
                  )
                ))}
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >Sau</button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl bg-brand-navy p-5 text-white">
                <h3 className="font-bold">Bạn cần hỗ trợ?</h3>
                <p className="mt-2 text-sm text-slate-300">Liên hệ bộ phận tuyển dụng để được tư vấn.</p>
                <button className="mt-4 w-full rounded-xl bg-brand-orange py-2.5 text-sm font-bold hover:bg-orange-600">
                  Liên hệ ngay
                </button>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="font-bold text-slate-950">Việc làm đã xem</h3>
                <div className="mt-3 space-y-3">
                  {allJobs.slice(0, 3).map((job: JobPost) => (
                    <Link
                      key={job.id}
                      to={`/viec-lam/${job.id}`}
                      className="block rounded-xl border border-slate-100 p-3 hover:border-brand-blue hover:shadow-sm"
                    >
                      <div className="font-semibold text-sm text-slate-950 line-clamp-1">{job.title}</div>
                      <div className="mt-1 text-xs text-orange-600 font-semibold">{job.salary}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}