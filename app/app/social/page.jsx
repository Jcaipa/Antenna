'use client';
import { useState, useEffect } from 'react';
import UnifiedShell from '../../components/UnifiedShell';
import Skeleton from '../../components/ui/Skeleton';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TABS = [
  { key: 'reddit', label: 'Reddit', icon: '🟠', color: '#FF4500' },
  { key: 'x', label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  { key: 'news', label: 'Noticias', icon: '📰', color: '#2D3748' },
  { key: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000' },
  { key: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#0085FF' },
  { key: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364FF' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000' },
];

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState('reddit');
  const [data, setData] = useState({ items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoint = activeTab === 'reddit' ? '/api/data/social?source=reddit&limit=50'
      : activeTab === 'x' ? '/api/data/x/posts&limit=50'
      : activeTab === 'youtube' ? '/api/data/social?source=youtube&limit=50'
      : activeTab === 'news' ? '/api/data/social?source=news&limit=50'
      : activeTab === 'bluesky' ? '/api/data/bluesky?limit=50'
      : activeTab === 'mastodon' ? '/api/data/mastodon?limit=50'
      : activeTab === 'tiktok' ? '/api/data/tiktok?limit=50'
      : '/api/data/social?limit=50';
    fetch(`${API}${endpoint}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ items: [] }))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const items = data.items || [];

  return (
    <UnifiedShell activeTab="social">
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${activeTab === tab.key ? 'text-white' : 'text-[#5f564f] hover:bg-[rgba(32,24,19,0.04)]'}`}
            style={{ background: activeTab === tab.key ? tab.color : 'transparent' }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton height="60px" count={5} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-[#988d84]">
          <p className="text-4xl mb-4">{TABS.find(t => t.key === activeTab)?.icon}</p>
          <p>No hay resultados de {TABS.find(t => t.key === activeTab)?.label}</p>
          <p className="text-[11px] mt-1">Ejecuta un monitor con keywords para este canal</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 50).map((item, i) => (
            <div key={i} className="bg-[rgba(255,255,255,0.82)] dark:bg-[rgba(26,21,18,0.92)] rounded-[12px] p-4 border border-[rgba(32,24,19,0.06)]">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{TABS.find(t => t.key === activeTab)?.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#201813] dark:text-[var(--ink)] font-medium leading-relaxed">
                    {item.titulo || item.title || item.text || ''}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-[#988d84] flex-wrap">
                    {item.sentiment && <SentimentBadge value={item.sentiment} />}
                    {item.keyword && <span>#{item.keyword}</span>}
                    {item.score > 0 && <span>▲ {item.score}</span>}
                    {item.likes > 0 && <span>❤️ {item.likes}</span>}
                    {item.url && <a href={item.url} target="_blank" className="text-[#ff5a1f] ml-auto hover:underline">abrir</a>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </UnifiedShell>
  );
}

function SentimentBadge({ value }) {
  const colors = { positivo: '#2b8e5c', negativo: '#df4d43', neutral: '#5f564f' };
  const bgColors = { positivo: 'rgba(43,142,92,0.12)', negativo: 'rgba(223,77,67,0.12)', neutral: 'rgba(32,24,19,0.06)' };
  return (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[4px]" style={{ color: colors[value] || '#5f564f', background: bgColors[value] || 'rgba(32,24,19,0.06)' }}>
      {value}
    </span>
  );
}
