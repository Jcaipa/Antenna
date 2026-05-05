'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UnifiedShell from '../components/UnifiedShell';
import Skeleton from '../components/ui/Skeleton';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SOURCE_META = {
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500', endpoint: '/api/data/social?source=reddit' },
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2', endpoint: '/api/data/x/posts' },
  news: { label: 'Noticias', icon: '📰', color: '#2D3748', endpoint: '/api/data/social?source=news' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000', endpoint: '/api/data/social?source=youtube' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF', endpoint: '/api/data/bluesky' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF', endpoint: '/api/data/mastodon' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000', endpoint: '/api/data/tiktok' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600', endpoint: '/api/data/hn-leads' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [detailSource, setDetailSource] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API}/api/data/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchInsights = async () => {
    setInsightsLoading(true);
    const cached = localStorage.getItem('antenna_insights');
    const oneHour = 60 * 60 * 1000;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < oneHour) { setInsights(parsed); setInsightsLoading(false); return; }
    }
    try {
      const res = await fetch(`${API}/api/ai/insights`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      setInsights(data);
      localStorage.setItem('antenna_insights', JSON.stringify({ ...data, ts: Date.now() }));
    } catch (e) { console.error(e); }
    setInsightsLoading(false);
  };

  const openSourceDetail = async (sourceKey) => {
    setDetailSource(sourceKey);
    setDetailLoading(true);
    const meta = SOURCE_META[sourceKey];
    try {
      const res = await fetch(`${API}${meta.endpoint}&limit=20`);
      const data = await res.json();
      setDetailItems(data.items || []);
    } catch { setDetailItems([]); }
    setDetailLoading(false);
  };

  useEffect(() => { fetchSummary(); fetchInsights(); }, []);

  const kpis = summary?.kpis || {};
  const sent = summary?.sentiment_distribution || {};
  const totalMentions = Object.values(kpis).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const totalSent = (sent.positivo || 0) + (sent.neutral || 0) + (sent.negativo || 0);
  const negPct = totalSent > 0 ? Math.round((sent.negativo || 0) / totalSent * 100) : 0;

  if (loading) return (
    <UnifiedShell activeTab="dashboard">
      <div className="space-y-4"><Skeleton height="100px" count={3} /></div>
    </UnifiedShell>
  );

  return (
    <UnifiedShell activeTab="dashboard">
      {/* AI Insights */}
      <div className="mb-5 rounded-[14px] bg-gradient-to-r from-[rgba(255,90,31,0.08)] to-[rgba(255,124,43,0.04)] border border-[rgba(255,90,31,0.15)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm">🤖</span>
              <span className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)]">Resumen de hoy</span>
              {insightsLoading && <span className="w-3 h-3 border-2 border-[#ff5a1f] border-t-transparent rounded-full animate-spin" />}
            </div>
            {insights?.text ? (
              <p className="text-[12px] text-[#5f564f] dark:text-[var(--ink-2)] leading-relaxed">{insights.text}</p>
            ) : insightsLoading ? (
              <div className="space-y-1"><Skeleton height="12px" /><Skeleton height="12px" width="70%" /></div>
            ) : (
              <p className="text-[12px] text-[#988d84]">Ejecuta monitores para ver insights aquí</p>
            )}
          </div>
          <button onClick={fetchInsights} disabled={insightsLoading}
            className="px-2.5 py-1.5 rounded-[6px] text-[10px] font-bold bg-white dark:bg-[#1a1512] border border-[rgba(32,24,19,0.12)] text-[#5f564f] hover:border-[#ff5a1f] transition-all flex-shrink-0">
            {insightsLoading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KPI icon="📢" label="Menciones" value={totalMentions.toLocaleString()} color="#ff5a1f" />
        <KPI icon="📡" label="Canales" value={Object.values(kpis).filter(v => v > 0).length.toString()} color="#4b7bf2" />
        <KPI icon="🔴" label="Negativas" value={`${negPct}%`} color={negPct > 20 ? '#df4d43' : '#2b8e5c'} />
        <KPI icon="🔔" label="Alertas" value={(kpis.total_alerts || 0).toString()} color="#8b63e7" />
      </div>

      {/* Activity Bars */}
      <div className="mb-5">
        <h3 className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)] mb-3">Fuentes activas</h3>
        <div className="space-y-1.5">
          {Object.entries(SOURCE_META).map(([key, meta]) => {
            const kpiKey = `total_${key}`;
            const count = kpis[kpiKey] || 0;
            if (count === 0) return null;
            const maxVal = Math.max(...Object.entries(SOURCE_META).map(([k]) => kpis[`total_${k}`] || 0), 1);
            const pct = (count / maxVal) * 100;
            return (
              <button key={key} onClick={() => openSourceDetail(key)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-[8px] hover:bg-[rgba(32,24,19,0.03)] transition-all text-left">
                <span className="w-5 text-center text-sm flex-shrink-0">{meta.icon}</span>
                <span className="text-[11px] font-bold text-[#5f564f] w-20 flex-shrink-0">{meta.label}</span>
                <div className="flex-1 h-6 bg-[rgba(32,24,19,0.04)] dark:bg-[rgba(255,255,255,0.04)] rounded-[6px] overflow-hidden">
                  <div className="h-full rounded-[6px] transition-all duration-700 ease-out" style={{ width: `${Math.max(pct, 2)}%`, background: meta.color }} />
                </div>
                <span className="text-[12px] font-bold text-[#201813] dark:text-[var(--ink)] w-14 text-right flex-shrink-0">{count.toLocaleString()}</span>
                <span className="text-[9px] text-[#988d84] flex-shrink-0">→</span>
              </button>
            );
          })}
          {Object.values(kpis).filter(v => v > 0).length === 0 && (
            <div className="text-center py-10 text-[12px] text-[#988d84]">
              <p className="mb-1">No hay actividad aún</p>
              <button onClick={() => router.push('/monitors')} className="text-[#ff5a1f] font-bold hover:underline">Ejecuta un monitor</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {detailSource && (
        <div className="mb-5 bg-white dark:bg-[#1a1512] rounded-[14px] border border-[rgba(32,24,19,0.08)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(32,24,19,0.06)]">
            <div className="flex items-center gap-2">
              <span className="text-lg">{SOURCE_META[detailSource]?.icon}</span>
              <span className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)] font-bold">{SOURCE_META[detailSource]?.label}</span>
              <span className="text-[11px] text-[#988d84]">({kpis[`total_${detailSource}`] || 0})</span>
            </div>
            <button onClick={() => setDetailSource(null)} className="text-[#988d84] hover:text-[#201813] text-sm">✕</button>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {detailLoading ? (
              <div className="space-y-3 p-4"><Skeleton height="40px" count={4} /></div>
            ) : detailItems.length === 0 ? (
              <p className="text-center py-6 text-[12px] text-[#988d84]">Sin resultados detallados</p>
            ) : (
              detailItems.slice(0, 15).map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-[8px] hover:bg-[rgba(32,24,19,0.03)] transition-all">
                  <span className="text-sm flex-shrink-0 mt-0.5">{SOURCE_META[detailSource]?.icon || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#201813] dark:text-[var(--ink)] leading-relaxed">
                      {item.titulo || item.title || item.text || ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#988d84] flex-wrap">
                      {item.sentiment && <SentimentBadge value={item.sentiment} />}
                      {item.keyword && <span>#{item.keyword}</span>}
                      {(item.score || item.points) > 0 && <span>▲ {item.score || item.points}</span>}
                      {item.url && <a href={item.url} target="_blank" className="text-[#ff5a1f] ml-auto hover:underline">abrir</a>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {totalSent === 0 ? (
          <div className="bg-white dark:bg-[#1a1512] rounded-[14px] p-5 border text-center text-[12px] text-[#988d84]">
            <p>Sin datos de sentimiento</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a1512] rounded-[14px] p-5 border">
            <h3 className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)] mb-3">Sentimiento</h3>
            <div className="flex gap-1 h-[20px] rounded-[4px] overflow-hidden mb-4">
              <div className="h-full bg-[#10b981] transition-all" style={{ width: `${Math.round((sent.positivo || 0) / totalSent * 100)}%` }} />
              <div className="h-full bg-[rgba(32,24,19,0.12)] transition-all" style={{ width: `${Math.round((sent.neutral || 0) / totalSent * 100)}%` }} />
              <div className="h-full bg-[#ef4444] transition-all" style={{ width: `${Math.round((sent.negativo || 0) / totalSent * 100)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-lg font-bold text-[#10b981] font-syne">{totalSent > 0 ? Math.round((sent.positivo || 0) / totalSent * 100) : 0}%</div><div className="text-[9px] text-[#988d84]">🟢 Positivo</div></div>
              <div><div className="text-lg font-bold text-[rgba(32,24,19,0.4)] font-syne">{totalSent > 0 ? Math.round((sent.neutral || 0) / totalSent * 100) : 0}%</div><div className="text-[9px] text-[#988d84]">⚪ Neutral</div></div>
              <div><div className="text-lg font-bold text-[#ef4444] font-syne">{totalSent > 0 ? Math.round((sent.negativo || 0) / totalSent * 100) : 0}%</div><div className="text-[9px] text-[#988d84]">🔴 Negativo</div></div>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-[#1a1512] rounded-[14px] p-5 border text-center text-[12px] text-[#988d84]">
          <p className="text-2xl mb-2">🔍</p>
          <p>Ve a la sección <button onClick={() => router.push('/social')} className="text-[#ff5a1f] font-bold hover:underline">Social</button> para ver el detalle completo por fuente.</p>
        </div>
      </div>
    </UnifiedShell>
  );
}

function KPI({ icon, label, value, color }) {
  return (
    <div className="bg-[rgba(255,255,255,0.82)] dark:bg-[rgba(26,21,18,0.92)] border border-[rgba(32,24,19,0.06)] rounded-[14px] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.10em] text-[#988d84]">{label}</span>
        <span className="w-8 h-8 rounded-[10px] grid place-items-center text-white text-sm shadow-sm flex-shrink-0" style={{ background: color }}>{icon}</span>
      </div>
      <div className="font-syne text-[clamp(20px,2.5vw,30px)] tracking-[-0.05em] leading-none text-[#201813] dark:text-[var(--ink)]">{value}</div>
    </div>
  );
}

function SentimentBadge({ value }) {
  const colors = { positivo: '#2b8e5c', negativo: '#df4d43', neutral: '#5f564f' };
  const bgColors = { positivo: 'rgba(43,142,92,0.12)', negativo: 'rgba(223,77,67,0.12)', neutral: 'rgba(32,24,19,0.06)' };
  return (
    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-[4px]" style={{ color: colors[value] || '#5f564f', background: bgColors[value] || 'rgba(32,24,19,0.06)' }}>
      {value}
    </span>
  );
}
