'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Tabs from './ui/Tabs';
import Button from './ui/Button';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SOURCE_ICONS = {
  x: '𝕏', reddit: '🟠', news: '📰', youtube: '▶️',
  bluesky: '🦋', mastodon: '🐘', hacker_news: '🟧',
  google_alert: '🔔', google_trends: '📈', google_serp: '🔍',
  google_ads: '🎯', meta_ads: '📱', site_monitor: '🌐', tiktok: '🎵',
};

const TOP_TABS = [
  { key: 'monitors', label: 'Monitores', icon: '📋' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'settings', label: 'Config', icon: '⚙️' },
];

const DRAWER_WIDTH = 380;

export default function UnifiedShell({ children, activeTab: forcedTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState('results'); // results | alerts
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(null);

  const activeTab = forcedTab || (pathname === '/dashboard' ? 'dashboard' : 'monitors');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('antenna_user') || 'null');
      setUser(u);
    } catch {}
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API}/api/jobs/`);
      const data = await res.json();
      setJobs(data.items || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const toggleJob = async (job) => {
    await fetch(`${API}/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !job.active }),
    });
    fetchJobs();
  };

  const openResults = async (job) => {
    setActiveJob(job);
    setDrawerOpen(true);
    setDrawerContent('results');
    try {
      const res = await fetch(`${API}/api/jobs/${job.id}/results?limit=50`);
      const data = await res.json();
      setResults(data.items || []);
    } catch {}
  };

  const switchTab = (tab) => {
    if (tab === 'dashboard') router.push('/dashboard');
    else if (tab === 'monitors') router.push('/monitors');
    else if (tab === 'settings') router.push('/settings');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fcf7f2]">
      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-[240px] flex-shrink-0 bg-[rgba(29,19,15,0.97)] text-[rgba(255,255,255,0.75)] flex flex-col h-full overflow-hidden border-r border-[rgba(255,255,255,0.05)] relative">
        {/* Gradient overlay */}
        <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-b from-[rgba(255,90,31,0.07)] via-transparent via-30% to-[rgba(241,198,79,0.05)]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 px-4 pt-6 pb-5 border-b border-[rgba(255,255,255,0.07)] mx-4">
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#ff5a1f] to-[#ff7c2b] grid place-items-center shadow-[0_8px_24px_rgba(255,90,31,0.30)] flex-shrink-0">
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div className="leading-tight">
            <strong className="block font-syne text-[15px] text-white">Antenna</strong>
            <span className="text-[11px] opacity-50">Intelligence</span>
          </div>
        </div>

        {/* Jobs list */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(255,255,255,0.28)] px-3 pb-2">
            Monitores ({jobs.length})
          </div>
          {loading ? (
            <div className="space-y-2 px-3">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-[14px] bg-gradient-to-r from-[rgba(255,255,255,0.04)] via-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.04)] bg-[length:200%_100%] animate-shimmer" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-[rgba(255,255,255,0.3)]">
              No hay monitores
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job.id}
                className={`p-3 rounded-[14px] cursor-pointer transition-all duration-150 ${
                  activeJob?.id === job.id
                    ? 'bg-gradient-to-r from-[rgba(255,90,31,0.20)] to-[rgba(255,124,43,0.08)] shadow-[inset_0_0_0_1px_rgba(255,90,31,0.15)]'
                    : 'hover:bg-[rgba(255,255,255,0.06)]'
                }`}
                onClick={() => openResults(job)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-white truncate">{job.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleJob(job); }}
                    className={`w-[40px] h-[22px] rounded-full relative transition-colors flex-shrink-0 ${
                      job.active ? 'bg-[#2b8e5c]' : 'bg-[rgba(255,255,255,0.15)]'
                    }`}
                  >
                    <span className={`absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-all duration-200 ${
                      job.active ? 'left-[21px]' : 'left-[3px]'
                    }`} />
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords || []).slice(0, 2).map(kw => (
                    <span key={kw} className="text-[10px] text-[rgba(255,255,255,0.35)] bg-[rgba(255,255,255,0.06)] px-[6px] py-[1px] rounded-[6px]">{kw}</span>
                  ))}
                  {(typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords || []).length > 2 && (
                    <span className="text-[10px] text-[rgba(255,255,255,0.25)]">+{((typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords || []).length) - 2}</span>
                  )}
                </div>
              </div>
            ))
          )}

          <a
            href="/monitors?new=1"
            className="flex items-center gap-2 px-3 py-3 mt-2 text-[13px] text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-[14px] transition-all"
          >
            <span className="text-lg leading-none">+</span>
            <span>Nuevo Monitor</span>
          </a>
        </div>

        {/* User info at bottom */}
        <div className="relative z-10 px-4 py-4 border-t border-[rgba(255,255,255,0.07)] mx-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[rgba(255,90,31,0.2)] grid place-items-center text-[12px] font-bold text-[#ff5a1f] flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <strong className="block text-[12px] text-white truncate">{user?.name || 'Usuario'}</strong>
              <span className="text-[10px] opacity-45 truncate block">{user?.email || ''}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-8 pt-5 pb-0 gap-4 flex-wrap">
          <Tabs tabs={TOP_TABS} activeTab={activeTab} onChange={switchTab} />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[#5f564f]">
              <span className="w-2 h-2 rounded-full bg-[#67d391] animate-pulse-slow" />
              Sistema Ready
            </span>
            <a href="/pipelines" className="text-xs text-[#5f564f] hover:text-[#ff5a1f] transition-colors">
              📜 Pipeline
            </a>
            <a href="/ai" className="text-xs text-[#5f564f] hover:text-[#ff5a1f] transition-colors">
              🤖 AI
            </a>
          </div>
        </header>

        {/* Main content */}
        <section className="flex-1 px-8 py-6 overflow-y-auto">
          {children}
        </section>
      </div>

      {/* ── RIGHT DRAWER ── */}
      {drawerOpen && activeJob && (
        <div
          className="flex-shrink-0 border-l border-[rgba(32,24,19,0.10)] bg-white overflow-hidden flex flex-col"
          style={{ width: DRAWER_WIDTH }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(32,24,19,0.06)]">
            <div>
              <h3 className="font-syne text-[15px] tracking-[-0.03em] text-[#201813]">{activeJob.name}</h3>
              <span className="text-[11px] text-[#988d84]">{results.length} resultados</span>
            </div>
            <button onClick={() => setDrawerOpen(false)} className="text-[#988d84] hover:text-[#201813] text-lg">
              ✕
            </button>
          </div>

          {/* Drawer tabs */}
          <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-[rgba(32,24,19,0.06)]">
            <button
              onClick={() => setDrawerContent('results')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                drawerContent === 'results' ? 'bg-[rgba(255,90,31,0.1)] text-[#ff5a1f]' : 'text-[#988d84] hover:text-[#5f564f]'
              }`}
            >
              📊 Resultados
            </button>
            <button
              onClick={() => setDrawerContent('alerts')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                drawerContent === 'alerts' ? 'bg-[rgba(255,90,31,0.1)] text-[#ff5a1f]' : 'text-[#988d84] hover:text-[#5f564f]'
              }`}
            >
              🔔 Alertas
            </button>
          </div>

          {/* Drawer content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {drawerContent === 'results' && (
              results.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-[#988d84]">
                  <p>No hay resultados aún</p>
                  <p className="text-[11px] mt-1">Ejecuta el monitor para ver datos</p>
                </div>
              ) : (
                results.slice(0, 50).map((r, i) => (
                  <div key={r.id || i} className="p-3 rounded-[12px] bg-[#f8f6f4] text-[13px] leading-relaxed">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-[#ff5a1f]">{r.source}</span>
                      <span className="text-[11px] text-[#988d84]">{r.keyword}</span>
                      {r.sentiment && (
                        <span className={`ml-auto text-[10px] ${
                          r.sentiment === 'positivo' ? 'text-[#2b8e5c]' : r.sentiment === 'negativo' ? 'text-[#df4d43]' : 'text-[#988d84]'
                        }`}>
                          {r.sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-[#201813]">{r.title || (r.text || '').slice(0, 200)}</p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener" className="text-[11px] text-[#ff5a1f] hover:underline mt-1 inline-block">
                        🔗 abrir
                      </a>
                    )}
                  </div>
                ))
              )
            )}

            {drawerContent === 'alerts' && (
              <div className="text-center py-10 text-[13px] text-[#988d84]">
                <p>Alertas aparecerán aquí</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
