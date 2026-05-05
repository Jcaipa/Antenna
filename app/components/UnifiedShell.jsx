'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NAV_SECTIONS = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/social', icon: '📱', label: 'Social' },
  { href: '/search', icon: '🔍', label: 'SEO & Search' },
  { href: '/ads', icon: '💰', label: 'Ads' },
  { href: '/web', icon: '🌐', label: 'Web & Tech' },
  { type: 'divider' },
  { href: '/monitors', icon: '📋', label: 'Monitores' },
  { type: 'divider' },
  { href: '/ai', icon: '🤖', label: 'AI Analysis' },
  { type: 'divider' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
  { href: '/users', icon: '👥', label: 'Usuarios' },
];

export default function UnifiedShell({ children, activeTab: forcedTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('antenna_user') || 'null');
      setUser(u);
    } catch {}
  }, []);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fcf7f2] dark:bg-[#0f0b09] transition-colors duration-200">
      {/* SIDEBAR */}
      <aside
        className={`flex-shrink-0 bg-[rgba(29,19,15,0.97)] text-[rgba(255,255,255,0.75)] flex flex-col h-full overflow-hidden border-r border-[rgba(255,255,255,0.05)] relative z-20 transition-all duration-200 ${
          sidebarCollapsed ? 'w-[64px]' : 'w-[200px]'
        }`}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 pt-5 pb-4 border-b border-[rgba(255,255,255,0.07)] ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#ff5a1f] to-[#ff7c2b] grid place-items-center shadow-[0_8px_24px_rgba(255,90,31,0.30)] flex-shrink-0">
            <svg className="w-[18px] h-[18px] fill-white" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          {!sidebarCollapsed && <span className="font-syne text-[14px] text-white font-bold">Antenna</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {NAV_SECTIONS.map((item, i) => {
            if (item.type === 'divider') return <div key={i} className="h-px bg-[rgba(255,255,255,0.06)] mx-3 my-2" />;
            const active = isActive(item.href);
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[12px] font-medium transition-all ${
                  active ? 'bg-[rgba(255,90,31,0.2)] text-white' : 'hover:bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.55)]'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className={`px-3 py-3 border-t border-[rgba(255,255,255,0.07)] ${sidebarCollapsed ? 'text-center' : ''}`}>
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-[rgba(255,90,31,0.2)] grid place-items-center text-[10px] font-bold text-[#ff5a1f] flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            {!sidebarCollapsed && <div className="flex-1 min-w-0">
              <strong className="block text-[11px] text-white truncate">{user?.name || 'Usuario'}</strong>
              <span className="text-[9px] opacity-45 truncate block">{user?.email || ''}</span>
            </div>}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Simple topbar — solo status + theme */}
        <header className="flex items-center justify-between px-6 pt-3 pb-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-[#5f564f]">
              <span className="w-2 h-2 rounded-full bg-[#67d391] animate-pulse-slow" />
              Antenna Live
            </span>
            <a href="/monitors" className="text-[11px] text-[#5f564f] hover:text-[#ff5a1f] transition-colors" title="Monitores">📋</a>
            <a href="/pipeline/mon_visa" className="text-[11px] text-[#5f564f] hover:text-[#ff5a1f] transition-colors" title="Pipeline">🔀</a>
            <a href="/ai" className="text-[11px] text-[#5f564f] hover:text-[#ff5a1f] transition-colors" title="AI">🤖</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        <section className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </section>
      </div>
    </div>
  );
}
