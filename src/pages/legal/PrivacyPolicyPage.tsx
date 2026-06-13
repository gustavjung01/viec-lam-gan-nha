import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, Lock, MessagesSquare, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
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

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Chính sách quyền riêng tư - VIECLAMGANNHA.ME';
  }, []);

  return (
    <LegalPageFrame
      eyebrow="Chính sách quyền riêng tư"
      title="Chính sách quyền riêng tư - VIECLAMGANNHA.ME"
      summary="VIECLAMGANNHA.ME là nền tảng hỗ trợ người lao động tìm việc gần khu vực, ứng tuyển việc làm, kết nối với công ty tuyển dụng và hỗ trợ tư vấn qua website, fanpage và chatbot."
    >
      <SectionCard icon={<FileText className="h-5 w-5" />} title="1. Dữ liệu chúng tôi có thể xử lý">
        <ul className="list-disc space-y-2 pl-5">
          <li>Thông tin người dùng tự cung cấp khi tạo hồ sơ hoặc ứng tuyển.</li>
          <li>Họ tên, số điện thoại, Zalo, khu vực làm việc mong muốn nếu người dùng tự nhập.</li>
          <li>Thông tin tài khoản đăng nhập nếu có.</li>
          <li>Nội dung tin nhắn khi người dùng chat với fanpage hoặc chatbot.</li>
          <li>Thông tin ứng tuyển, vị trí quan tâm, khu vực làm việc và ca làm mong muốn.</li>
          <li>Thông tin công ty hoặc nhà tuyển dụng nếu đơn vị tự đăng ký hoặc liên hệ.</li>
          <li>Dữ liệu kỹ thuật cơ bản như trình duyệt, thời gian truy cập và lỗi hệ thống.</li>
        </ul>
      </SectionCard>

      <SectionCard icon={<Users className="h-5 w-5" />} title="2. Mục đích sử dụng dữ liệu">
        <ul className="list-disc space-y-2 pl-5">
          <li>Hỗ trợ người lao động tìm việc phù hợp theo khu vực và nhu cầu thực tế.</li>
          <li>Chuyển thông tin ứng tuyển đến công ty hoặc đơn vị tuyển dụng liên quan.</li>
          <li>Tư vấn việc làm, chăm sóc ứng viên và hỗ trợ phản hồi nhanh hơn.</li>
          <li>Hỗ trợ công ty hoặc nhà tuyển dụng quản lý nhu cầu tuyển dụng của họ.</li>
          <li>Vận hành, bảo mật, phát hiện lỗi và cải thiện chất lượng dịch vụ.</li>
        </ul>
      </SectionCard>

      <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="3. Cam kết của chúng tôi">
        <ul className="list-disc space-y-2 pl-5">
          <li>Không bán dữ liệu cá nhân.</li>
          <li>Không công khai nội dung chat cá nhân.</li>
          <li>Không công khai số điện thoại hoặc hồ sơ riêng tư ngoài phạm vi cần thiết để xử lý ứng tuyển.</li>
          <li>Chỉ chia sẻ dữ liệu khi cần vận hành dịch vụ, kết nối tuyển dụng hoặc theo yêu cầu pháp luật.</li>
        </ul>
      </SectionCard>

      <SectionCard icon={<Lock className="h-5 w-5" />} title="4. Quyền của bạn và yêu cầu xóa dữ liệu">
        <p>
          Nếu bạn muốn yêu cầu xóa dữ liệu liên quan đến hồ sơ ứng tuyển, tài khoản, tin nhắn chatbot/Facebook Messenger
          hoặc thông tin đã gửi qua VIECLAMGANNHA.ME, vui lòng xem trang hướng dẫn riêng bên dưới.
        </p>
        <div className="rounded-2xl bg-slate-50 p-4">
          <Link to="/data-deletion" className="inline-flex items-center gap-2 font-semibold text-brand-blue hover:underline">
            <Send className="h-4 w-4" />
            Yêu cầu xóa dữ liệu
          </Link>
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-brand-navy p-6 text-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-300">Liên hệ công khai</p>
              <a href={`mailto:${siteConfig.contactEmail}`} className="font-semibold text-white hover:underline">
                {siteConfig.contactEmail}
              </a>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-200">
            Dùng địa chỉ này khi bạn cần hỏi về quyền riêng tư, xác minh thông tin hoặc yêu cầu hỗ trợ liên quan đến dữ liệu.
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Lưu ý</p>
              <p className="text-sm text-amber-800">
                Một số dữ liệu có thể cần giữ lại trong thời gian nhất định để bảo mật hoặc tuân thủ pháp luật.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-orange/10 text-brand-orange">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-950 md:text-2xl">Cập nhật và điều chỉnh</h2>
            <p className="mt-1 text-sm leading-7 text-slate-600 md:text-base">
              Chúng tôi có thể cập nhật tài liệu này khi dịch vụ, kênh hỗ trợ hoặc yêu cầu pháp lý thay đổi. Trang này luôn ưu tiên
              trải nghiệm rõ ràng, dễ đọc và không yêu cầu đăng nhập.
            </p>
          </div>
        </div>
      </section>
    </LegalPageFrame>
  );
}
