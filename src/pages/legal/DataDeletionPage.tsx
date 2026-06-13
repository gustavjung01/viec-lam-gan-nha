import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileClock, FileText, Mail, MessageSquareText, ShieldAlert, UserRound } from 'lucide-react';
import { siteConfig } from '../../config/site';
import { LegalPageFrame } from './LegalPageFrame';

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-navy/5 text-brand-navy">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-950 md:text-2xl">{title}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 md:text-base">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function DataDeletionPage() {
  useEffect(() => {
    document.title = 'Hướng dẫn yêu cầu xóa dữ liệu - VIECLAMGANNHA.ME';
  }, []);

  return (
    <LegalPageFrame
      eyebrow="Yêu cầu xóa dữ liệu"
      title="Hướng dẫn yêu cầu xóa dữ liệu - VIECLAMGANNHA.ME"
      summary="Người dùng có thể yêu cầu xóa dữ liệu liên quan đến hồ sơ ứng tuyển, tài khoản, tin nhắn chatbot/Facebook Messenger hoặc thông tin đã gửi qua VIECLAMGANNHA.ME."
    >
      <SectionCard icon={<Mail className="h-5 w-5" />} title="1. Cách gửi yêu cầu">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Gửi email tới{' '}
            <a href={`mailto:${siteConfig.contactEmail}`} className="font-semibold text-brand-blue hover:underline">
              {siteConfig.contactEmail}
            </a>{' '}
            với tiêu đề: <span className="font-semibold">“Yêu cầu xóa dữ liệu VIECLAMGANNHA.ME”</span>.
          </li>
          <li>
            Nhắn tin trực tiếp fanpage <span className="font-semibold">VIECLAMGANNHA.ME</span> với nội dung:{' '}
            <span className="font-semibold">“Tôi muốn xóa dữ liệu của tôi”</span>.
          </li>
        </ol>
      </SectionCard>

      <SectionCard icon={<FileText className="h-5 w-5" />} title="2. Thông tin bạn nên cung cấp">
        <ul className="list-disc space-y-2 pl-5">
          <li>Họ tên nếu có.</li>
          <li>Số điện thoại hoặc Zalo đã dùng khi ứng tuyển nếu có.</li>
          <li>Email đã dùng nếu có.</li>
          <li>Tên Facebook hoặc thông tin nhận diện cuộc trò chuyện.</li>
          <li>Mô tả ngắn dữ liệu bạn muốn xóa.</li>
        </ul>
      </SectionCard>

      <SectionCard icon={<FileClock className="h-5 w-5" />} title="3. Thời gian xử lý">
        <p>
          Chúng tôi sẽ xử lý trong khoảng thời gian hợp lý, thông thường từ 7 đến 30 ngày làm việc tùy độ phức tạp của yêu cầu
          và kênh tiếp nhận.
        </p>
      </SectionCard>

      <SectionCard icon={<ShieldAlert className="h-5 w-5" />} title="4. Một số dữ liệu có thể được giữ lại">
        <p>
          Một số dữ liệu có thể cần lưu lại trong một khoảng thời gian nhất định nếu liên quan đến nghĩa vụ pháp lý, bảo mật,
          chống gian lận hoặc tranh chấp. Khi đó chúng tôi chỉ giữ lại phần tối thiểu cần thiết.
        </p>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-orange/10 text-brand-orange">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Dữ liệu nào có thể nằm trong yêu cầu?</h2>
              <p className="mt-1 text-sm text-slate-600">
                Hồ sơ ứng tuyển, tài khoản, tin nhắn trao đổi, thông tin liên hệ và nội dung bạn đã gửi qua hệ thống.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-brand-navy p-6 text-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Kênh nhanh</h2>
              <p className="mt-1 text-sm text-slate-300">
                Nếu bạn đang nhắn qua fanpage hoặc chatbot, hãy gửi đúng câu xác nhận để chúng tôi ghi nhận yêu cầu.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <h2 className="text-xl font-black text-slate-950 md:text-2xl">Điều hướng liên quan</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2d57]"
          >
            Về trang chủ <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/privacy-policy"
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Chính sách quyền riêng tư
          </Link>
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Gửi email hỗ trợ
          </a>
        </div>
      </section>
    </LegalPageFrame>
  );
}
