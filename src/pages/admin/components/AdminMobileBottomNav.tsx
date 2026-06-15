import { BarChart3, Briefcase, Building2, Settings, ShieldCheck, Users, Wallet } from 'lucide-react';
import { TABS } from '../types';

type AdminTab = typeof TABS[number];

interface AdminMobileBottomNavProps {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const ICONS: Record<AdminTab, any> = {
  'Tổng quan': BarChart3,
  CTV: Users,
  'Công ty': Building2,
  'Chiến dịch': Briefcase,
  Lead: ShieldCheck,
  'Tài chính nội bộ': Wallet,
  'Cấu hình': Settings,
};

const SHORT_LABELS: Record<AdminTab, string> = {
  'Tổng quan': 'Tổng',
  CTV: 'CTV',
  'Công ty': 'Cty',
  'Chiến dịch': 'Tin',
  Lead: 'Lead',
  'Tài chính nội bộ': 'Tiền',
  'Cấu hình': 'Cấu hình',
};

export function AdminMobileBottomNav({ activeTab, onChange }: AdminMobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1 pb-[calc(env(safe-area-inset-bottom)+4px)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
      <div className="grid grid-cols-7 gap-1">
        {TABS.map((tab) => {
          const Icon = ICONS[tab];
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-[10px] font-bold ${active ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}
            >
              <Icon className="mb-0.5 h-4 w-4" />
              <span className="leading-none">{SHORT_LABELS[tab]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
