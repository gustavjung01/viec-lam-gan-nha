import { Link, useLocation } from 'react-router-dom';
import { searchBranches } from '../data/searchBranches';

export function SearchCategoryGrid() {
  const location = useLocation();

  return (
    <div className="mb-6">
      {/* Section title */}
      <h2 className="mb-4 text-lg font-bold text-slate-950">
        Tìm nhanh theo nhu cầu
      </h2>

      {/* Responsive grid: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {searchBranches.map((branch) => {
          const isActive =
            branch.paramKey && branch.paramValue
              ? location.search.includes(`${branch.paramKey}=${branch.paramValue}`)
              : false;

          return (
            <Link
              key={branch.href}
              to={branch.href}
              className={`
                group relative flex flex-col justify-end overflow-hidden rounded-2xl
                aspect-[4/3] bg-slate-200
                transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg
                ${isActive ? 'ring-2 ring-brand-orange' : ''}
              `}
            >
              {/* Background image */}
              <img
                src={branch.image}
                alt={branch.label}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) parent.style.backgroundColor = '#0b2d57';
                }}
              />

              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {/* Text content — HTML, not baked into image */}
              <div className="relative z-10 p-3">
                <p className="text-sm font-black text-white drop-shadow-md sm:text-base">
                  {branch.label}
                </p>
                <p className="mt-0.5 text-xs text-white/80 drop-shadow-sm line-clamp-1">
                  {branch.subtitle}
                </p>
              </div>

              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-orange" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}