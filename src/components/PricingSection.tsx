import { pricingPlans } from '../config/site';

export function PricingSection() {
  return (
    <div id="pricing" className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-2xl font-black text-slate-950">Gói dịch vụ dành cho công ty</h2>
      <p className="mt-1 text-slate-500">Tính theo số tin tuyển đang bật. Tin tắt hoặc lưu nháp không tính vào giới hạn.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {pricingPlans.map((item) => (
          <div key={item.name} className={`relative rounded-3xl p-5 ring-1 ${item.popular ? 'bg-orange-50 ring-orange-200' : 'bg-slate-50 ring-slate-200'}`}>
            {item.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-orange px-3 py-1 text-xs font-black text-white">PHỔ BIẾN</div>}
            <div className="font-black text-slate-950">{item.name}</div>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-black text-slate-950">{item.price}</span>
              <span className="pb-1 text-sm text-slate-500">/tháng</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.limit}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {item.highlights.map((line) => <li key={line}>✓ {line}</li>)}
            </ul>
            <button className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-extrabold ${item.popular ? 'bg-brand-orange text-white hover:bg-orange-600' : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
              Chọn gói
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
