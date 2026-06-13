import { Link } from 'react-router-dom';

export type SearchBranch = {
  label: string;
  subtitle: string;
  href: string;
  image: string;
  /** Query param key this branch sets, e.g. "category" | "shift" | "tag" */
  paramKey?: 'category' | 'shift' | 'tag';
  /** Value to match against job[paramKey] */
  paramValue?: string;
};

export const searchBranches: SearchBranch[] = [
  {
    label: 'Bảo vệ',
    subtitle: 'An ninh & Bảo vệ',
    href: '/viec-lam?category=bao-ve',
    image: '/images/categories/viec-lam-bao-ve.webp',
    paramKey: 'category',
    paramValue: 'bao-ve',
  },
  {
    label: 'Tạp vụ',
    subtitle: 'Vệ sinh & Tạp vụ',
    href: '/viec-lam?category=tap-vu',
    image: '/images/categories/viec-lam-tap-vu.webp',
    paramKey: 'category',
    paramValue: 'tap-vu',
  },
  {
    label: 'Kho / Xưởng',
    subtitle: 'Kho vận & Xưởng',
    href: '/viec-lam?category=kho-van',
    image: '/images/categories/viec-lam-kho-xuong.webp',
    paramKey: 'category',
    paramValue: 'kho-van',
  },
  {
    label: 'Giao hàng',
    subtitle: 'Giao nhận vận chuyển',
    href: '/viec-lam?category=giao-hang',
    image: '/images/categories/viec-lam-giao-hang.webp',
    paramKey: 'category',
    paramValue: 'giao-hang',
  },
  {
    label: 'Ca đêm',
    subtitle: 'Làm ban đêm',
    href: '/viec-lam?shift=ca-dem',
    image: '/images/categories/viec-lam-ca-dem.webp',
    paramKey: 'shift',
    paramValue: 'ca-dem',
  },
  {
    label: 'Việc gần nhà',
    subtitle: 'Thuận tiện đi lại',
    href: '/viec-lam?tag=gan-nha',
    image: '/images/categories/viec-lam-gan-nha.webp',
    paramKey: 'tag',
    paramValue: 'gan-nha',
  },
  {
    label: 'Có chỗ ở lại',
    subtitle: 'Nhà ở miễn phí',
    href: '/viec-lam?tag=co-cho-o-lai',
    image: '/images/categories/viec-co-cho-o-lai.webp',
    paramKey: 'tag',
    paramValue: 'co-cho-o-lai',
  },
  {
    label: 'Tất cả việc làm',
    subtitle: 'Xem tất cả tin tuyển dụng',
    href: '/viec-lam',
    image: '/images/placeholders/job-placeholder.webp',
  },
];