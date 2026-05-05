'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UnifiedShell from '../components/UnifiedShell';
import Skeleton from '../components/ui/Skeleton';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SOURCE_META = {
  news: { label: 'Noticias', icon: '📰', color: '#2D3748' },
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500' },
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000' },
  hn_leads: { label: 'HN Leads', icon: '📊', color: '#FF6600' },
  google_alert: { label: 'Google Alerts', icon: '🔔', color: '#4285F4' },
  trends: { label: 'Trends', icon: '📈', color: '#4285F4' },
  serp: { label: 'SERP', icon: '🔍', color: '#34A853' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);

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
    try {
      const res = await fetch(`${API}/api/ai/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setInsights(data);
      localStorage.setItem('antenna_insights', JSON.stringify({ ...data, ts: Date.now() }));
    } catch (e) { console.error(e); }
    setInsightsLoading(false);
  };

  useEffect(() => { fetchSummary(); }, []);

  useEffect(() => {
    const cached = localStorage.getItem('antenna_insights');
    const oneHour = 60 * 60 * 1000;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < oneHour) {
        setInsights(parsed);
        return;
      }
    }
    fetchInsights();
  }, []);

  const kpis = summary?.kpis || {};
  const sent = summary?.sentiment_distribution || {};
  const totalMentions = Object.values(kpis).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  const totalSent = (sent.positivo || 0) + (sent.neutral || 0) + (sent.negativo || 0);
  const negPct = totalSent > 0 ? Math.round((sent.negativo || 0) / totalSent * 100) : 0;

  if (loading) return (
    <UnifiedShell activeTab="dashboard">
      <div className="space-y-6 animate-fade-up">
        <Skeleton height="32px" width="300px" />
        <div className="grid grid-cols-4 gap-4"><Skeleton height="100px" count={4} /></div>
        <Skeleton height="160px" />
        <Skeleton height="200px" />
      </div>
    </UnifiedShell>
  );

  return (
    <UnifiedShell activeTab="dashboard">
      {/* AI Insights */}
      <div className="mb-6 rounded-[16px] bg-gradient-to-r from-[rgba(255,90,31,0.08)] to-[rgba(255,124,43,0.04)] border border-[rgba(255,90,31,0.15)] p-5 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#ff5a1f] to-[#ff7c2b] grid place-items-center text-white text-sm">🤖</span>
              <h2 className="font-syne text-[16px] text-[#201813] dark:text-[var(--ink)]">AI Insights</h2>
              {insightsLoading && <span className="w-4 h-4 border-2 border-[#ff5a1f] border-t-transparent rounded-full animate-spin" />}
            </div>
            {insights?.text ? (
              <p className="text-[13px] text-[#5f564f] dark:text-[var(--ink-2)] leading-relaxed">{insights.text}</p>
            ) : insightsLoading ? (
              <div className="space-y-2"><Skeleton height="14px" /><Skeleton height="14px" width="80%" /></div>
            ) : (
              <p className="text-[13px] text-[#988d84]">No hay suficientes datos para generar insights. Ejecuta monitores primero.</p>
            )}
          </div>
          <button onClick={fetchInsights} disabled={insightsLoading}
            className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-white dark:bg-[#1a1512] border border-[rgba(32,24,19,0.12)] text-[#5f564f] hover:border-[#ff5a1f] transition-all flex-shrink-0">
            {insightsLoading ? 'Analizando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <DashboardKPI icon="📢" label="Menciones totales" value={totalMentions.toLocaleString()} color="brand" />
        <DashboardKPI icon="📡" label="Canales activos" value={Object.values(kpis).filter(v => v > 0).length.toString()} color="blue" />
        <DashboardKPI icon="🔴" label="Negatividad" value={`${negPct}%`} trend={negPct > 20 ? '+ Preocupante' : 'Normal'} color={negPct > 20 ? 'red' : 'green'} />
        <DashboardKPI icon="🔔" label="Alertas activas" value={(kpis.total_alerts || 0).toString()} color="plum" />
      </div>

      {/* Activity Bars */}
      <div className="mb-6">
        <h3 className="font-syne text-[15px] text-[#201813] dark:text-[var(--ink)] mb-4">Actividad por fuente</h3>
        <div className="space-y-2">
          {Object.entries(SOURCE_META).map(([key, meta]) => {
            const kpiKey = `total_${key}`;
            const count = kpis[kpiKey] || 0;
            if (count === 0) return null;
            const maxVal = Math.max(...Object.entries(SOURCE_META).map(([k]) => kpis[`total_${k}`] || 0), 1);
            const pct = (count / maxVal) * 100;
            return (
              <div key={key} className="flex items-center gap-3 group cursor-pointer hover:bg-[rgba(32,24,19,0.02)] rounded-[8px] px-2 py-1 transition-all"
                onClick={() => {
                  const tabMap = { news: 'social', reddit: 'social', x: 'x', youtube: 'social', bluesky: 'social', mastodon: 'social', hacker_news: 'trends', tiktok: 'social' };
                  router.push(`/dashboard?tab=${tabMap[key] || 'social'}`);
                }}>
                <span className="w-6 text-center text-base flex-shrink-0">{meta.icon}</span>
                <span className="text-[12px] font-bold text-[#5f564f] w-24 flex-shrink-0">{meta.label}</span>
                <div className="flex-1 h-7 bg-[rgba(32,24,19,0.04)] rounded-[6px] overflow-hidden relative">
                  <div className="h-full rounded-[6px] transition-all duration-700 ease-out" style={{ width: `${Math.max(pct, 2)}%`, background: meta.color }} />
                </div>
                <span className="text-[13px] font-bold text-[#201813] dark:text-[var(--ink)] w-16 text-right flex-shrink-0">{count.toLocaleString()}</span>
              </div>
            );
          })}
          {Object.values(kpis).filter(v => v > 0).length === 0 && (
            <div className="text-center py-10 text-[13px] text-[#988d84]">
              <p>No hay datos de actividad aún</p>
              <p className="text-[11px] mt-1">Ejecuta un monitor para ver resultados aquí</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid: Recent Items + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Top Mentions */}
        <RecentMentionsCard api={API} />

        {/* Sentiment Distribution */}
        <SentimentCard sent={sent} />
      </div>
    </UnifiedShell>
  );
}

function DashboardKPI({ icon, label, value, trend, color }) {
  const colors = { brand: '#ff5a1f', blue: '#4b7bf2', green: '#2b8e5c', red: '#df4d43', plum: '#8b63e7' };
  const c = colors[color] || colors.brand;
  return (
    <div className="bg-[rgba(255,255,255,0.82)] dark:bg-[rgba(26,21,18,0.92)] border border-[rgba(32,24,19,0.06)] rounded-[16px] p-5 shadow-[0_4px_18px_rgba(31,17,8,0.06)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-[#988d84]">{label}</span>
        <span className="w-10 h-10 rounded-[12px] grid place-items-center text-white text-lg shadow-sm flex-shrink-0" style={{ background: c }}>{icon}</span>
      </div>
      <div className="font-syne text-[clamp(24px,2.5vw,36px)] tracking-[-0.05em] leading-none text-[#201813] dark:text-[var(--ink)]">{value}</div>
      {trend && <div className={`text-[11px] font-bold mt-1.5 ${trend.includes('Preocupante') ? 'text-[#df4d43]' : 'text-[#2b8e5c]'}`}>{trend}</div>}
    </div>
  );
}

function RecentMentionsCard({ api }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch(`${api}/api/data/social?limit=8`).then(r => r.json()).then(d => setItems(d.items || [])).catch(() => {});
  }, [api]);

  return (
    <div className="bg-[rgba(255,255,255,0.82)] dark:bg-[rgba(26,21,18,0.92)] border border-[rgba(32,24,19,0.06)] rounded-[16px] p-5 shadow-[0_4px_18px_rgba(31,17,8,0.06)]">
      <h3 className="font-syne text-[15px] text-[#201813] dark:text-[var(--ink)] mb-4">Últimas menciones</h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-[#988d84] text-center py-8">No hay menciones recientes</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 pb-3 border-b border-[rgba(32,24,19,0.06)] last:border-0 last:pb-0">
              <span className="text-sm flex-shrink-0">{item.fuente === 'Reddit' ? '🟠' : item.fuente === 'YouTube' ? '▶️' : '📰'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#201813] dark:text-[var(--ink)] leading-relaxed line-clamp-2">
                  {item.titulo || (item.title || '')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[4px]"
                    style={{
                      background: item.sentiment === 'positivo' ? 'rgba(43,142,92,0.12)' : item.sentiment === 'negativo' ? 'rgba(223,77,67,0.12)' : 'rgba(32,24,19,0.06)',
                      color: item.sentiment === 'positivo' ? '#2b8e5c' : item.sentiment === 'negativo' ? '#df4d43' : '#5f564f',
                    }}>
                    {item.sentiment || 'neutral'}
                  </span>
                  {item.keyword && <span className="text-[9px] text-[#988d84]">#{item.keyword}</span>}
                  {item.url && <a href={item.url} target="_blank" className="text-[9px] text-[#ff5a1f] ml-auto hover:underline">abrir</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SentimentCard({ sent }) {
  const total = (sent.positivo || 0) + (sent.neutral || 0) + (sent.negativo || 0);
  const posPct = total > 0 ? Math.round((sent.positivo || 0) / total * 100) : 0;
  const neuPct = total > 0 ? Math.round((sent.neutral || 0) / total * 100) : 0;
  const negPct = total > 0 ? Math.round((sent.negativo || 0) / total * 100) : 0;

  return (
    <div className="bg-[rgba(255,255,255,0.82)] dark:bg-[rgba(26,21,18,0.92)] border border-[rgba(32,24,19,0.06)] rounded-[16px] p-5 shadow-[0_4px_18px_rgba(31,17,8,0.06)]">
      <h3 className="font-syne text-[15px] text-[#201813] dark:text-[var(--ink)] mb-4">Distribución del sentimiento</h3>
      {total === 0 ? (
        <p className="text-[13px] text-[#988d84] text-center py-8">Sin datos de sentimiento aún</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="flex-1 h-[24px] rounded-[6px] overflow-hidden flex">
              <div className="h-full bg-[#10b981] transition-all duration-700" style={{ width: `${posPct}%` }} />
              <div className="h-full bg-[rgba(32,24,19,0.12)] transition-all duration-700" style={{ width: `${neuPct}%` }} />
              <div className="h-full bg-[#ef4444] transition-all duration-700" style={{ width: `${negPct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[20px] font-bold text-[#10b981] font-syne">{posPct}%</div>
              <div className="text-[10px] text-[#988d84]">🟢 Positivo</div>
              <div className="text-[11px] font-bold text-[#5f564f]">{sent.positivo || 0}</div>
            </div>
            <div>
              <div className="text-[20px] font-bold text-[rgba(32,24,19,0.4)] font-syne">{neuPct}%</div>
              <div className="text-[10px] text-[#988d84]">⚪ Neutral</div>
              <div className="text-[11px] font-bold text-[#5f564f]">{sent.neutral || 0}</div>
            </div>
            <div>
              <div className="text-[20px] font-bold text-[#ef4444] font-syne">{negPct}%</div>
              <div className="text-[10px] text-[#988d84]">🔴 Negativo</div>
              <div className="text-[11px] font-bold text-[#5f564f]">{sent.negativo || 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
