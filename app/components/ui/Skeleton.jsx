'use client';
export default function Skeleton({ className = '', width, height = '16px', count = 1 }) {
  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          className={`bg-gradient-to-r from-[rgba(32,24,19,0.05)] via-[rgba(32,24,19,0.08)] to-[rgba(32,24,19,0.05)] bg-[length:200%_100%] animate-shimmer rounded-[8px] ${className}`}
          style={{ width, height }}
        />
      ))}
    </>
  );
}
