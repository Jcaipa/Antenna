'use client';
export default function StatCard({ icon, label, value, trend, color = 'brand' }) {
  const colors = {
    brand: 'from-[#ff5a1f] to-[#ff7c2b]',
    blue: 'from-[#4b7bf2] to-[#6b9bf2]',
    green: 'from-[#2b8e5c] to-[#4bae7c]',
    plum: 'from-[#8b63e7] to-[#ab83ff]',
  };
  return (
    <div className="p-5 rounded-[16px] bg-[rgba(255,255,255,0.82)] border border-[rgba(32,24,19,0.06)] shadow-[0_4px_18px_rgba(31,17,8,0.06)]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold tracking-[0.10em] uppercase text-[#988d84]">{label}</span>
        {icon && (
          <span className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${colors[color] || colors.brand} grid place-items-center text-white text-lg shadow-lg flex-shrink-0`}>
            {icon}
          </span>
        )}
      </div>
      <div className="font-syne text-[clamp(22px,2vw,32px)] tracking-[-0.05em] leading-none mb-1.5">{value}</div>
      {trend && (
        <div className={`text-xs font-bold ${trend.startsWith('+') ? 'text-[#2b8e5c]' : trend.startsWith('-') ? 'text-[#df4d43]' : 'text-[#5f564f]'}`}>
          {trend}
        </div>
      )}
    </div>
  );
}
