'use client';
import { useState, useEffect } from 'react';
import UnifiedShell from '../../components/UnifiedShell';
import Skeleton from '../../components/ui/Skeleton';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function WebPage() {
  const [sites, setSites] = useState([]);
  const [hn, setHn] = useState([]);
  useEffect(() => {
    fetch(`${API}/api/data/competitive/sites`).then(r=>r.json()).then(d=>setSites(d.items||[])).catch(()=>{});
    fetch(`${API}/api/data/trends`).then(r=>r.json()).then(d=>setHn(d.hacker_news||[])).catch(()=>{});
  }, []);
  return (
    <UnifiedShell activeTab="web">
      <h2 className="font-syne text-lg text-[#201813] dark:text-[var(--ink)] mb-4">🌐 Web & Tech</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
          <h3 className="font-syne text-[14px] mb-3">🌐 Site Monitor ({sites.length})</h3>
          {sites.length === 0 ? <p className="text-[#988d84] text-[13px]">Sin monitoreo de sitios</p> : sites.map((s,i) => (
            <div key={i} className="py-2 border-b last:border-0 text-[12px]">
              <div className="flex items-center gap-2">
                <a href={s.url} target="_blank" className="font-medium hover:text-[#ff5a1f] truncate">{s.url}</a>
                {s.change_detected && <span className="text-[9px] font-bold text-[#df4d43] bg-[rgba(223,77,67,0.12)] px-1.5 py-0.5 rounded-[4px]">CAMBIO</span>}
              </div>
              <div className="text-[#988d84] text-[11px]">Score: {(s.change_score * 100).toFixed(0) || 'N/A'}% · {s.snapshot_date}</div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-[#1a1512] rounded-[16px] p-5 border shadow-sm">
          <h3 className="font-syne text-[14px] mb-3">🟧 Hacker News ({hn.length})</h3>
          {hn.length === 0 ? <p className="text-[#988d84] text-[13px]">Sin datos de HN</p> : hn.map((h,i) => (
            <div key={i} className="py-2 border-b last:border-0 text-[12px]">
              <a href={h.url} target="_blank" className="font-medium hover:text-[#ff5a1f]">{h.title}</a>
              <div className="text-[#988d84] text-[11px] mt-0.5">▲ {h.points} · 💬 {h.comments}</div>
            </div>
          ))}
        </div>
      </div>
    </UnifiedShell>
  );
}
