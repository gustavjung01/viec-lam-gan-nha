import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectBoxProps {
  label: string;
  placeholder: string;
  options?: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function SelectBox({
  label,
  placeholder,
  options = [],
  value = '',
  onChange,
  disabled = false,
}: SelectBoxProps) {
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none rounded-xl bg-white px-3 py-3 text-sm shadow-sm ring-1 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        } ${selectedOption ? 'text-slate-700' : 'text-slate-500'} ring-slate-200 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100`}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}