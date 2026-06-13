import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Sparkles, X } from 'lucide-react';
import type { JobPost } from '../lib/types';
import { getDistrictOptions, PROVINCE_OPTIONS, resolveProvinceDistrict } from '../lib/vietnamLocations';

const API_URL = '/api';
const CANDIDATE_PROFILE_STORAGE_KEY = 'vieclamgannha_candidate_profile';

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

export function ApplyModal({ job, onClose }: { job?: JobPost | null; onClose: () => void }) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    province: '',
    district: '',
    note: ''
  });

  const districtOptions = useMemo(() => getDistrictOptions(formData.province), [formData.province]);
  const districtSelectOptions = useMemo(() => {
    if (formData.district && !districtOptions.includes(formData.district)) {
      return [formData.district, ...districtOptions];
    }
    return districtOptions;
  }, [districtOptions, formData.district]);

  useEffect(() => {
    if (!job) return;

    const resolved = resolveProvinceDistrict(job.province, job.district);
    setFormData(prev => ({
      ...prev,
      province: prev.province || resolved.province,
      district: prev.district || resolved.district,
    }));
  }, [job?.province, job?.district]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => (
      name === 'province'
        ? { ...prev, province: value, district: '' }
        : { ...prev, [name]: value }
    ));
    setError(null);
    if (name === 'note') setNoteMessage(null);
  };

  const handleGenerateNote = async () => {
    if (!job) return;

    const profile = readCandidateProfile();
    setError(null);
    setNoteMessage(null);

    if (!hasUsefulProfileData(profile) && !formData.fullName.trim() && !formData.province.trim() && !formData.district.trim()) {
      setError('Bạn cần điền hồ sơ trong Tài khoản hoặc nhập thông tin ứng tuyển trước khi AI viết ghi chú.');
      return;
    }

    setIsGeneratingNote(true);
    try {
      const response = await fetch(`${API_URL}/candidates/application-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          form: {
            fullName: formData.fullName.trim(),
            province: formData.province.trim(),
            district: formData.district.trim(),
            note: formData.note.trim(),
          },
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
        throw new Error(result.message || result.error || 'Không thể viết ghi chú bằng AI');
      }

      const note = String(result.data?.note || '').trim().slice(0, 500);
      if (!note) throw new Error('AI chưa trả về ghi chú phù hợp.');

      setFormData(prev => ({ ...prev, note }));
      setNoteMessage('AI đã viết ghi chú. Bạn có thể sửa lại trước khi gửi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể viết ghi chú bằng AI');
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        province: formData.province.trim(),
        district: formData.district.trim(),
        note: formData.note.trim() || undefined,
        jobId: job?.id,
        jobSlug: job?.slug,
        jobTitle: job?.title,
        companyCode: job?.companyCode || 'PUBLIC',
        targetCode: job?.targetCode || `PUBLIC_${job?.slug || job?.id}`,
      };

      const response = await fetch(`${API_URL}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gửi đơn thất bại, vui lòng thử lại');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {!isSubmitted ? (
          <>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950">Ứng tuyển nhanh</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {job ? `Ứng tuyển: ${job.title}` : 'Điền thông tin để nhà tuyển dụng liên hệ với bạn.'}
                </p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng popup">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {noteMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{noteMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Họ và tên *</span>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:opacity-60"
                  placeholder="Nhập họ và tên"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Số điện thoại *</span>
                <input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:opacity-60"
                  placeholder="Nhập số điện thoại"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Khu vực làm việc *</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:opacity-60"
                  >
                    <option value="">Chọn tỉnh/TP</option>
                    {PROVINCE_OPTIONS.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    required
                    disabled={isLoading || !formData.province}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:opacity-60"
                  >
                    <option value="">Chọn quận/huyện</option>
                    {districtSelectOptions.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="block text-sm font-semibold text-slate-700">Ghi chú</span>
                  <button
                    type="button"
                    onClick={handleGenerateNote}
                    disabled={isLoading || isGeneratingNote}
                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isGeneratingNote ? 'Đang viết...' : 'AI viết ghi chú'}
                  </button>
                </div>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  maxLength={500}
                  disabled={isLoading}
                  className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:opacity-60"
                  placeholder="Nhập ghi chú nếu có"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>AI chỉ viết nháp, bạn nên đọc lại trước khi gửi.</span>
                  <span>{formData.note.length}/500</span>
                </div>
              </label>

              <button
                type="submit"
                disabled={isLoading || isGeneratingNote}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 py-3 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  'Gửi thông tin'
                )}
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-slate-400">Thông tin của bạn được bảo mật.</p>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-950">Đã ghi nhận thông tin</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bộ phận tuyển dụng sẽ liên hệ sớm.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-brand-navy px-6 py-3 font-bold text-white hover:bg-[#0b2d57]"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
