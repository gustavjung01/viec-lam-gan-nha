import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Filter, Search, Sparkles } from 'lucide-react';
import { categories, provinces } from '../data/mockData';
import { SelectBox } from './SelectBox';
import { ASSETS } from '../config/assets';

export function HeroSearch() {
  const navigate = useNavigate();
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [salary, setSalary] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (province) params.set('province', province);
    if (district) params.set('district', district);
    if (category) params.set('category', category);
    if (salary) params.set('salary', salary);
    const query = params.toString();
    navigate(`/viec-lam${query ? `?${query}` : ''}`);
  };

  const handleProvinceChange = (value: string) => {
    setProvince(value);
    setDistrict(''); // Reset district when province changes
  };

  const handleCategoryClick = (catValue: string) => {
    navigate(`/viec-lam?category=${catValue}`);
  };

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_35%),linear-gradient(180deg,#ffffff,rgba(239,246,255,0.75))]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 ring-1 ring-orange-100">
            <Sparkles className="h-4 w-4" /> Việc gần nhà, ứng tuyển nhanh
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
            Tuyển Bảo Vệ <span className="text-orange-500">&</span> LDPT
          </h1>

          {/* Mobile/Tablet Hero Image - right after title */}
          <div className="mt-5 block overflow-hidden rounded-2xl lg:hidden">
            <img
              src={ASSETS.heroMobile}
              alt="Tuyển bảo vệ và lao động phổ thông"
              className="h-44 w-full rounded-2xl object-cover object-center sm:h-52"
              loading="eager"
            />
          </div>

          <div className="mt-8 rounded-3xl bg-brand-navy p-4 shadow-2xl shadow-slate-900/20">
            <div className="grid gap-3 md:grid-cols-5">
              <SelectBox
                label="Tỉnh/Thành"
                placeholder="Chọn tỉnh / thành"
                value={province}
                onChange={handleProvinceChange}
                options={provinces.map(p => ({ label: p, value: p }))}
              />
              <SelectBox
                label="Quận/Huyện"
                placeholder="Chọn quận / huyện"
                value={district}
                onChange={setDistrict}
                options={[]}
                disabled={!province}
              />
              <SelectBox
                label="Ngành nghề"
                placeholder="Chọn ngành nghề"
                value={category}
                onChange={setCategory}
                options={categories.map(c => ({ label: c.label, value: c.value }))}
              />
              <SelectBox
                label="Mức lương"
                placeholder="Chọn mức lương"
                value={salary}
                onChange={setSalary}
                options={[
                  { label: '5 - 7 triệu', value: '5-7' },
                  { label: '7 - 10 triệu', value: '7-10' },
                  { label: '10 - 15 triệu', value: '10-15' },
                  { label: 'Trên 15 triệu', value: '15+' },
                ]}
              />
              <button
                onClick={handleSearch}
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 md:mt-6"
              >
                <Search className="h-4 w-4" /> Tìm việc ngay
              </button>
            </div>
          </div>

          <div id="categories" className="mt-5 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.value}
                onClick={() => handleCategoryClick(item.value)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:ring-orange-200 hover:text-brand-orange"
              >
                {item.label}
              </button>
            ))}
          </div>

        </div>

        {/* Desktop hero image - only visible on lg+ */}
        <div className="relative hidden lg:block">
          <div className="relative h-full min-h-[420px] overflow-hidden rounded-[2rem] shadow-2xl">
            <img
              src={ASSETS.heroDesktop}
              alt="Tuyển bảo vệ và lao động phổ thông"
              className="h-full w-full rounded-[2rem] object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-brand-navy/20 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}