export type JobCategory = 'bao-ve' | 'lao-dong-pho-thong' | 'tap-vu' | 'phu-kho' | 'kho-van' | 'giao-hang';

export type JobPost = {
  id: string;
  slug: string;
  category: JobCategory;
  categoryLabel: string;
  title: string;
  salary: string;
  province: string;
  district: string;
  address?: string;
  shift?: string;
  companyPublicName?: string;
  companyCode?: string;
  targetCode?: string;
  tags: string[];
  isFeatured?: boolean;
  // Chi tiết job
  description?: string;
  requirements?: string[];
  benefits?: string[];
};

export type AreaItem = {
  name: string;
  countLabel: string;
  slug: string;
};

export type PricingPlan = {
  name: string;
  price: string;
  limit: string;
  highlights: string[];
  popular?: boolean;
};

export type QuickApplyForm = {
  fullName: string;
  phone: string;
  area: string;
  note?: string;
  jobId?: string;
  companyCode?: string;
  targetCode?: string;
};
