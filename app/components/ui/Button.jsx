'use client';
import { forwardRef } from 'react';

const styles = {
  primary: 'bg-[#ff5a1f] text-white shadow-[0_8px_24px_rgba(255,90,31,0.28)] hover:shadow-[0_12px_30px_rgba(255,90,31,0.38)] hover:-translate-y-[1px]',
  outline: 'border border-[rgba(32,24,19,0.10)] text-[#201813] hover:bg-[rgba(32,24,19,0.04)]',
  ghost: 'bg-[rgba(255,255,255,0.10)] text-white border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.16)]',
  danger: 'bg-[rgba(223,77,67,0.12)] text-[#df4d43] border border-[rgba(223,77,67,0.18)]',
};

const sizes = {
  sm: 'h-[34px] px-[14px] text-xs rounded-[10px]',
  md: 'h-[42px] px-5 text-sm rounded-[14px]',
};

const Button = forwardRef(({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center gap-2 font-bold transition-all duration-150 ${styles[variant] || styles.primary} ${sizes[size] || sizes.md} ${className}`}
    {...props}
  >
    {children}
  </button>
));

Button.displayName = 'Button';
export default Button;
