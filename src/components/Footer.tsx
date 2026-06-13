import { Clock3, Phone, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../config/site';

export function Footer() {
  return (
    <footer className="bg-brand-navy px-4 py-10 text-white md:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8" />
            <div className="font-black">{siteConfig.brand}</div>
          </div>
          <p className="mt-3 text-sm text-slate-300">{siteConfig.tagline}.</p>
        </div>

        <div>
          <div className="font-black">Về chúng tôi</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div>Giới thiệu</div>
            <div>Quy chế hoạt động</div>
            <Link to="/privacy-policy" className="block hover:text-white">
              Chính sách quyền riêng tư
            </Link>
            <Link to="/data-deletion" className="block hover:text-white">
              Yêu cầu xóa dữ liệu
            </Link>
          </div>
        </div>

        <div>
          <div className="font-black">Dành cho công ty</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div>Đăng tin tuyển dụng</div>
            <div>Bảng giá dịch vụ</div>
            <div>Hướng dẫn sử dụng</div>
          </div>
        </div>

        <div>
          <div className="font-black">Liên hệ</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex gap-2">
              <Phone className="h-4 w-4" /> Hotline: {siteConfig.hotline}
            </div>
            <a href={`mailto:${siteConfig.contactEmail}`} className="flex gap-2 hover:text-white">
              <WalletCards className="h-4 w-4" /> {siteConfig.contactEmail}
            </a>
            <div className="flex gap-2">
              <Clock3 className="h-4 w-4" /> Hỗ trợ trong giờ hành chính
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
