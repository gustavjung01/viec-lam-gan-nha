import { ChevronsUpDown, Search } from 'lucide-react';

export const StatusBadge = ({ status }: { status: string }) => {
  const styleMap: { [key: string]: string } = {
  pending: 'bg-yellow-100 text-yellow-700',
  new: 'bg-sky-100 text-sky-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  blocked: 'bg-slate-200 text-slate-800',
  submitted: 'bg-blue-100 text-blue-700',
  claimed: 'bg-indigo-100 text-indigo-700',
  interviewing: 'bg-cyan-100 text-cyan-700',
  hired: 'bg-emerald-100 text-emerald-700',
  qualified: 'bg-purple-100 text-purple-700',
  paid: 'bg-purple-200 text-purple-800',
  disputed: 'bg-orange-100 text-orange-700',
  closed: 'bg-gray-200 text-gray-700',
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        styleMap[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
};

export const ActionButton = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <button
    onClick={onClick}
    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
  >
    {title}
  </button>
);

export const FilterControls = ({
  onSearch,
  onFilter,
  statusOptions,
}: {
  onSearch: (s: string) => void;
  onFilter: (s: string) => void;
  statusOptions: string[];
}) => (
  <div className="flex gap-4">
    <div className="relative flex-grow">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
      <input
        type="text"
        placeholder="Tìm theo tên, SĐT, email..."
        onChange={(e) => onSearch(e.target.value)}
        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm outline-none focus:border-red-400"
      />
    </div>
    <div className="relative">
      <select
        onChange={(e) => onFilter(e.target.value)}
        className="appearance-none w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-red-400 bg-white"
      >
        {statusOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
    </div>
  </div>
);
