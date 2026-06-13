import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, User, Phone, MapPin, Briefcase, GraduationCap, Clock, Home, Car, Calendar, ChevronLeft, Loader2 } from 'lucide-react';

interface CandidateProfile {
  id?: string;
  name: string;
  phone: string;
  zalo_phone?: string;
  birth_year?: number;
  province?: string;
  district?: string;
  desired_job?: string;
  desired_shift?: string;
  available_date?: string;
  note?: string;
  // Chatbot fields
  experience_years?: number;
  education_level?: string;
  preferred_shift?: 'morning' | 'afternoon' | 'night' | 'flexible' | 'full_day';
  is_stay_in_possible?: boolean;
  has_transport?: boolean;
}

const EDUCATION_LEVELS = [
  { value: 'primary', label: 'Tiểu học' },
  { value: 'secondary', label: 'Trung học cơ sở' },
  { value: 'high_school', label: 'Trung học phổ thông' },
  { value: 'vocational', label: 'Trung cấp/Cao đẳng nghề' },
  { value: 'college', label: 'Cao đẳng' },
  { value: 'university', label: 'Đại học' },
  { value: 'postgraduate', label: 'Sau đại học' }
];

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Ca sáng (6h-14h)' },
  { value: 'afternoon', label: 'Ca chiều (14h-22h)' },
  { value: 'night', label: 'Ca đêm (22h-6h)' },
  { value: 'flexible', label: 'Ca linh hoạt' },
  { value: 'full_day', label: 'Ca nguyên ngày' }
];

const EXPERIENCE_OPTIONS = [
  { value: 0, label: 'Chưa có kinh nghiệm' },
  { value: 1, label: 'Dưới 1 năm' },
  { value: 2, label: '1-2 năm' },
  { value: 3, label: '2-3 năm' },
  { value: 5, label: '3-5 năm' },
  { value: 10, label: '5-10 năm' },
  { value: 15, label: 'Trên 10 năm' }
];

const PROVINCES = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
];

