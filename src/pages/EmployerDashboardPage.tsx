import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  ChevronRight, 
  Download, 
  Eye, 
  FileText, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Settings, 
  Users,
  ChevronDown,
  Search,
  Bell
} from 'lucide-react';
import { allJobs } from '../data/mockData';

export function EmployerDashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const stats = [
    { label: 'Lượt xem tin', value: '12.450', change: '+18%', icon: Eye, color: 'bg-blue-50 text-blue-700' },
    { label: 'Lượt ứng tuyển', value: '1.256', change: '+22%', icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Tin đang bật', value: '18', change: '+5', icon: Briefcase, color: 'bg-violet-50 text-violet-700' },
    { label: 'Tin sắp hết hạn', value: '3', change: 'Cần gia hạn', icon: FileText, color: 'bg-amber-50 text-amber-700' },
  ];

  const recentJobs = allJobs.slice(0, 4).map((job, index) => ({
    ...job,
    views: 450 - index * 85,
    applies: 32 - index * 7,
    status: index < 3 ? 'active' : 'expiring',
    expiresIn: index === 3 ? '2 ngày' : `${15 - index * 3} ngày`,
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden min-h-screen w-64 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-slate-950">DEMO01</div>
                <div className="text-xs text-slate-500">Nhà tuyển dụng</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3">
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  activeTab === 'dashboard' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" /> Tổng quan
              </button>
              <button 
                onClick={() => setActiveTab('jobs')}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  activeTab === 'jobs' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Briefcase className="h-4 w-4" /> Tin tuyển dụng
              </button>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Users className="h-4 w-4" /> Ứng viên
              </button>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <FileText className="h-4 w-4" /> Báo cáo
              </button>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Settings className="h-4 w-4" /> Cài đặt
              </button>
            </div>
          </nav>

          <div className="border-t border-slate-200 p-3">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm text-slate-500 hover:text-brand-blue lg:hidden">
                ← Trang chủ
              </Link>
              <h1 className="hidden text-lg font-bold text-slate-950 lg:block">Dashboard Nhà Tuyển Dụng</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">3</span>
              </button>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 md:flex">
                <div className="h-7 w-7 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center">NT</div>
                <span className="text-sm font-medium text-slate-700">Người dùng</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </header>

          <div className="p-4 lg:p-6">
            {/* Actions bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600">
                  <Plus className="h-4 w-4" /> Đăng tin mới
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Download className="h-4 w-4" /> Xuất báo cáo
                </button>
              </div>
              <div className="text-sm text-slate-500">
                Gói hiện tại: <span className="font-bold text-slate-950">Gói 10 Tin (799k/tháng)</span>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className={`inline-flex rounded-xl p-2 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm text-slate-500">{stat.label}</div>
                  <div className="mt-1 flex items-end justify-between">
                    <div className="text-2xl font-black text-slate-950">{stat.value}</div>
                    <div className={`text-xs font-semibold ${stat.change.includes('+') ? 'text-emerald-600' : stat.change.includes('Cần') ? 'text-amber-600' : 'text-slate-500'}`}>
                      {stat.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent jobs table */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 lg:p-5">
                <h2 className="font-bold text-slate-950">Tin tuyển dụng gần đây</h2>
                <Link to="/viec-lam" className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline">
                  Xem tất cả <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Tin tuyển</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Mã</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Lượt xem</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Ứng tuyển</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Còn lại</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-950">{job.title}</div>
                          <div className="text-xs text-slate-500">{job.categoryLabel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600">
                            {job.companyCode}-{job.targetCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{job.views.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-950">{job.applies}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{job.expiresIn}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            job.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${job.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {job.status === 'active' ? 'Đang bật' : 'Sắp hết hạn'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-950">Nâng cấp gói</h3>
                <p className="mt-1 text-sm text-slate-500">Tăng số lượng tin tuyển và tính năng premium.</p>
                <button className="mt-4 w-full rounded-xl bg-brand-navy py-2.5 text-sm font-bold text-white hover:bg-[#0b2d57]">
                  Xem bảng giá
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-950">Hỗ trợ kỹ thuật</h3>
                <p className="mt-1 text-sm text-slate-500">Gặp vấn đề? Liên hệ team hỗ trợ 24/7.</p>
                <button className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Liên hệ
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-950">Hướng dẫn sử dụng</h3>
                <p className="mt-1 text-sm text-slate-500">Xem video hướng dẫn quản lý tin tuyển dụng.</p>
                <button className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Xem hướng dẫn
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
