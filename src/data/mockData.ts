import type { AreaItem, JobCategory, JobPost, PricingPlan } from '../lib/types';

export const categories = [
  { label: 'Bảo vệ', value: 'bao-ve' },
  { label: 'Lao động phổ thông', value: 'lao-dong-pho-thong' },
  { label: 'Tạp vụ', value: 'tap-vu' },
  { label: 'Phụ kho', value: 'phu-kho' },
  { label: 'Kho vận', value: 'kho-van' },
  { label: 'Giao hàng', value: 'giao-hang' },
] as const;

export const allJobs: JobPost[] = [
  {
    id: 'job-real-1',
    slug: 'bao-ve-estella-place-q2',
    category: 'bao-ve',
    categoryLabel: 'BẢO VỆ',
    title: 'Bảo vệ TTTM Estella Place',
    salary: '9.000.000đ/tháng',
    province: 'TP.HCM',
    district: 'Q2 / Thủ Đức',
    address: '88 Song Hành, Phường Bình Trưng, TP.HCM',
    shift: 'Ca 12h ngày/đêm',
    companyPublicName: 'Công Ty Bảo Vệ Visit',
    companyCode: 'PUBLIC',
    targetCode: 'PUBLIC_bao-ve-estella-place-q2',
    tags: ['Trung tâm thương mại', 'Đi làm ngay'],
    isFeatured: true,
  },
  {
    id: 'job-real-2',
    slug: 'bao-ve-saigon-centre-q1',
    category: 'bao-ve',
    categoryLabel: 'BẢO VỆ',
    title: 'Bảo vệ Saigon Centre',
    salary: '9.300.000đ/tháng',
    province: 'TP.HCM',
    district: 'Quận 1',
    address: '65 Lê Lợi, Phường Sài Gòn, TP.HCM',
    shift: 'Ca 12h ngày/đêm',
    companyPublicName: 'Công Ty Bảo Vệ Visit',
    companyCode: 'PUBLIC',
    targetCode: 'PUBLIC_bao-ve-saigon-centre-q1',
    tags: ['Tòa nhà', 'Trung tâm thương mại'],
    isFeatured: true,
  },
  {
    id: 'job-real-3',
    slug: 'bao-ve-sedona-suites-q1',
    category: 'bao-ve',
    categoryLabel: 'BẢO VỆ',
    title: 'Bảo vệ khách sạn Sedona',
    salary: '10.700.000đ/tháng',
    province: 'TP.HCM',
    district: 'Quận 1',
    address: '67 Lê Lợi / Saigon Centre Building, TP.HCM',
    shift: 'Ca 12h ngày/đêm',
    companyPublicName: 'Công Ty Bảo Vệ Visit',
    companyCode: 'PUBLIC',
    targetCode: 'PUBLIC_bao-ve-sedona-suites-q1',
    tags: ['Khách sạn', 'Cao cấp'],
    isFeatured: true,
  },
  {
    id: 'job-real-4',
    slug: 'bao-ve-the-infiniti-q7',
    category: 'bao-ve',
    categoryLabel: 'BẢO VỆ',
    title: 'Bảo vệ chung cư The Infiniti',
    salary: '8.000.000đ/tháng',
    province: 'TP.HCM',
    district: 'Quận 7',
    address: '584 Huỳnh Tấn Phát, Phường Tân Phú, TP.HCM',
    shift: 'Ca 12h ngày/đêm',
    companyPublicName: 'Công Ty Bảo Vệ Visit',
    companyCode: 'PUBLIC',
    targetCode: 'PUBLIC_bao-ve-the-infiniti-q7',
    tags: ['Chung cư', 'Đi làm ngay'],
    isFeatured: true,
  },
  {
    id: 'job-real-5',
    slug: 'bao-ve-rita-q1-q10',
    category: 'bao-ve',
    categoryLabel: 'BẢO VỆ',
    title: 'Bảo vệ Rita Võ',
    salary: '7.000.000đ/tháng',
    province: 'TP.HCM',
    district: 'Quận 1 + Quận 10',
    address: '158 Thành Thái + 63 Nam Kỳ Khởi Nghĩa',
    shift: 'Ca 12h, chi tiết ca đang xác minh',
    companyPublicName: 'Công Ty TNHH DV An Ninh Hòa Phát',
    companyCode: 'PUBLIC',
    targetCode: 'PUBLIC_bao-ve-rita-q1-q10',
    tags: ['Cửa hàng', 'Đi làm ngay'],
    isFeatured: false,
  },
];

