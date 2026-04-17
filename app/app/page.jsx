'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Sidebar from '../components/Sidebar';
import ModuleCard from '../components/ModuleCard';
import Generator from '../components/Generator';
import { fetcher } from '../lib/api';
import { isLoggedIn, getUser } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { data } = useSWR('/api/data/summary', fetcher, { refreshInterval: 8000 });

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    } else {
      setUser(getUser());
    }
  }, [router]);

  if (!user) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>
              Intelligence Tool
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Bienvenido, {user.name?.split(' ')[0] || 'Usuario'}</p>
          </div>
          <div className="hero-status">
            <div className="dot-live"></div>
            <strong>Sistema Ready</strong>
          </div>
        </header>

        <section className="content">
          <div className="mb">
            <Generator />
          </div>

          <div className="section-head mb">
            <h3 className="syne">KPIs Principales</h3>
          </div>

          <div className="kpi-grid mb">
            <div className="kpi-card fade-up">
              <div className="kpi-label">Menciones Social</div>
              <div className="kpi-value">{(data?.kpis?.total_news || 0) + (data?.kpis?.total_reddit || 0)}</div>
              <div className="kpi-sub"><span className="kpi-up">+12%</span> vs ayer</div>
            </div>
            <div className="kpi-card fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="kpi-label">Keywords en Trend</div>
              <div className="kpi-value">{data?.kpis?.total_trends || 0}</div>
              <div className="kpi-sub">Actualizado hoy</div>
            </div>
            <div className="kpi-card fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="kpi-label">Rankings SEO</div>
              <div className="kpi-value">{data?.kpis?.total_serp || 0}</div>
              <div className="kpi-sub"><span className="kpi-up">3</span> nuevas posiciones</div>
            </div>
            <div className="kpi-card fade-up" style={{ animationDelay: '0.3s' }}>
              <div className="kpi-label">Competidores</div>
              <div className="kpi-value">{data?.kpis?.total_competitors || 0}</div>
              <div className="kpi-sub">3 activos</div>
            </div>
          </div>

          <div className="section-head mb">
            <h3 className="syne">Módulos del Sistema</h3>
          </div>

          <div className="module-grid">
            <ModuleCard 
              label="Social Listening" 
              status={data?.modules_status?.social_listening}
              meta={`${data?.kpis?.total_news || 0} noticias detectadas`}
              icon={SocialIcon}
              onClick={() => router.push('/dashboard?tab=social')}
            />
            <ModuleCard 
              label="SEO / AEO" 
              status={data?.modules_status?.seo}
              meta={`${data?.kpis?.total_serp || 0} keywords traqueadas`}
              icon={SeoIcon}
              onClick={() => router.push('/dashboard?tab=seo')}
            />
            <ModuleCard 
              label="Competitive Intel" 
              status={data?.modules_status?.competitive}
              meta="Check de autoridad completado"
              icon={CompIcon}
              onClick={() => router.push('/dashboard?tab=competitive')}
            />
            <ModuleCard 
              label="Trends Engine" 
              status={data?.modules_status?.trends}
              meta={`${data?.kpis?.total_hn || 0} señales tech`}
              icon={TrendIcon}
              onClick={() => router.push('/dashboard?tab=trends')}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function SocialIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function SeoIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function CompIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>; }
function TrendIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
