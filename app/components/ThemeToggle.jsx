'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('antenna-theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('antenna-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-[15px] transition-all duration-200 hover:bg-[rgba(32,24,19,0.06)] dark:hover:bg-[rgba(255,255,255,0.06)]"
      title={dark ? 'Modo claro' : 'Modo oscuro'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
