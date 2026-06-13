import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { siteConfig } from '../../config/site';

type LegalPageFrameProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalPageFrame({ eyebrow, title, summary, children }: LegalPageFrameProps) {
  return (
    <main className="min-h-screen bg-brand-surface">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,0,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.1),_transparent_28%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="inline-flex items-center gap-1 font-medium hover:text-brand-blue">
              <ArrowLeft className="h-4 w-4" />
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-slate-950">{eyebrow}</span>
          </div>

          <div className="mt-8 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-navy/5 px-4 py-2 text-sm font-semibold text-brand-navy ring-1 ring-brand-navy/10">
              <ShieldCheck className="h-4 w-4" />
              VIECLAMGANNHA.ME
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">{summary}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">{children}</div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-brand-navy p-6 text-white shadow-lg shadow-slate-900/10">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Liên hệ hỗ trợ</p>
                  <a href={`mailto:${siteConfig.contactEmail}`} className="font-semibold text-white hover:underline">
                    {siteConfig.contactEmail}
                  </a>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-200">
                Nếu bạn cần hỗ trợ về dữ liệu cá nhân, chúng tôi sẽ phản hồi trong thời gian làm việc phù hợp.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Điều hướng nhanh</p>
              <div className="mt-4 space-y-3 text-sm">
                <Link to="/" className="block font-semibold text-slate-700 hover:text-brand-blue">
                  Về trang chủ
                </Link>
                <Link to="/viec-lam" className="block font-semibold text-slate-700 hover:text-brand-blue">
                  Xem việc làm
                </Link>
                <Link to="/privacy-policy" className="block font-semibold text-slate-700 hover:text-brand-blue">
                  Chính sách quyền riêng tư
                </Link>
                <Link to="/data-deletion" className="block font-semibold text-slate-700 hover:text-brand-blue">
                  Yêu cầu xóa dữ liệu
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
