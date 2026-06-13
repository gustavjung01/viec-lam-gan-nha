import React, { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Clock3,
  Eye,
  Filter,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const categories = [
  "Bảo vệ",
  "Lao động phổ thông",
  "Tạp vụ",
  "Phụ kho",
  "Kho vận",
  "Giao hàng",
];

const jobs = [
  {
    category: "BẢO VỆ",
    color: "bg-blue-50 text-blue-700 border-blue-100",
    icon: ShieldCheck,
    title: "Nhân viên bảo vệ ca ngày",
    salary: "7.000.000 - 8.000.000đ/tháng",
    area: "Quận Bình Thạnh, TP.HCM",
    code: "CTY012 - MT004",
    tags: ["Toàn thời gian", "Đi làm ngay"],
  },
  {
    category: "LĐ PHỔ THÔNG",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: Users,
    title: "Lao động phổ thông đi làm ngay",
    salary: "6.500.000 - 8.500.000đ/tháng",
    area: "Dĩ An, Bình Dương",
    code: "CTY015 - MT021",
    tags: ["Toàn thời gian", "Gần nhà"],
  },
  {
    category: "PHỤ KHO",
    color: "bg-violet-50 text-violet-700 border-violet-100",
    icon: Building2,
    title: "Nhân viên phụ kho soạn hàng",
    salary: "7.500.000 - 9.000.000đ/tháng",
    area: "Thủ Đức, TP.HCM",
    code: "CTY018 - MT007",
    tags: ["Kho vận", "Có hỗ trợ"],
  },
  {
    category: "TẠP VỤ",
    color: "bg-orange-50 text-orange-700 border-orange-100",
    icon: Sparkles,
    title: "Tạp vụ văn phòng ca sáng",
    salary: "5.500.000 - 6.500.000đ/tháng",
    area: "Biên Hòa, Đồng Nai",
    code: "CTY020 - MT011",
    tags: ["Bán thời gian", "Ca sáng"],
  },
];

const areas = [
  ["TP.HCM", "8.932 việc làm"],
  ["Bình Dương", "6.245 việc làm"],
  ["Đồng Nai", "4.102 việc làm"],
  ["Long An", "2.356 việc làm"],
  ["Thủ Đức", "3.874 việc làm"],
  ["Dĩ An", "2.918 việc làm"],
  ["Biên Hòa", "2.455 việc làm"],
];

const packages = [
  {
    name: "Gói 5 Tin",
    price: "499k",
    desc: "Tối đa 5 tin tuyển đang bật",
    popular: false,
  },
  {
    name: "Gói 10 Tin",
    price: "799k",
    desc: "Tối đa 10 tin tuyển đang bật",
    popular: true,
  },
  {
    name: "Gói 20 Tin",
    price: "999k",
    desc: "Tối đa 20 tin tuyển đang bật",
    popular: false,
  },
];

function SelectBox({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-200">{label}</span>
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        {placeholder}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
    </label>
  );
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">Ứng tuyển nhanh</h3>
            <p className="mt-1 text-sm text-slate-500">Điền thông tin để nhà tuyển dụng liên hệ với bạn.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {[
            ["Họ và tên", "Nhập họ và tên"],
            ["Số điện thoại", "Nhập số điện thoại"],
            ["Khu vực làm việc", "Chọn tỉnh / thành"],
          ].map(([label, placeholder]) => (
            <label key={label} className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">{label} *</span>
              <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder={placeholder} />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Ghi chú</span>
            <textarea className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder="Nhập ghi chú nếu có" />
          </label>
        </div>
        <button className="mt-5 w-full rounded-xl bg-orange-500 px-5 py-3 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600">
          Gửi thông tin
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">Thông tin của bạn được bảo mật.</p>
      </div>
    </div>
  );
}

export default function ViecLamGanNhaCanvasPrototype() {
  const [modalOpen, setModalOpen] = useState(false);
  const stats = useMemo(
    () => [
      ["Lượt xem tin", "12.450", "+18%", Eye],
      ["Lượt ứng tuyển", "1.256", "+22%", Users],
      ["Tin đang bật", "18", "+5%", Briefcase],
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      {modalOpen && <ApplyModal onClose={() => setModalOpen(false)} />}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071d3a] text-white shadow-lg shadow-slate-900/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="font-extrabold tracking-tight">VIECLAMGANNHA.COM</div>
              <div className="text-xs text-slate-300">Bảo vệ & Lao động phổ thông</div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-200 lg:flex">
            <a href="#jobs" className="hover:text-white">Việc làm</a>
            <a href="#areas" className="hover:text-white">Theo khu vực</a>
            <a href="#categories" className="hover:text-white">Ngành nghề</a>
            <a href="#pricing" className="hover:text-white">Dành cho công ty</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">Đăng nhập</button>
            <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600">
              Đăng ký tuyển dụng
            </button>
          </div>
          <button className="rounded-xl p-2 hover:bg-white/10 lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_35%),linear-gradient(180deg,#ffffff,rgba(239,246,255,0.75))]" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 ring-1 ring-orange-100">
                <Sparkles className="h-4 w-4" /> Việc gần nhà, ứng tuyển nhanh
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">
                Tìm việc làm gần bạn <span className="text-orange-500">bảo vệ</span> & lao động phổ thông
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                Lọc nhanh theo khu vực, ngành nghề và mức lương. Ứng viên gửi form một lần, hồ sơ tự về đúng công ty theo mã nội bộ.
              </p>

              <div className="mt-8 rounded-3xl bg-[#071d3a] p-4 shadow-2xl shadow-slate-900/20">
                <div className="grid gap-3 md:grid-cols-5">
                  <SelectBox label="Tỉnh/Thành" placeholder="Chọn tỉnh / thành" />
                  <SelectBox label="Quận/Huyện" placeholder="Chọn quận / huyện" />
                  <SelectBox label="Ngành nghề" placeholder="Chọn ngành nghề" />
                  <SelectBox label="Mức lương" placeholder="Chọn mức lương" />
                  <button className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 md:mt-6">
                    <Search className="h-4 w-4" /> Tìm việc ngay
                  </button>
                </div>
              </div>

              <div id="categories" className="mt-5 flex flex-wrap gap-2">
                {categories.map((item) => (
                  <button key={item} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-orange-200">
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[420px] lg:block">
              <div className="absolute right-0 top-4 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />
              <div className="absolute inset-x-0 bottom-0 h-72 rounded-[2rem] bg-gradient-to-br from-blue-100 to-slate-100 shadow-inner" />
              <div className="absolute bottom-10 left-12 rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-slate-200">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <ShieldCheck className="h-9 w-9" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Mô hình lõi</div>
                    <div className="text-xl font-black">Mã công ty + mã mục tiêu</div>
                    <div className="mt-1 text-sm text-slate-500">Gửi hồ sơ đúng Telegram</div>
                  </div>
                </div>
              </div>
              <div className="absolute right-8 top-10 w-72 rounded-[2rem] bg-[#071d3a] p-6 text-white shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold">Dashboard</span>
                  <Filter className="h-5 w-5 text-slate-300" />
                </div>
                <div className="text-3xl font-black">1.256</div>
                <div className="text-sm text-slate-300">Lượt ứng tuyển / 7 ngày</div>
                <div className="mt-5 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-3/4 rounded-full bg-orange-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="jobs" className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950 md:text-3xl">Việc làm nổi bật</h2>
              <p className="mt-1 text-slate-500">Không hiển thị tên công ty, chỉ dùng mã nội bộ để điều phối hồ sơ.</p>
            </div>
            <button className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 md:block">Xem tất cả</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {jobs.map((job) => {
              const Icon = job.icon;
              return (
                <article key={job.code} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-[#071d3a] ring-1 ring-slate-100">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${job.color}`}>{job.category}</span>
                  </div>
                  <h3 className="min-h-14 text-lg font-black leading-snug text-slate-950">{job.title}</h3>
                  <div className="mt-3 font-extrabold text-orange-600">{job.salary}</div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" /> {job.area}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <Briefcase className="h-4 w-4" /> {job.code}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{tag}</span>
                    ))}
                  </div>
                  <button onClick={() => setModalOpen(true)} className="mt-5 w-full rounded-xl bg-[#071d3a] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#0b2d57]">
                    Ứng tuyển ngay
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section id="areas" className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-950">Tìm việc theo khu vực</h2>
              <button className="text-sm font-bold text-blue-700">Xem tất cả</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {areas.map(([name, count]) => (
                <button key={name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-orange-200 hover:bg-orange-50">
                  <Building2 className="mb-3 h-7 w-7 text-[#071d3a]" />
                  <div className="font-black text-slate-900">{name}</div>
                  <div className="mt-1 text-sm text-slate-500">{count}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 md:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-black text-slate-950">Gói dịch vụ dành cho công ty</h2>
            <p className="mt-1 text-slate-500">Tính theo số tin tuyển đang bật. Tin tắt hoặc lưu nháp không tính vào giới hạn.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {packages.map((item) => (
                <div key={item.name} className={`relative rounded-3xl p-5 ring-1 ${item.popular ? "bg-orange-50 ring-orange-200" : "bg-slate-50 ring-slate-200"}`}>
                  {item.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">PHỔ BIẾN</div>}
                  <div className="font-black text-slate-950">{item.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-black text-slate-950">{item.price}</span>
                    <span className="pb-1 text-sm text-slate-500">/tháng</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.desc}</p>
                  <button className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-extrabold ${item.popular ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"}`}>
                    Chọn gói
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-950">Dashboard công ty</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">7 ngày qua</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {stats.map(([label, value, growth, Icon]) => {
                const StatIcon = Icon as typeof Eye;
                return (
                  <div key={String(label)} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <StatIcon className="mb-3 h-5 w-5 text-blue-700" />
                    <div className="text-sm font-semibold text-slate-500">{String(label)}</div>
                    <div className="mt-1 text-2xl font-black text-slate-950">{String(value)}</div>
                    <div className="mt-1 text-xs font-bold text-emerald-600">{String(growth)}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500">
                <div>Tin tuyển</div><div>Mã</div><div>Ứng tuyển</div><div>Trạng thái</div>
              </div>
              {jobs.slice(0, 3).map((job, index) => (
                <div key={job.code} className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-800">{job.title}</div>
                  <div className="text-slate-500">{job.code}</div>
                  <div className="font-bold text-slate-900">{126 - index * 28}</div>
                  <div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Đang bật</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#071d3a] px-4 py-10 text-white md:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8" />
              <div className="font-black">VIECLAMGANNHA.COM</div>
            </div>
            <p className="mt-3 text-sm text-slate-300">Việc làm bảo vệ & lao động phổ thông theo khu vực.</p>
          </div>
          <div>
            <div className="font-black">Về chúng tôi</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300"><div>Giới thiệu</div><div>Quy chế hoạt động</div><div>Chính sách bảo mật</div></div>
          </div>
          <div>
            <div className="font-black">Dành cho công ty</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300"><div>Đăng tin tuyển dụng</div><div>Bảng giá dịch vụ</div><div>Hướng dẫn sử dụng</div></div>
          </div>
          <div>
            <div className="font-black">Liên hệ</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300"><div className="flex gap-2"><Phone className="h-4 w-4" /> Hotline: 1900 8888</div><div className="flex gap-2"><WalletCards className="h-4 w-4" /> hotro@vieclamgannha.com</div><div className="flex gap-2"><Clock3 className="h-4 w-4" /> Hỗ trợ trong giờ hành chính</div></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