// Alias cho featuredJobs để backward compatibility
export const featuredJobs = allJobs.filter(job => job.isFeatured);

// Helper functions
export function getJobBySlug(slug: string): JobPost | undefined {
  return allJobs.find(job => job.slug === slug || job.id === slug);
}

export function getRelatedJobs(currentJobId: string, limit: number = 3): JobPost[] {
  const currentJob = allJobs.find(job => job.id === currentJobId);
  if (!currentJob) return [];
  
  return allJobs
    .filter(job => job.id !== currentJobId && job.category === currentJob.category)
    .slice(0, limit);
}

export function getJobsByCategory(category: JobCategory): JobPost[] {
  return allJobs.filter(job => job.category === category);
}

export function getJobsByProvince(province: string): JobPost[] {
  return allJobs.filter(job => job.province.toLowerCase().includes(province.toLowerCase()));
}

export const areas: AreaItem[] = [
  { name: 'TP.HCM', countLabel: '8.932 việc làm', slug: 'tp-hcm' },
  { name: 'Bình Dương', countLabel: '6.245 việc làm', slug: 'binh-duong' },
  { name: 'Đồng Nai', countLabel: '4.102 việc làm', slug: 'dong-nai' },
  { name: 'Long An', countLabel: '2.356 việc làm', slug: 'long-an' },
  { name: 'Thủ Đức', countLabel: '3.874 việc làm', slug: 'thu-duc' },
  { name: 'Dĩ An', countLabel: '2.918 việc làm', slug: 'di-an' },
  { name: 'Biên Hòa', countLabel: '2.455 việc làm', slug: 'bien-hoa' },
];

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Gói 5 Tin',
    price: '499k',
    limit: 'Tối đa 5 tin tuyển đang bật',
    highlights: ['Hiển thị tin 30 ngày', 'Nhận hồ sơ qua Telegram', 'Thống kê cơ bản'],
  },
  {
    name: 'Gói 10 Tin',
    price: '799k',
    limit: 'Tối đa 10 tin tuyển đang bật',
    highlights: ['Có dashboard công ty', 'Xuất Excel cơ bản', 'Hỗ trợ ưu tiên'],
    popular: true,
  },
  {
    name: 'Gói 20 Tin',
    price: '999k',
    limit: 'Tối đa 20 tin tuyển đang bật',
    highlights: ['Ưu tiên hiển thị', 'Nhiều tài khoản nhân sự', 'Báo cáo hiệu quả'],
  },
];

export const dashboardStats = {
  views: { value: 12450, change: '+18%', period: '7 ngày qua' },
  applies: { value: 1256, change: '+22%', period: '7 ngày qua' },
  activeJobs: { value: 18, change: '+5', period: 'so với tuần trước' },
  expiringJobs: { value: 3, change: 'Cần gia hạn', period: 'trong 3 ngày tới' },
};

export const salaryRanges = [
  'Dưới 5 triệu',
  '5 - 7 triệu',
  '7 - 10 triệu',
  '10 - 15 triệu',
  'Trên 15 triệu',
];

export const provinces = [
  'TP.HCM',
  'Hà Nội',
  'Bình Dương',
  'Đồng Nai',
  'Long An',
  'Bà Rịa - Vũng Tàu',
];
