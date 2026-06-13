import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApplyModal } from '../components/ApplyModal';
import { JobCard } from '../components/JobCard';
import { useJobs } from '../hooks/useJobs';
import { AlertCircle, Briefcase, Building2, CheckCircle, ChevronLeft, Clock, Loader2, MapPin, Phone, Share2, ShieldCheck, Sparkles, Users } from 'lucide-react';

const API_URL = '/api';
const CANDIDATE_PROFILE_STORAGE_KEY = 'vieclamgannha_candidate_profile';

const iconByCategory = {
  'bao-ve': ShieldCheck,
  'lao-dong-pho-thong': Users,
  'tap-vu': Sparkles,
  'phu-kho': Building2,
  'kho-van': Building2,
  'giao-hang': Briefcase,
};

function readCandidateProfile() {
  try {
    return JSON.parse(localStorage.getItem(CANDIDATE_PROFILE_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function hasUsefulProfileData(profile: Record<string, unknown>) {
  return Object.values(profile || {}).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value === true;
    return String(value || '').trim().length > 0;
  });
}

export function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [sidebarSubmitted, setSidebarSubmitted] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [jobFitLoading, setJobFitLoading] = useState(false);
  const [jobFitError, setJobFitError] = useState<string | null>(null);
  const [jobFitResult, setJobFitResult] = useState<string>('');
  const [sidebarForm, setSidebarForm] = useState({
    fullName: '',
    phone: '',
    province: '',
    district: '',
    note: ''
  });
  
  const { jobs: liveJobs, loading: jobsLoading } = useJobs();
  const job = slug ? liveJobs.find((item: any) => item.slug === slug || item.id === slug) : undefined;

  const handleSidebarChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSidebarForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSidebarError(null);
  };

  const handleJobFitCheck = async () => {
    if (!job) return;

    const savedProfile = readCandidateProfile();
    const profile = hasUsefulProfileData(savedProfile)
      ? savedProfile
      : {
          desiredJob: job.category || job.categoryLabel || 'viec-lam',
          desiredArea: [job.district, job.province].filter(Boolean).join(', '),
          desiredShift: '',
          desiredSalary: '',
          note: 'Ứng viên chưa lưu hồ sơ tạm. Hãy đánh giá dựa trên tin việc và gợi ý các câu cần hỏi thêm.'
        };
    setJobFitError(null);
    setJobFitResult('');

    setJobFitLoading(true);
    try {
      const response = await fetch(`${API_URL}/candidates/job-fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          job: {
            id: job.id,
            slug: job.slug,
            title: job.title,
            category: job.category,
            categoryLabel: job.categoryLabel,
            province: job.province,
            district: job.district,
            salary: job.salary,
            companyCode: job.companyCode || 'PUBLIC',
            targetCode: job.targetCode || `PUBLIC_${job.slug || job.id}`,
          }
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Không thể kiểm tra việc này bằng AI');
      }

      setJobFitResult(result.data?.fit || 'AI không trả về nội dung kiểm tra.');
    } catch (err) {
      setJobFitError(err instanceof Error ? err.message : 'Không thể kiểm tra việc này bằng AI');
    } finally {
      setJobFitLoading(false);
    }
  };

  const handleSidebarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSidebarLoading(true);
    setSidebarError(null);

    try {
      const payload = {
        fullName: sidebarForm.fullName.trim(),
        phone: sidebarForm.phone.trim(),
        province: sidebarForm.province.trim(),
        district: sidebarForm.district.trim(),
        note: sidebarForm.note.trim() || undefined,
        jobId: job?.id,
        jobSlug: job?.slug,
        jobTitle: job?.title,
        companyCode: job?.companyCode || 'PUBLIC',
        targetCode: job?.targetCode || `PUBLIC_${job?.slug || job?.id}`,
      };

      const response = await fetch(`${API_URL}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gửi đơn thất bại');
      }

      setSidebarSubmitted(true);
    } catch (err) {
      setSidebarError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setSidebarLoading(false);
    }
  };

  const relatedJobs = job ? liveJobs.filter((item: any) => item.id !== job.id && item.category === job.category).slice(0, 3) : [];

  if (jobsLoading) {
    return (
      <main className="bg-slate-50 py-16">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải mô tả công việc...
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-brand-surface py-12">
        <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
          <h1 className="text-2xl font-bold text-slate-950">Không tìm thấy việc làm</h1>
          <p className="mt-2 text-slate-500">Tin tuyển dụng này không tồn tại hoặc đã hết hạn.</p>
          <Link to="/viec-lam" className="mt-6 inline-block rounded-xl bg-brand-navy px-6 py-3 font-bold text-white">
            Xem việc làm khác
          </Link>
        </div>
      </main>
    );
  }

  const Icon = iconByCategory[String(job.category || '') as keyof typeof iconByCategory] || Briefcase;

  return (
    <main className="min-h-screen bg-brand-surface pb-12">
      {applyModalOpen && <ApplyModal job={job} onClose={() => setApplyModalOpen(false)} />}
      
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <Link to="/viec-lam" className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-blue">
            <ChevronLeft className="h-4 w-4" /> Quay lại danh sách việc làm
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main content */}
          <div className="space-y-4">
            {/* Job header card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-50 text-brand-navy ring-1 ring-slate-100">
                  <Icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 border border-blue-100">
                        {job.categoryLabel}
                      </span>
                      <h1 className="mt-2 text-xl font-black text-slate-950 md:text-2xl">{job.title}</h1>
                    </div>
                    <button className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50">
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {job.district}, {job.province}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      Mã tin: {job.id}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="h-4 w-4 text-slate-400" />
                      Đăng 2 ngày trước
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                <div className="text-2xl font-black text-orange-600">{job.salary}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleJobFitCheck}
                    disabled={jobFitLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {jobFitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {jobFitLoading ? 'AI đang kiểm tra...' : 'AI kiểm tra việc này có hợp không'}
                  </button>
                  <button 
                    onClick={() => setApplyModalOpen(true)}
                    className="rounded-xl bg-brand-orange px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
                  >
                    Ứng tuyển nhanh
                  </button>
                </div>
              </div>

              {(jobFitError || jobFitResult) && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {jobFitError && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700 ring-1 ring-red-100">
                      {jobFitError}
                    </div>
                  )}
                  {jobFitResult && (
                    <div className="rounded-2xl bg-indigo-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-indigo-100">
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                        <Sparkles className="h-3.5 w-3.5" /> Gợi ý chỉ hiển thị cho bạn
                      </div>
                      <div className="whitespace-pre-line">{jobFitResult}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Job description */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">Mô tả công việc</h2>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• Làm việc theo ca, đảm bảo an ninh khu vực được phân công</li>
                <li>• Kiểm tra, giám sát người ra vào</li>
                <li>• Tuần tra định kỳ theo quy định</li>
                <li>• Báo cáo sự cố kịp thời cho cấp trên</li>
              </ul>
            </div>

            {/* Requirements */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">Yêu cầu cơ bản</h2>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• Nam từ 18 - 50 tuổi, sức khỏe tốt</li>
                <li>• Không có tiền án, tiền sự</li>
                <li>• Có tinh thần trách nhiệm, trung thực</li>
                <li>• Ưu tiên có kinh nghiệm, chưa có sẽ được đào tạo</li>
              </ul>
            </div>

            {/* Benefits */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-950">Quyền lợi</h2>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• Lương cạnh tranh theo thị trường</li>
                <li>• Đóng bảo hiểm đầy đủ theo quy định</li>
                <li>• Hỗ trợ cơm ca, xăng xe</li>
                <li>• Thưởng lễ, Tết, sinh nhật</li>
              </ul>
            </div>

            {/* Confidential notice */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Thông tin bảo mật:</strong> Tên công ty và địa điểm chi tiết được ẩn để bảo vệ quyền lợi ứng viên. 
                Hồ sơ ứng tuyển sẽ được gửi về đúng bộ phận tuyển dụng cho vị trí {job.title}.
              </p>
            </div>

            {/* Related jobs */}
            <div className="pt-4">
              <h2 className="text-lg font-bold text-slate-950">Việc làm liên quan</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {relatedJobs.map((relatedJob) => (
                  <JobCard key={relatedJob.id} job={relatedJob} onApply={() => setApplyModalOpen(true)} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Quick apply card */}
            <div className="sticky top-24 rounded-2xl bg-brand-navy p-5 text-white">
              {!sidebarSubmitted ? (
                <>
                  <h3 className="font-bold">Ứng tuyển nhanh</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Điền thông tin để nhà tuyển dụng liên hệ với bạn.
                  </p>

                  {sidebarError && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/20 p-2 text-xs text-red-200">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{sidebarError}</span>
                    </div>
                  )}
                  
                  <form onSubmit={handleSidebarSubmit} className="mt-4 space-y-3">
                    <input 
                      name="fullName"
                      type="text" 
                      value={sidebarForm.fullName}
                      onChange={handleSidebarChange}
                      required
                      disabled={sidebarLoading}
                      placeholder="Họ và tên *"
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/20 disabled:opacity-50"
                    />
                    <input 
                      name="phone"
                      type="tel" 
                      value={sidebarForm.phone}
                      onChange={handleSidebarChange}
                      required
                      disabled={sidebarLoading}
                      placeholder="Số điện thoại *"
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/20 disabled:opacity-50"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input 
                        name="province"
                        type="text" 
                        value={sidebarForm.province}
                        onChange={handleSidebarChange}
                        required
                        disabled={sidebarLoading}
                        placeholder="Tỉnh/TP *"
                        className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/20 disabled:opacity-50"
                      />
                      <input 
                        name="district"
                        type="text" 
                        value={sidebarForm.district}
                        onChange={handleSidebarChange}
                        required
                        disabled={sidebarLoading}
                        placeholder="Quận/Huyện *"
                        className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/20 disabled:opacity-50"
                      />
                    </div>
                    <textarea 
                      name="note"
                      value={sidebarForm.note}
                      onChange={handleSidebarChange}
                      disabled={sidebarLoading}
                      placeholder="Ghi chú"
                      rows={3}
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/20 resize-none disabled:opacity-50"
                    />
                    
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
                      Mã tin: {job.id}
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={sidebarLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange py-3 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {sidebarLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang gửi...
                        </>
                      ) : (
                        'Gửi thông tin'
                      )}
                    </button>
                  </form>
                  
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Thông tin của bạn được bảo mật.
                  </p>
                </>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20">
                    <CheckCircle className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-lg">Đã ghi nhận</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Bộ phận tuyển dụng sẽ liên hệ sớm.
                  </p>
                  <button 
                    onClick={() => setSidebarSubmitted(false)}
                    className="mt-4 text-sm text-brand-orange hover:text-orange-400 underline"
                  >
                    Ứng tuyển tin khác
                  </button>
                </div>
              )}
            </div>

            {/* Contact card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="font-bold text-slate-950">Liên hệ hỗ trợ</h3>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-4 w-4 text-brand-blue" />
                  Hotline: 1900 8888
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
