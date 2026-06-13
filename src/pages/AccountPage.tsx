import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UserButton, SignInButton, useAuth, useUser } from '@clerk/clerk-react';
import { User, ArrowRight, Save, CheckCircle, Ruler, Weight, Heart, Briefcase, Shield, Package, Users, Clock, FileText, Car, Home, Award, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { copyTextToClipboard, isInAppBrowser, openExternalUrl } from '../lib/browser';

interface CandidateProfile {
  fullName: string;
  phone: string;
  zalo: string;
  birthYear: string;
  gender: string;
  area: string;
  height: string;
  weight: string;
  health: string;
  canStandLong: string;
  canNightShift: string;
  can12hShift: string;
  desiredJob: string;
  desiredArea: string;
  desiredShift: string;
  desiredSalary: string;
  availableDate: string;
  hasGuardExperience: string;
  yearsExperience: string;
  lastJob: string;
  skills: string[];
  hasCCCD: boolean;
  hasResume: boolean;
  hasMotorbike: boolean;
  canStayAtWork: boolean;
  hasGuardCertificate: boolean;
}

const defaultProfile: CandidateProfile = {
  fullName: '', phone: '', zalo: '', birthYear: '', gender: '', area: '',
  height: '', weight: '', health: '', canStandLong: '', canNightShift: '', can12hShift: '',
  desiredJob: '', desiredArea: '', desiredShift: '', desiredSalary: '', availableDate: '',
  hasGuardExperience: '', yearsExperience: '', lastJob: '', skills: [],
  hasCCCD: false, hasResume: false, hasMotorbike: false, canStayAtWork: false, hasGuardCertificate: false,
};

const STORAGE_KEY = 'vieclamgannha_candidate_profile';
const INTENT_STORAGE_KEY = 'vieclamgannha_account_intent';

function InAppBrowserLoginNotice() {
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '/tai-khoan';
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [openState, setOpenState] = useState<'idle' | 'opened' | 'blocked'>('idle');

  const handleCopyLink = async () => {
    try {
      const copied = await copyTextToClipboard(pageUrl);
      setCopyState(copied ? 'copied' : 'error');
    } catch {
      setCopyState('error');
    }
  };

  const handleOpenExternal = () => {
    const opened = openExternalUrl(pageUrl);
    setOpenState(opened ? 'opened' : 'blocked');
  };

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="font-medium text-slate-950">Tài khoản</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
            <Shield className="h-7 w-7 text-amber-600" />
          </div>

          <h1 className="text-3xl font-black text-slate-950">Không đăng nhập được trong Messenger</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Google chặn đăng nhập trong trình duyệt nhúng của Messenger/Facebook. Hãy mở trang bằng Safari hoặc Chrome để đăng nhập tài khoản.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Bạn đang mở trang trong Messenger. Để đăng nhập Google/Facebook, hãy bấm dấu ... hoặc nút chia sẻ, rồi chọn Mở trong Safari/Chrome.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#0b2d57]"
            >
              Sao chép liên kết
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Thử mở bằng trình duyệt ngoài
            </button>
            <Link
              to="/viec-lam"
              className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-center text-sm font-semibold text-brand-blue hover:bg-brand-blue/10"
            >
              Tiếp tục ứng tuyển không cần đăng nhập
            </Link>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {copyState === 'copied' && (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
                Đã sao chép liên kết. Dán vào Safari hoặc Chrome để đăng nhập.
              </div>
            )}
            {copyState === 'error' && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-700">
                Không thể sao chép tự động. Hãy giữ và chép lại liên kết trang.
              </div>
            )}
            {openState === 'blocked' && (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-600">
                Trình duyệt nhúng không hỗ trợ mở ngoài. Hãy sao chép liên kết rồi mở thủ công.
              </div>
            )}
            {openState === 'opened' && (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
                Đang thử mở trình duyệt ngoài.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignedOutView() {
  const [searchParams] = useSearchParams();
  const inAppBrowser = isInAppBrowser();

  const handleModeClick = (mode: 'candidate' | 'company' | 'ctv') => {
    localStorage.setItem(INTENT_STORAGE_KEY, mode);
  };

  // Pre-select mode from URL param tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ctv') handleModeClick('ctv');
    else if (tab === 'company' || tab === 'employer') handleModeClick('company');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (inAppBrowser) {
    return <InAppBrowserLoginNotice />;
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-950 font-medium">Tài khoản</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-black text-slate-950">Đăng nhập một lần để dùng VIECLAMGANNHA.ME</h1>
          <p className="mt-4 text-lg text-slate-600">Một tài khoản có thể dùng để tìm việc, làm CTV tuyển dụng hoặc đại diện công ty tuyển dụng.</p>
        </div>

        <div className="mb-8 flex justify-center">
          <SignInButton mode="modal">
            <button
              onClick={() => handleModeClick('candidate')}
              className="rounded-xl bg-brand-navy px-8 py-3 font-bold text-white hover:bg-[#0b2d57]"
            >
              Đăng nhập / Đăng ký
            </button>
          </SignInButton>
        </div>

        <div className="mb-8 text-center text-sm text-slate-600">
          Hoặc chọn nhu cầu của bạn:
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <SignInButton mode="modal">
            <button
              onClick={() => handleModeClick('candidate')}
              className="group rounded-2xl border-2 border-slate-200 bg-white p-0 text-left transition hover:border-brand-blue hover:shadow-lg overflow-hidden"
            >
              <img
                src="/images/account/role-job-seeker.png"
                alt="Tìm việc"
                className="w-full object-cover"
                style={{ height: '120px' }}
              />
              <div className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <User className="h-6 w-6 text-brand-blue" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">Tôi muốn tìm việc</h3>
                <p className="mt-2 text-sm text-slate-600">Tìm kiếm và ứng tuyển các vị trí việc làm phù hợp</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-blue group-hover:gap-3">
                  Tiếp tục <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </SignInButton>

          <SignInButton mode="modal">
            <button
              onClick={() => handleModeClick('ctv')}
              className="group rounded-2xl border-2 border-slate-200 bg-white p-0 text-left transition hover:border-brand-blue hover:shadow-lg overflow-hidden"
            >
              <img
                src="/images/account/role-ctv.png"
                alt="CTV tuyển dụng"
                className="w-full object-cover"
                style={{ height: '120px' }}
              />
              <div className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">Tôi muốn làm CTV</h3>
                <p className="mt-2 text-sm text-slate-600">Gửi ứng viên và kiếm hoa hồng</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-green-600 group-hover:gap-3">
                  Tiếp tục <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </SignInButton>

          <SignInButton mode="modal">
            <button
              onClick={() => handleModeClick('company')}
              className="group rounded-2xl border-2 border-slate-200 bg-white p-0 text-left transition hover:border-brand-blue hover:shadow-lg overflow-hidden"
            >
              <img
                src="/images/account/role-company.png"
                alt="Công ty tuyển dụng"
                className="w-full object-cover"
                style={{ height: '120px' }}
              />
              <div className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <Briefcase className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">Tôi là công ty tuyển dụng</h3>
                <p className="mt-2 text-sm text-slate-600">Đăng tuyển vị trí và quản lý ứng viên</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-purple-600 group-hover:gap-3">
                  Tiếp tục <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}

function CandidateProfileForm() {
  const [profile, setProfile] = useState<CandidateProfile>(defaultProfile);
  const [saved, setSaved] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const handleChange = (field: keyof CandidateProfile, value: string | boolean) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setAiError(null);
  };

  const handleSkillToggle = (skill: string) => {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion('');

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      const response = await fetch('/api/candidates/profile/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Không thể tạo gợi ý hồ sơ bằng AI');
      }

      setAiSuggestion(result.data?.suggestion || 'AI chưa trả về nội dung gợi ý.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể tạo gợi ý hồ sơ bằng AI');
    } finally {
      setAiLoading(false);
    }
  };

  const calculateAge = () => {
    if (!profile.birthYear) return null;
    const year = parseInt(profile.birthYear);
    if (isNaN(year)) return null;
    return new Date().getFullYear() - year;
  };

  const age = calculateAge();
  const genderLabel = profile.gender === 'nam' ? 'Nam' : profile.gender === 'nữ' ? 'Nữ' : '';

  const jobLabels: Record<string, string> = {
    'bao-ve': 'Bảo vệ', 'tap-vu': 'Tạp vụ', 'kho': 'Kho', 'giao-hang': 'Giao hàng', 'lao-dong': 'Lao động phổ thông', 'khac': 'Khác'
  };
  const shiftLabels: Record<string, string> = {
    'ca-ngay': 'Ca ngày', 'ca-dem': 'Ca đêm', '12-tieng': '12 tiếng', 'xoay-ca': 'Xoay ca', 'linhhoat': 'Linh hoạt'
  };

  const previewLines = [
    age ? `${genderLabel || 'Chưa rõ'}, ${age} tuổi` : null,
    (profile.height || profile.weight) ? `Cao ${profile.height || '?'}cm, nặng ${profile.weight || '?'}kg` : null,
    profile.area ? `Khu vực: ${profile.area}` : null,
    profile.desiredJob ? `Mong muốn: ${jobLabels[profile.desiredJob] || profile.desiredJob}` : null,
    profile.desiredShift ? `Ca: ${shiftLabels[profile.desiredShift] || profile.desiredShift}` : null,
    profile.desiredSalary ? `Lương: ${profile.desiredSalary}` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            {/* A. Thông tin cơ bản */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950">
                <User className="h-5 w-5 text-brand-navy" /> Thông tin cơ bản
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Họ tên *</span>
                  <input type="text" value={profile.fullName} onChange={e => handleChange('fullName', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Nhập họ tên" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Số điện thoại *</span>
                  <input type="tel" value={profile.phone} onChange={e => handleChange('phone', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="0xxx xxx xxx" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Zalo</span>
                  <input type="text" value={profile.zalo} onChange={e => handleChange('zalo', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Số Zalo" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Năm sinh</span>
                  <input type="number" value={profile.birthYear} onChange={e => handleChange('birthYear', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="1995" min="1960" max="2010" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Giới tính</span>
                  <select value={profile.gender} onChange={e => handleChange('gender', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                    <option value="">Chọn</option>
                    <option value="nam">Nam</option>
                    <option value="nu">Nữ</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Khu vực đang ở</span>
                  <input type="text" value={profile.area} onChange={e => handleChange('area', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Quận/Huyện, TP" />
                </label>
              </div>
            </div>

            {/* B. Thể trạng / phù hợp mục tiêu */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-950">
                <Heart className="h-5 w-5 text-brand-navy" /> Thể trạng & điều kiện làm việc
              </h2>
              <p className="mb-4 text-xs text-slate-500">Thông tin này giúp hệ thống gợi ý vị trí bảo vệ phù hợp hơn.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <Ruler className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500">Chiều cao</span>
                    <div className="flex items-center gap-1">
                      <input type="number" value={profile.height} onChange={e => handleChange('height', e.target.value)}
                        className="w-16 bg-transparent text-sm font-semibold text-slate-950 outline-none" placeholder="170" />
                      <span className="text-xs text-slate-500">cm</span>
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <Weight className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <span className="text-xs text-slate-500">Cân nặng</span>
                    <div className="flex items-center gap-1">
                      <input type="number" value={profile.weight} onChange={e => handleChange('weight', e.target.value)}
                        className="w-16 bg-transparent text-sm font-semibold text-slate-950 outline-none" placeholder="65" />
                      <span className="text-xs text-slate-500">kg</span>
                    </div>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Sức khỏe</span>
                  <select value={profile.health} onChange={e => handleChange('health', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                    <option value="">Chọn</option>
                    <option value="tot">Tốt</option>
                    <option value="trungbinh">Trung bình</option>
                    <option value="cohanche">Có hạn chế</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-600">Đứng lâu</span>
                  <div className="flex gap-1">
                    {['Có', 'Không'].map(opt => (
                      <button key={opt} onClick={() => handleChange('canStandLong', opt.toLowerCase())}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${profile.canStandLong === opt.toLowerCase() ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-600">Đi ca đêm</span>
                  <div className="flex gap-1">
                    {['Có', 'Không'].map(opt => (
                      <button key={opt} onClick={() => handleChange('canNightShift', opt.toLowerCase())}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${profile.canNightShift === opt.toLowerCase() ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-600">Trực 12 tiếng</span>
                  <div className="flex gap-1">
                    {['Có', 'Không'].map(opt => (
                      <button key={opt} onClick={() => handleChange('can12hShift', opt.toLowerCase())}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${profile.can12hShift === opt.toLowerCase() ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* C. Nhu cầu tìm việc */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950">
                <Briefcase className="h-5 w-5 text-brand-navy" /> Nhu cầu tìm việc
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Việc muốn làm</span>
                  <select value={profile.desiredJob} onChange={e => handleChange('desiredJob', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                    <option value="">Chọn loại việc</option>
                    <option value="bao-ve">Bảo vệ</option>
                    <option value="tap-vu">Tạp vụ</option>
                    <option value="kho">Kho</option>
                    <option value="giao-hang">Giao hàng</option>
                    <option value="lao-dong">Lao động phổ thông</option>
                    <option value="khac">Khác</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Khu vực muốn làm</span>
                  <input type="text" value={profile.desiredArea} onChange={e => handleChange('desiredArea', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Quận/Huyện, TP" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Ca mong muốn</span>
                  <select value={profile.desiredShift} onChange={e => handleChange('desiredShift', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                    <option value="">Chọn ca</option>
                    <option value="ca-ngay">Ca ngày</option>
                    <option value="ca-dem">Ca đêm</option>
                    <option value="12-tieng">12 tiếng</option>
                    <option value="xoay-ca">Xoay ca</option>
                    <option value="linhhoat">Linh hoạt</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Lương mong muốn</span>
                  <input type="text" value={profile.desiredSalary} onChange={e => handleChange('desiredSalary', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="7-8 triệu" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Có thể đi làm từ ngày</span>
                  <input type="date" value={profile.availableDate} onChange={e => handleChange('availableDate', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" />
                </label>
              </div>
            </div>

            {/* D. Kinh nghiệm */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950">
                <Award className="h-5 w-5 text-brand-navy" /> Kinh nghiệm
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Đã từng làm bảo vệ?</span>
                  <select value={profile.hasGuardExperience} onChange={e => handleChange('hasGuardExperience', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue">
                    <option value="">Chọn</option>
                    <option value="co">Có</option>
                    <option value="chua">Chưa</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Số năm kinh nghiệm</span>
                  <input type="number" value={profile.yearsExperience} onChange={e => handleChange('yearsExperience', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="0" min="0" max="30" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Nơi từng làm / mục tiêu</span>
                  <input type="text" value={profile.lastJob} onChange={e => handleChange('lastJob', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Khu công nghiệp, trung tâm thương mại..." />
                </label>
              </div>
              <div className="mt-4">
                <span className="mb-2 block text-sm font-medium text-slate-700">Kỹ năng đã có</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'truc-cong', label: 'Trực cổng', icon: Shield },
                    { id: 'giu-xe', label: 'Giữ xe', icon: Car },
                    { id: 'tuan-tra', label: 'Tuần tra', icon: Users },
                    { id: 'kho', label: 'Kho', icon: Package },
                    { id: 'tap-vu', label: 'Tạp vụ', icon: Briefcase },
                    { id: 'giao-tiep', label: 'Giao tiếp khách hàng', icon: Users },
                  ].map(skill => (
                    <button key={skill.id} onClick={() => handleSkillToggle(skill.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${profile.skills.includes(skill.id) ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <skill.icon className="h-3.5 w-3.5" /> {skill.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* E. Giấy tờ / điều kiện */}
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950">
                <FileText className="h-5 w-5 text-brand-navy" /> Giấy tờ & điều kiện
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: 'hasCCCD', label: 'Có CCCD', icon: FileText },
                  { key: 'hasResume', label: 'Có hồ sơ xin việc', icon: FileText },
                  { key: 'hasMotorbike', label: 'Có xe máy', icon: Car },
                  { key: 'canStayAtWork', label: 'Có thể ở lại chỗ làm', icon: Home },
                  { key: 'hasGuardCertificate', label: 'Có chứng chỉ bảo vệ', icon: Award },
                ].map(item => (
                  <label key={item.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <input type="checkbox" checked={profile[item.key as keyof CandidateProfile] as boolean}
                      onChange={e => handleChange(item.key as keyof CandidateProfile, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-navy" />
                    <span className="text-sm text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* AI helper + Save button */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                    <Sparkles className="h-4 w-4" /> AI gợi ý hoàn thiện hồ sơ
                  </div>
                  <p className="mt-1 text-xs text-indigo-700">
                    AI đọc thông tin đang nhập và gợi ý bổ sung để dễ được gọi hơn. Không yêu cầu CCCD, OTP hay giấy tờ nhạy cảm.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiLoading ? 'AI đang gợi ý...' : 'AI gợi ý'}
                </button>
              </div>

              {aiError && (
                <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiSuggestion && (
                <div className="mt-3 whitespace-pre-line rounded-xl bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-indigo-100">
                  {aiSuggestion}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <button onClick={handleSave}
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 font-bold text-white shadow-lg hover:bg-[#0b2d57] sm:w-auto">
                <Save className="h-4 w-4" /> Lưu hồ sơ tạm
              </button>
              {saved && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  <CheckCircle className="h-4 w-4" /> Hồ sơ hiện đang lưu tạm trên thiết bị. Khi bật đồng bộ backend, hồ sơ sẽ gắn với tài khoản đăng nhập của bạn.
                </div>
              )}
            </div>

            {/* Privacy note */}
            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              <strong>Bảo mật:</strong> Thông tin liên hệ và giấy tờ cá nhân sẽ không hiển thị công khai. Công ty chỉ xem được khi hồ sơ/lead được xác nhận phù hợp.
            </div>
          </div>

          {/* Preview sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl bg-brand-navy p-5 text-white">
                <h3 className="font-bold">Tóm tắt hồ sơ</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {previewLines.length > 0 ? previewLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      <span>{line}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-300">Điền thông tin để xem tóm tắt</p>
                  )}
                </div>
              </div>
              <Link to="/viec-lam" className="flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-bold text-white hover:bg-orange-600">
                <Clock className="h-4 w-4" /> Xem việc làm ngay
              </Link>
            </div>
          </aside>
    </div>
  );
}

const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Agribank', 'Techcombank', 'MB', 'ACB', 'Sacombank', 'VPBank', 'TPBank', 'HDBank', 'VIB', 'SHB', 'OCB', 'MSB', 'Eximbank', 'SeABank', 'Nam A Bank', 'ABBank', 'LPBank', 'Bac A Bank'
];

export function AccountPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <AccountLoadingView />;
  }
  return isSignedIn ? <AccountHub /> : <SignedOutView />;
}

function AccountLoadingView() {
  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-950 font-medium">Tài khoản</span>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Clock className="h-8 w-8 animate-pulse text-slate-400" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-slate-950">Đang tải tài khoản...</h2>
          <p className="mx-auto mb-6 max-w-md text-slate-600">
            Hệ thống đang kết nối đăng nhập. Nếu màn hình này đứng quá lâu, hãy kiểm tra cấu hình Clerk hoặc mở Console để xem lỗi.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 font-bold text-white hover:bg-[#0b2d57]"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}


interface CTVOnboarding {
  status: 'not_registered' | 'pending' | 'approved' | 'rejected';
  ctvCode?: string;
  rejectionReason?: string;
}

interface CompanyOnboarding {
  companyName: string;
  phone: string;
  email: string;
  taxId: string;
  address: string;
  status: 'not_registered' | 'pending' | 'approved' | 'rejected';
  companyCode?: string;
  rejectionReason?: string;
}

const CTV_STORAGE_KEY = 'vieclamgannha_ctv_onboarding_status';
const COMPANY_STORAGE_KEY = 'vieclamgannha_company_onboarding_profile';
const API_URL = '/api';

function CTVTab() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [backendStatus, setBackendStatus] = useState<CTVOnboarding['status']>('not_registered');
  const [ctvCode, setCtvCode] = useState<string | undefined>();
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const [formData, setFormData] = useState({ name: '', phone: '', zaloPhone: '', bankAccount: '', bankName: '', province: '', district: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch CTV status from backend
  useEffect(() => {
    const fetchCtvStatus = async () => {
      if (!user) return;
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/account/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.ctv) {
            setBackendStatus(data.data.ctv.status === 'active' ? 'approved' : data.data.ctv.status);
            setCtvCode(data.data.ctv.ctvCode);
            setRejectionReason(data.data.ctv.rejectionReason);
            // Pre-fill form from backend
            setFormData({
              name: data.data.ctv.name || '',
              phone: data.data.ctv.phone || '',
              zaloPhone: data.data.ctv.zaloPhone || '',
              bankAccount: data.data.ctv.bankAccount || '',
              bankName: data.data.ctv.bankName || '',
              province: data.data.ctv.province || '',
              district: data.data.ctv.district || '',
            });
          }
        }
      } catch {}
    };
    fetchCtvStatus();
  }, [user]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Save to localStorage as backup
    localStorage.setItem(CTV_STORAGE_KEY, JSON.stringify(formData));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setSubmitError('Họ tên và SĐT là bắt buộc');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/account/ctv-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setBackendStatus(data.status);
        if (data.ctvCode) setCtvCode(data.ctvCode);
        if (data.status === 'pending') {
          setShowForm(false);
        }
        // Keep localStorage as backup
        localStorage.setItem(CTV_STORAGE_KEY, JSON.stringify(formData));
      } else {
        setSubmitError(data.message || 'Gửi thất bại, hồ sơ vẫn được lưu tạm trên thiết bị');
      }
    } catch {
      setSubmitError('Chưa gửi được lên hệ thống, hồ sơ vẫn được lưu tạm trên thiết bị này.');
    }
    setSubmitting(false);
  };

  const statusMessages = {
    not_registered: { text: 'Chưa đăng ký', color: 'text-slate-600', bg: 'bg-slate-50' },
    pending: { text: 'Đang chờ admin duyệt', color: 'text-yellow-700', bg: 'bg-yellow-50' },
    approved: { text: 'Đã được duyệt', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    rejected: { text: 'Bị từ chối', color: 'text-red-700', bg: 'bg-red-50' },
  };
  const msg = statusMessages[backendStatus];

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-start gap-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 shrink-0">
          <Users className="h-8 w-8 text-green-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-950 mb-2">Đăng ký làm CTV tuyển dụng</h2>
          <p className="text-slate-600 mb-4">
            Bạn có thể giới thiệu ứng viên phù hợp. Campaign và hoa hồng chỉ mở sau khi hồ sơ CTV được duyệt.
          </p>
          <div className={`mb-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 ${msg.bg} ${msg.color}`}>
            <strong>Trạng thái:</strong> {msg.text}
            {ctvCode && <span className="ml-2 font-mono text-xs">({ctvCode})</span>}
          </div>
          {backendStatus === 'rejected' && rejectionReason && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
              <strong>Lý do từ chối:</strong> {rejectionReason}
            </div>
          )}
          {backendStatus === 'pending' && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Hồ sơ CTV đã được gửi lên hệ thống và đang chờ admin duyệt.
            </div>
          )}
          {backendStatus === 'approved' && (
            <>
              <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                Hồ sơ CTV đã được duyệt. Bạn có thể sử dụng dashboard CTV.
              </div>
              <Link to="/ctv/dashboard" className="mb-4 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 w-full">
                Vào Dashboard CTV <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
          {(backendStatus === 'not_registered' || backendStatus === 'rejected') && !showForm && (
            <button onClick={() => setShowForm(true)} className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700">
              Đăng ký CTV
            </button>
          )}
        </div>
      </div>

      {(backendStatus === 'not_registered' || backendStatus === 'rejected') && showForm && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Họ tên *</span>
              <input type="text" value={formData.name} onChange={e => handleFieldChange('name', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Họ tên đầy đủ" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Số điện thoại *</span>
              <input type="tel" value={formData.phone} onChange={e => handleFieldChange('phone', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="0xxx xxx xxx" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Zalo</span>
              <input type="tel" value={formData.zaloPhone} onChange={e => handleFieldChange('zaloPhone', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Số Zalo" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Khu vực</span>
              <input type="text" value={formData.province} onChange={e => handleFieldChange('province', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Tỉnh/Thành phố" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tài khoản ngân hàng</span>
              <input type="text" value={formData.bankAccount} onChange={e => handleFieldChange('bankAccount', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Số tài khoản" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Ngân hàng</span>
              <select value={formData.bankName} onChange={e => handleFieldChange('bankName', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue bg-white">
                <option value="">-- Chọn ngân hàng --</option>
                <option value="Vietcombank">Vietcombank (VCB)</option>
                <option value="VietinBank">VietinBank (CTG)</option>
                <option value="BIDV">BIDV</option>
                <option value="Agribank">Agribank</option>
                <option value="Sacombank">Sacombank (STB)</option>
                <option value="Techcombank">Techcombank (TCB)</option>
                <option value="MB Bank">MB Bank (MB)</option>
                <option value="ACB">ACB - Asia Commercial Bank</option>
                <option value="VPBank">VPBank</option>
                <option value="TPBank">TPBank</option>
                <option value="VIB">VIB - Vietnam International Bank</option>
                <option value="SHB">SHB - Saigon Hanoi Bank</option>
                <option value="SeABank">SeABank</option>
                <option value="MSB">MSB - Maritime Bank</option>
                <option value="OCB">OCB - Orient Commercial Bank</option>
                <option value="Eximbank">Eximbank (EIB)</option>
                <option value="HDBank">HDBank</option>
                <option value="LienVietPostBank">LienVietPostBank (LPB)</option>
                <option value="PVcomBank">PVcomBank</option>
                <option value="SCB">SCB - Saigon Commercial Bank</option>
                <option value="ABBank">ABBank - An Binh Bank</option>
                <option value="Bac A Bank">Bac A Bank</option>
                <option value="Dong A Bank">Dong A Bank</option>
                <option value="Nam A Bank">Nam A Bank</option>
                <option value="Saigonbank">Saigonbank</option>
                <option value="Viet Bank">Viet Bank</option>
                <option value="Kienlongbank">Kienlongbank</option>
                <option value="PG Bank">PG Bank - Petrolimex Bank</option>
                <option value="OceanBank">OceanBank</option>
                <option value="GPBank">GPBank</option>
                <option value="NCB">NCB - National Citizen Bank</option>
                <option value="VRB">VRB - Vietnam Russia Bank</option>
                <option value="IVB">IVB - Indovina Bank</option>
                <option value="HSBC">HSBC Vietnam</option>
                <option value="Standard Chartered">Standard Chartered Vietnam</option>
                <option value="Citibank">Citibank Vietnam</option>
                <option value="UOB">UOB Vietnam</option>
                <option value="ANZ">ANZ Vietnam</option>
              </select>
            </label>
          </div>
          {submitError && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{submitError}</div>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50">
            {submitting ? 'Đang gửi...' : backendStatus === 'rejected' ? 'Gửi lại đăng ký' : 'Gửi đăng ký CTV'}
          </button>
        </div>
      )}
      <Link to="/ctv" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:text-green-700">
        Tìm hiểu thêm về CTV <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CompanyTab() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [backendStatus, setBackendStatus] = useState<CompanyOnboarding['status']>('not_registered');
  const [companyCode, setCompanyCode] = useState<string | undefined>();
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const [formData, setFormData] = useState({ companyName: '', phone: '', email: '', taxId: '', address: '', province: '', district: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch Company status from backend
  useEffect(() => {
    const fetchCompanyStatus = async () => {
      if (!user) return;
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/account/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.company) {
            setBackendStatus(data.data.company.status === 'active' ? 'approved' : data.data.company.status);
            setCompanyCode(data.data.company.companyCode);
            setRejectionReason(data.data.company.rejectionReason);
            setFormData({
              companyName: data.data.company.name || '',
              phone: data.data.company.phone || '',
              email: data.data.company.email || '',
              taxId: data.data.company.taxCode || '',
              address: data.data.company.address || '',
              province: data.data.company.province || '',
              district: data.data.company.district || '',
            });
          }
        }
      } catch {}
    };
    fetchCompanyStatus();
  }, [user]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(formData));
  };

  const handleSubmit = async () => {
    if (!formData.companyName.trim() || !formData.phone.trim()) {
      setSubmitError('Tên công ty và SĐT là bắt buộc');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/account/company-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setBackendStatus(data.status);
        if (data.companyCode) setCompanyCode(data.companyCode);
        if (data.status === 'pending') setShowForm(false);
        localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(formData));
      } else {
        setSubmitError(data.message || 'Gửi thất bại, hồ sơ vẫn được lưu tạm trên thiết bị');
      }
    } catch {
      setSubmitError('Chưa gửi được lên hệ thống, hồ sơ vẫn được lưu tạm trên thiết bị này.');
    }
    setSubmitting(false);
  };

  const statusMessages = {
    not_registered: { text: 'Chưa đăng ký', color: 'text-slate-600', bg: 'bg-slate-50' },
    pending: { text: 'Đang chờ admin duyệt', color: 'text-yellow-700', bg: 'bg-yellow-50' },
    approved: { text: 'Đã được duyệt', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    rejected: { text: 'Bị từ chối', color: 'text-red-700', bg: 'bg-red-50' },
  };
  const msg = statusMessages[backendStatus];

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-start gap-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 shrink-0">
          <Briefcase className="h-8 w-8 text-purple-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-950 mb-2">Đăng ký hồ sơ công ty</h2>
          <p className="text-slate-600 mb-4">
            Công ty cần cung cấp tên công ty, địa chỉ, số điện thoại, email và mã số thuế để admin duyệt.
          </p>
          <div className={`mb-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 ${msg.bg} ${msg.color}`}>
            <strong>Trạng thái:</strong> {msg.text}
            {companyCode && <span className="ml-2 font-mono text-xs">({companyCode})</span>}
          </div>
          {backendStatus === 'rejected' && rejectionReason && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
              <strong>Lý do từ chối:</strong> {rejectionReason}
            </div>
          )}
          {backendStatus === 'pending' && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Hồ sơ công ty đã được gửi lên hệ thống và đang chờ admin duyệt.
            </div>
          )}
          {backendStatus === 'approved' && (
            <>
              <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                Hồ sơ công ty đã được duyệt. Bạn có thể sử dụng dashboard công ty.
              </div>
              <Link to="/company/dashboard" className="mb-4 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700 w-full">
                Vào Dashboard Công ty <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
          {(backendStatus === 'not_registered' || backendStatus === 'rejected') && !showForm && (
            <button onClick={() => setShowForm(true)} className="rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700">
              Đăng ký công ty
            </button>
          )}
        </div>
      </div>

      {(showForm || backendStatus === 'not_registered' || backendStatus === 'rejected') && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tên công ty *</span>
              <input type="text" value={formData.companyName} onChange={e => handleFieldChange('companyName', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Tên công ty" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Số điện thoại *</span>
              <input type="tel" value={formData.phone} onChange={e => handleFieldChange('phone', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="0xxx xxx xxx" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email công ty</span>
              <input type="email" value={formData.email} onChange={e => handleFieldChange('email', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="email@company.com" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Mã số thuế</span>
              <input type="text" value={formData.taxId} onChange={e => handleFieldChange('taxId', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Mã số thuế" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Địa chỉ công ty</span>
            <input type="text" value={formData.address} onChange={e => handleFieldChange('address', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-blue" placeholder="Địa chỉ đầy đủ" />
          </label>
          {submitError && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{submitError}</div>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full rounded-xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700 disabled:opacity-50">
            {submitting ? 'Đang gửi...' : backendStatus === 'rejected' ? 'Gửi lại đăng ký' : 'Gửi đăng ký công ty'}
          </button>
        </div>
      )}
      <Link to="/nha-tuyen-dung" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700">
        Xem trang dành cho nhà tuyển dụng <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AccountHub() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMode, setSelectedMode] = useState<'candidate' | 'ctv' | 'company'>('candidate');

  // Read tab from URL on mount
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'ctv') {
      setSelectedMode('ctv');
    } else if (tab === 'company' || tab === 'employer') {
      setSelectedMode('company');
    } else {
      setSelectedMode('candidate');
    }
  }, [searchParams]);

  const handleModeChange = (mode: 'candidate' | 'ctv' | 'company') => {
    setSelectedMode(mode);
    localStorage.setItem(INTENT_STORAGE_KEY, mode);
    // Sync URL param
    setSearchParams(tab => {
      const newParams = new URLSearchParams(tab);
      if (mode === 'candidate') {
        newParams.delete('tab');
      } else {
        newParams.set('tab', mode);
      }
      return newParams;
    });
  };

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-950 font-medium">Tài khoản</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Tài khoản của bạn</h1>
            {user?.primaryEmailAddress?.emailAddress && (
              <p className="mt-1 text-slate-600">{user.primaryEmailAddress.emailAddress}</p>
            )}
            <p className="mt-1 text-sm text-slate-500">Một tài khoản dùng chung cho tìm việc, CTV tuyển dụng và công ty tuyển dụng.</p>
          </div>
          <div className="flex items-center gap-3">
            <UserButton />
          </div>
        </div>

        <div className="mb-6 flex gap-2 border-b border-slate-200">
          {[
            { id: 'candidate', label: 'Hồ sơ tìm việc' },
            { id: 'ctv', label: 'CTV tuyển dụng' },
            { id: 'company', label: 'Công ty tuyển dụng' },
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id as 'candidate' | 'ctv' | 'company')}
              className={`px-4 py-3 font-semibold text-sm transition ${
                selectedMode === mode.id
                  ? 'border-b-2 border-brand-navy text-brand-navy'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {selectedMode === 'candidate' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
              Hồ sơ hiện đang lưu tạm trên thiết bị. Khi bật đồng bộ backend, hồ sơ sẽ gắn với tài khoản đăng nhập của bạn.
            </div>
            <CandidateProfileForm />
          </div>
        )}

        {selectedMode === 'ctv' && <CTVTab />}

        {selectedMode === 'company' && <CompanyTab />}
      </div>
    </div>
  );
}
