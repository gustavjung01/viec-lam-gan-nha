import { Filter, RotateCcw, Search } from 'lucide-react';

export interface AdminFilterField {
  key: string;
  label: string;
  type?: 'search' | 'select' | 'date' | 'text';
  value: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface AdminFilterBarProps {
  title?: string;
  count?: number;
  fields: AdminFilterField[];
  onChange: (key: string, value: string) => void;
  onReset: () => void;
}

export function AdminFilterBar({ title = 'Bộ lọc', count, fields, onChange, onReset }: AdminFilterBarProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {typeof count === 'number' && <p className="text-xs text-slate-500">{count.toLocaleString('vi-VN')} dòng đang hiển thị</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => {
          const baseClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100';

          if (field.type === 'select') {
            return (
              <label key={field.key} className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
                <select value={field.value} onChange={(e) => onChange(field.key, e.target.value)} className={baseClass}>
                  {(field.options || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={field.key} className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
              <div className="relative">
                {field.type === 'search' && <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />}
                <input
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={field.value}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${baseClass} ${field.type === 'search' ? 'pl-10' : ''}`}
                />
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
