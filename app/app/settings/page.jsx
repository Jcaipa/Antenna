'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Sidebar from '../../components/Sidebar';
import { fetcher, apiFetch } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

export default function SettingsPage() {
  const router = useRouter();
  const { data: modules, error } = useSWR('/api/runner/modules', fetcher);
  const [running, setRunning] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) router.push('/login');
  }, [router]);

  const updateModule = async (id, field, value) => {
    setSaving(id);
    try {
      await apiFetch(`/api/runner/modules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value })
      });
      mutate('/api/runner/modules');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  const runScraper = async (moduleKey) => {
    setRunning(prev => ({ ...prev, [moduleKey]: true }));
    try {
      // Create EventSource to listen for progress
      const source = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/api/runner/run/${moduleKey}`);
      source.onmessage = (event) => {
        console.log(`[${moduleKey}]`, event.data);
      };
      source.onerror = () => {
        source.close();
        setRunning(prev => ({ ...prev, [moduleKey]: false }));
      };
    } catch (e) {
      setRunning(prev => ({ ...prev, [moduleKey]: false }));
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24 }}>Configuración del Sistema</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Gestiona módulos, keywords y ejecución</p>
          </div>
        </header>

        <section className="content">
          <div className="section-head mb">
            <h2 className="syne">Módulos de Inteligencia</h2>
          </div>

          <div className="grid-2">
            {modules?.map(mod => (
              <div key={mod.id} className="surface card fade-up">
                <div className="card-head">
                  <div>
                    <h3 className="card-title">{mod.label}</h3>
                    <p className="card-note">ID: {mod.id}</p>
                  </div>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      checked={mod.enabled} 
                      onChange={(e) => updateModule(mod.id, 'enabled', e.target.checked)}
                      disabled={saving === mod.id}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Keywords (separadas por coma)</label>
                  <textarea 
                    className="form-textarea" 
                    defaultValue={mod.keywords}
                    onBlur={(e) => updateModule(mod.id, 'keywords', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Países Target (ISO)</label>
                  <input 
                    className="form-input" 
                    defaultValue={mod.countries}
                    onBlur={(e) => updateModule(mod.id, 'countries', e.target.value)}
                  />
                </div>

                <div className="module-actions">
                  <button 
                    className={`btn btn-primary btn-sm ${running[mod.id] ? 'opacity-50' : ''}`}
                    onClick={() => runScraper(mod.id === 'social_listening' ? 'social_news' : mod.id)}
                    disabled={running[mod.id]}
                  >
                    {running[mod.id] ? 'Ejecutando...' : 'Ejecutar Scraper'}
                  </button>
                  <button className="btn btn-outline btn-sm">Ver Logs</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
