'use client';
const colors = {
  green: 'text-[#2b8e5c] bg-[rgba(43,142,92,0.12)] border-[rgba(43,142,92,0.18)]',
  red: 'text-[#df4d43] bg-[rgba(223,77,67,0.12)] border-[rgba(223,77,67,0.18)]',
  amber: 'text-[#ca8b16] bg-[rgba(202,139,22,0.14)] border-[rgba(202,139,22,0.18)]',
  blue: 'text-[#4b7bf2] bg-[rgba(75,123,242,0.12)] border-[rgba(75,123,242,0.18)]',
  plum: 'text-[#8b63e7] bg-[rgba(139,99,231,0.12)] border-[rgba(139,99,231,0.18)]',
  gray: 'text-[#5f564f] bg-[rgba(32,24,19,0.06)] border-[rgba(32,24,19,0.08)]',
};

export default function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-[5px] h-[26px] px-[10px] rounded-full text-[10px] font-bold tracking-[0.05em] uppercase border ${colors[color] || colors.gray} ${className}`}>
      {children}
    </span>
  );
}
