'use client';
import { useState, useEffect } from 'react';
import UnifiedShell from '../../components/UnifiedShell';
import Skeleton from '../../components/ui/Skeleton';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SearchPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/data/trends`).then(r=>r.json()).then(setData).catch(()=>setData({}));
  }, []);
  return (
    <UnifiedShell activeTab="search">
      <h2 className="font-syne text-lg text-[#201813] dark:text-[var(--ink)] mb-4">SEO & Search</h2>
      {!data ? <Skeleton height="100px" count={3} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
            <h3 className="font-syne text-[14px] mb-3">🔍 Google SERP Rankings</h3>
            {(data.google_rankings?.length || 0) === 0 ? <p className="text-[#988d84] text-[13px]">Sin datos SERP</p> : data.google_rankings?.map((r,i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0 text-[12px]">
                <span className="font-bold w-6 text-center">{r.position}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-[#988d84]">{r.keyword}</span>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
            <h3 className="font-syne text-[14px] mb-3">🟧 Hacker News</h3>
            {(data.hacker_news?.length || 0) === 0 ? <p className="text-[#988d84] text-[13px]">Sin datos HN</p> : data.hacker_news?.map((h,i) => (
              <div key={i} className="py-2 border-b last:border-0 text-[12px]">
                <a href={h.url} target="_blank" className="font-medium hover:text-[#ff5a1f]">{h.title}</a>
                <div className="flex gap-3 text-[#988d84] text-[11px] mt-0.5">▲ {h.points} · 💬 {h.comments} · {h.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </UnifiedShell>
  );
}
