import type { PricingPlan } from '../lib/types';

export const siteConfig = {
  brand: 'VIECLAMGANNHA.ME',
  brandShort: 'Việc Làm Gần Nhà',
  tagline: 'Bảo Vệ & LDPT Theo Khu Vực',
  contactEmail: 'support@vieclamgannha.me',
  hotline: '1900 8888',
};

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
