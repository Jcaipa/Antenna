'use client';
export default function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={`bg-[rgba(255,255,255,0.82)] border border-[rgba(255,255,255,0.48)] backdrop-blur-[16px] shadow-[0_10px_30px_rgba(31,17,8,0.08)] rounded-[20px] min-w-0 ${padding ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