export default function CandidateProfilePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [profile, setProfile] = useState<CandidateProfile>({
    name: '',
    phone: '',
    zalo_phone: '',
    birth_year: undefined,
    province: '',
    district: '',
    desired_job: '',
    desired_shift: '',
    available_date: '',
    note: '',
    experience_years: undefined,
    education_level: '',
    preferred_shift: undefined,
    is_stay_in_possible: false,
    has_transport: false
  });

  // Load profile from localStorage or API on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('candidate_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setProfile(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved profile:', e);
      }
    }
  }, []);

  const handleChange = (field: keyof CandidateProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!profile.name.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập họ tên' });
      return false;
    }
    if (!profile.phone.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số điện thoại' });
      return false;
    }
    const phoneRegex = /^[0-9\-\+\s]{9,15}$/;
    if (!phoneRegex.test(profile.phone)) {
      setMessage({ type: 'error', text: 'Số điện thoại không hợp lệ' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    if (!validateForm()) return;
    
    setIsSaving(true);
    
    try {
      // Check if candidate exists by phone
      const checkRes = await fetch(`/api/candidates/phone/${encodeURIComponent(profile.phone)}`);
      const checkData = await checkRes.json();
      
      let response;
      
      if (checkRes.ok && checkData.data) {
        // Update existing candidate
        response = await fetch(`/api/candidates/${checkData.data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
      } else {
        // Create new candidate
        response = await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Save to localStorage for persistence
        localStorage.setItem('candidate_profile', JSON.stringify(profile));
        setMessage({ type: 'success', text: 'Đã lưu hồ sơ thành công!' });
        
        if (result.data?.id) {
          setProfile(prev => ({ ...prev, id: result.data.id }));
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      console.error('Save profile error:', error);
      setMessage({ type: 'error', text: 'Không thể kết nối đến server. Vui lòng thử lại sau.' });
    } finally {
      setIsSaving(false);
    }
  };

  const birthYearOptions = Array.from({ length: 60 }, (_, i) => 1960 + i);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Quay lại
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-7 h-7 text-blue-600" />
            Hồ sơ ứng viên
          </h1>
          <p className="text-gray-600 mt-1">
            Cập nhật thông tin để chatbot tìm việc phù hợp cho bạn
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-500" />
              Thông tin cơ bản
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0901234567"
                  required
                />
              </div>

              {/* Zalo Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số Zalo (nếu khác số điện thoại)
                </label>
                <input
                  type="tel"
                  value={profile.zalo_phone || ''}
                  onChange={(e) => handleChange('zalo_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0901234567"
                />
              </div>

              {/* Birth Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Năm sinh
                </label>
                <select
                  value={profile.birth_year || ''}
                  onChange={(e) => handleChange('birth_year', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Chọn năm sinh</option>
                  {birthYearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Province */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Tỉnh/Thành phố
                </label>
                <select
                  value={profile.province || ''}
                  onChange={(e) => handleChange('province', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {PROVINCES.map(province => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quận/Huyện
                </label>
                <input
                  type="text"
                  value={profile.district || ''}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Quận 1, Huyện Ba Vì..."
                />
              </div>
            </div>
          </div>

          {/* Job Preferences Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-green-500" />
              Mong muốn công việc
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Desired Job */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Công việc mong muốn
                </label>
                <input
                  type="text"
                  value={profile.desired_job || ''}
                  onChange={(e) => handleChange('desired_job', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nhân viên bán hàng, Bảo vệ..."
                />
              </div>

              {/* Available Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày có thể đi làm
                </label>
                <input
                  type="text"
                  value={profile.available_date || ''}
                  onChange={(e) => handleChange('available_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ngay lập tức, Sau 1 tuần..."
                />
              </div>
            </div>
          </div>

          {/* Chatbot Matching Section */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-500" />
              Thông tin tư vấn việc làm
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                Giúp chatbot tìm việc phù hợp
              </span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kinh nghiệm làm việc
                </label>
                <select
                  value={profile.experience_years || ''}
                  onChange={(e) => handleChange('experience_years', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Chọn kinh nghiệm</option>
                  {EXPERIENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Education */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trình độ học vấn
                </label>
                <select
                  value={profile.education_level || ''}
                  onChange={(e) => handleChange('education_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Chọn trình độ</option>
                  {EDUCATION_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              {/* Preferred Shift */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Ca làm việc mong muốn
                </label>
                <select
                  value={profile.preferred_shift || ''}
                  onChange={(e) => handleChange('preferred_shift', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Chọn ca làm việc</option>
                  {SHIFT_OPTIONS.map(shift => (
                    <option key={shift.value} value={shift.value}>{shift.label}</option>
                  ))}
                </select>
              </div>

              {/* Stay In */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Home className="w-4 h-4" />
                  Có thể ở lại công ty?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="stay_in"
                      checked={profile.is_stay_in_possible === true}
                      onChange={() => handleChange('is_stay_in_possible', true)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">Có thể ở lại</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="stay_in"
                      checked={profile.is_stay_in_possible === false}
                      onChange={() => handleChange('is_stay_in_possible', false)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">Không ở lại</span>
                  </label>
                </div>
              </div>

              {/* Transport */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Car className="w-4 h-4" />
                  Có phương tiện đi lại?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      checked={profile.has_transport === true}
                      onChange={() => handleChange('has_transport', true)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">Có xe/đi lại được</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      checked={profile.has_transport === false}
                      onChange={() => handleChange('has_transport', false)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">Chưa có</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú thêm
            </label>
            <textarea
              value={profile.note || ''}
              onChange={(e) => handleChange('note', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Mô tả thêm về bản thân, kinh nghiệm làm việc..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Lưu hồ sơ
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/chatbot')}
              className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2 transition-colors"
            >
              💬 Tư vấn việc làm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
