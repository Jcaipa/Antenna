'use client';
import { useState, useEffect } from 'react';
import UnifiedShell from '../../components/UnifiedShell';
import Skeleton from '../../components/ui/Skeleton';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdsPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/data/paid`).then(r=>r.json()).then(setData).catch(()=>setData({}));
  }, []);
  return (
    <UnifiedShell activeTab="ads">
      <h2 className="font-syne text-lg text-[#201813] dark:text-[var(--ink)] mb-4">💰 Paid Ads</h2>
      {!data ? <Skeleton height="100px" count={3} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
            <h3 className="font-syne text-[14px] mb-3">🎯 Google Ads ({data.total_google || 0})</h3>
            {(data.google_ads?.length || 0) === 0 ? <p className="text-[#988d84] text-[13px]">Sin anuncios Google</p> : data.google_ads?.map((a,i) => (
              <div key={i} className="py-2 border-b last:border-0 text-[12px]">
                <div className="font-medium">{a.page_name}</div>
                <div className="text-[#988d84] text-[11px]">{a.copy?.slice(0,100)}</div>
                <div className="flex gap-2 mt-0.5 text-[10px] text-[#988d84]">#{a.keyword} · {a.country}</div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
            <h3 className="font-syne text-[14px] mb-3">📱 Meta Ads ({data.total_meta || 0})</h3>
            {(data.meta_ads?.length || 0) === 0 ? <p className="text-[#988d84] text-[13px]">Sin anuncios Meta</p> : data.meta_ads?.map((a,i) => (
              <div key={i} className="py-2 border-b last:border-0 text-[12px]">
                <div className="font-medium">{a.page_name}</div>
                <div className="text-[#988d84] text-[11px]">{a.copy?.slice(0,100)}</div>
                <div className="flex gap-2 mt-0.5 text-[10px] text-[#988d84]">#{a.keyword} · {a.country}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </UnifiedShell>
  );
}
