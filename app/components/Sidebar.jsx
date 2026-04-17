'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearUser } from '../lib/auth';
import { useEffect, useState } from 'react';

const NAV = [
  {
    label: 'Principal',
    items: [
      { href: '/',           icon: HomeIcon,    label: 'Home' },
      { href: '/dashboard',  icon: ChartIcon,   label: 'Dashboard' },
      { href: '/pipelines',  icon: PipelineIcon, label: 'Pipelines' },
    ]
  },
  {
    label: 'Módulos',
    items: [
      { href: '/dashboard?tab=social',      icon: EarIcon,      label: 'Social Listening' },
      { href: '/dashboard?tab=seo',         icon: SearchIcon,   label: 'SEO / AEO' },
      { href: '/dashboard?tab=competitive', icon: RadarIcon,    label: 'Competitive Intel' },
      { href: '/dashboard?tab=trends',      icon: TrendIcon,    label: 'Trends Engine' },
      { href: '/dashboard?tab=paid',        icon: AdIcon,       label: 'Paid Signals' },
    ]
  },
  {
    label: 'Inteligencia',
    items: [
      { href: '/ai', icon: AIIcon, label: 'Antenna AI' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', icon: GearIcon, label: 'Settings'       },
      { href: '/users',    icon: TeamIcon, label: 'Usuarios',       adminOnly: true },
    ]
  }
];

export default function Sidebar() {
  const path     = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => { setUser(getUser()); }, []);

  function logout() {
    clearUser();
    router.push('/login');
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div className="sb-logo-text">
          <strong>Antenna</strong>
          <span>Intelligence</span>
        </div>
      </div>

      {/* Navigation */}
      {NAV.map(section => {
        const visibleItems = section.items.filter(i => !i.adminOnly || user?.is_admin);
        if (!visibleItems.length) return null;
        return (
          <div key={section.label}>
            <div className="sb-section-label">{section.label}</div>
            {visibleItems.map(item => {
              const Icon = item.icon;
              const active = item.href === '/'
                ? path === '/'
                : path.startsWith(item.href.split('?')[0]) && !item.href.includes('?');
              return (
                <Link key={item.href} href={item.href} className={`sb-link${active ? ' active' : ''}`}>
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}

      {/* Bottom user */}
      <div className="sb-bottom">
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sb-user">
              {user.picture
                ? <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
                : <div className="sb-user-icon">{user.name?.[0]?.toUpperCase() || '?'}</div>
              }
              <div className="sb-user-info">
                <strong>{user.name || 'Usuario'}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <button onClick={logout} className="sb-link" style={{ color: 'rgba(255,100,80,0.75)', width: '100%' }}>
              <LogoutIcon />
              <span>Cerrar sesión</span>
            </button>
          </div>
        ) : (
          <Link href="/login" className="sb-link">
            <LogoutIcon />
            <span>Iniciar sesión</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

/* ── SVG Icons ── */
function HomeIcon()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function ChartIcon()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function EarIcon()         { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function SearchIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function RadarIcon()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>; }
function TrendIcon()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function AdIcon()          { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V9l7 4-7 4z"/></svg>; }
function GearIcon()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function TeamIcon()        { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function LogoutIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function PipelineIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
function AIIcon()          { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>; }
