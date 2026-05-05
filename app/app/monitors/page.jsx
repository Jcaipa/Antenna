'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiFetch } from '../../lib/api';
import Sidebar from '../../components/Sidebar';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CHANNELS = [
  { id: 'x', label: 'X/Twitter', icon: '𝕏' },
  { id: 'reddit', label: 'Reddit', icon: '🟠' },
  { id: 'news', label: 'Noticias', icon: '📰' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'bluesky', label: 'Bluesky', icon: '🦋' },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘' },
  { id: 'hacker_news', label: 'Hacker News', icon: '🟧' },
  { id: 'google_alert', label: 'Google Alerts', icon: '🔔' },
  { id: 'google_trends', label: 'Google Trends', icon: '📈' },
  { id: 'google_serp', label: 'Google SERP', icon: '🔍' },
  { id: 'google_ads', label: 'Google Ads', icon: '🎯' },
  { id: 'meta_ads', label: 'Meta Ads', icon: '📱' },
  { id: 'site_monitor', label: 'Sitios Web', icon: '🌐' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
];

const SOURCE_COLORS = {
  x: '#1DA1F2', reddit: '#FF4500', news: '#333', youtube: '#FF0000',
  bluesky: '#0085FF', mastodon: '#6364FF', hacker_news: '#FF6600',
  google_alert: '#4285F4',
  google_trends: '#4285F4',
  google_serp: '#34A853',
  google_ads: '#FBBC04',
  meta_ads: '#1877F2',
  site_monitor: '#6B7280',
  tiktok: '#000000',
};

export default function MonitorsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [results, setResults] = useState([]);
  const [expandedResult, setExpandedResult] = useState(null);
  const [runOutput, setRunOutput] = useState('');

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API}/api/jobs/`);
      const data = await res.json();
      setJobs(data.items || []);
    } catch (e) {
      console.error('Error fetching jobs:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const toggleActive = async (job) => {
    await fetch(`${API}/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !job.active }),
    });
    fetchJobs();
  };

  const deleteJob = async (id) => {
    if (!confirm('Eliminar este job?')) return;
    await fetch(`${API}/api/jobs/${id}`, { method: 'DELETE' });
    fetchJobs();
  };

  const runJob = async (job) => {
    setRunOutput('');
    setSelectedJob(null);
    setResults([]);
    try {
      const res = await fetch(`${API}/api/jobs/${job.id}/run`, { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let output = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
        setRunOutput(output);
      }
    } catch (e) {
      setRunOutput(`Error: ${e.message}`);
    }
    // Auto-fetch results after run completes
    setSelectedJob(job);
    fetchResults(job.id);
  };

  const fetchResults = async (jobId) => {
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}/results?limit=100`);
      const data = await res.json();
      setResults(data.items || []);
    } catch (e) {
      console.error('Error fetching results:', e);
    }
  };

  useEffect(() => {
    if (selectedJob) fetchResults(selectedJob.id);
  }, [selectedJob]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando monitores...</div>;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
              Monitores
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '2px 0 0' }}>
              Configura jobs de monitoreo y recibe alertas en Google Chat
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)', color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            + Nuevo Monitor
          </button>
        </header>

        <section className="content" style={{ maxWidth: 1200 }}>
          {loading && <div style={{ padding: 40, textAlign: 'center' }}>Cargando monitores...</div>}

          {!loading && jobs.length === 0 && (
            <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No hay monitores configurados</p>
          )}

          {!loading && jobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {jobs.map(job => (
              <div key={job.id} style={{
            background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => toggleActive(job)} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: job.active ? '#4CAF50' : '#ccc', position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10,
                    background: '#fff', left: job.active ? 22 : 2, transition: 'left 0.2s',
                  }} />
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{job.name}</h3>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    Cada {job.schedule_minutes}min · Último: {job.last_run_at ? new Date(job.last_run_at).toLocaleString('es') : 'Nunca'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {job.channels.map(ch => {
                  const cn = CHANNELS.find(c => c.id === ch);
                  return <span key={ch} title={cn?.label} style={{
                    background: SOURCE_COLORS[ch] || '#999', color: '#fff', borderRadius: 6,
                    padding: '2px 8px', fontSize: 11, fontWeight: 600,
                  }}>{cn?.icon || ch}</span>;
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => runJob(job)} style={{
                  background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontSize: 12,
                }}>
                  ▶ Ejecutar
                </button>
                <button onClick={() => { setSelectedJob(job); fetchResults(job.id); }} style={{
                  background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontSize: 12,
                }}>
                  📊 Resultados
                </button>
                <button onClick={() => { setEditingJob(job); setShowEdit(true); }} style={{
                  background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontSize: 12,
                }}>
                  ✏️ Editar
                </button>
                <button onClick={() => deleteJob(job.id)} style={{
                  background: '#fee', border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontSize: 12, color: '#c00',
                }}>
                  🗑
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords).map(kw => (
                <span key={kw} style={{
                  background: '#f5f0eb', borderRadius: 8, padding: '4px 10px', fontSize: 12,
                }}>{kw}</span>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
              {job.notify_google_chat ? '📢 Google Chat' : ''} {job.notify_email ? '📧 Email' : ''}
            </div>
          </div>
        ))}
      </div>
    )}
      
      {/* Live Output */}
      {runOutput && (
        <div style={{ marginTop: 20, background: '#1a1a2e', borderRadius: 12, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
          <pre style={{ color: '#0f0', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>{runOutput}</pre>
        </div>
      )}

      {/* Results */}
      {selectedJob && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18 }}>Resultados: {selectedJob.name} ({results.length})</h2>
            <button onClick={() => fetchResults(selectedJob.id)} style={{
              background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '6px 12px',
              fontSize: 12, cursor: 'pointer', color: '#666',
            }}>
              🔄 Refrescar
            </button>
          </div>
          {results.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', background: '#f8f6f4', borderRadius: 12, marginTop: 10 }}>
              <p style={{ fontSize: 14, margin: 0 }}>No hay resultados de monitoreo aún</p>
              <p style={{ fontSize: 12, margin: '6px 0 0' }}>Ejecuta el monitor o haz clic en 🔄 Refrescar</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r, i) => (
                <div key={r.id || i} onClick={() => setExpandedResult(expandedResult === i ? null : i)} style={{
                  background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #eee',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: SOURCE_COLORS[r.source] || '#999', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                        {r.source}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.keyword}</span>
                      {r.sentiment && <span style={{ fontSize: 11, color: '#888' }}>
                        {{positivo: '🟢', negativo: '🔴', neutral: '⚪'}[r.sentiment] || '⚪'} {r.sentiment}
                      </span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#999' }}>{r.created_at ? new Date(r.created_at).toLocaleString('es') : ''}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#444', lineHeight: 1.4 }}>
                    {r.title || (r.text || '').slice(0, 150)}
                  </p>
                  {expandedResult === i && (
                    <div style={{ marginTop: 12, padding: '12px', background: '#f8f8f8', borderRadius: 8 }}>
                      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{r.text}</p>
                      {r.url && <a href={r.url} target="_blank" rel="noopener" style={{ color: '#ff5a1f', fontSize: 12, marginTop: 8, display: 'inline-block' }}>🔗 Abrir original</a>}
                      {r.score !== null && <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>Score: {r.score}</span>}
                      {r.metadata && <pre style={{ fontSize: 10, color: '#999', marginTop: 8, maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(r.metadata, null, 2)}</pre>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateJobModal onClose={() => { setShowCreate(false); fetchJobs(); }} />}

      {/* Edit Modal */}
      {showEdit && editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => { setShowEdit(false); setEditingJob(null); fetchJobs(); }}
        />
      )}
    </section>
    </main>
    </div>
  );
}

function CreateJobModal({ onClose }) {
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [channels, setChannels] = useState(['x', 'reddit', 'news', 'youtube', 'bluesky', 'mastodon', 'hacker_news', 'google_alert', 'google_trends', 'google_serp', 'google_ads', 'meta_ads', 'site_monitor']);
  const [schedule, setSchedule] = useState(60);
  const [notifyChat, setNotifyChat] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [rssUrls, setRssUrls] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          channels,
          schedule_minutes: schedule,
          notify_google_chat: notifyChat,
          notify_email: notifyEmail,
          google_alerts_rss_urls: rssUrls.split(',').map(u => u.trim()).filter(Boolean),
        }),
      });
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 20px' }}>Nuevo Monitor</h2>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nombre</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Vigilancia Visa e Inmigración" style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Keywords (separados por coma)</span>
          <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="visa, inmigración, Estados Unidos" style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Canales</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {CHANNELS.map(ch => (
              <button key={ch.id} onClick={() => setChannels(prev =>
                prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id]
              )} style={{
                background: channels.includes(ch.id) ? SOURCE_COLORS[ch.id] : '#f0f0f0',
                color: channels.includes(ch.id) ? '#fff' : '#666',
                border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              }}>
                {ch.icon} {ch.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Frecuencia (minutos)</span>
          <select value={schedule} onChange={e => setSchedule(Number(e.target.value))} style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }}>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada hora</option>
            <option value={120}>Cada 2 horas</option>
            <option value={360}>Cada 6 horas</option>
            <option value={720}>Cada 12 horas</option>
            <option value={1440}>Cada día</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>URLs de Google Alerts RSS (separadas por coma, opcional)</span>
          <input value={rssUrls} onChange={e => setRssUrls(e.target.value)} placeholder="https://www.google.com/alerts/feeds/12345/67890" style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyChat} onChange={e => setNotifyChat(e.target.checked)} />
            <span style={{ fontSize: 13 }}>📢 Google Chat</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} />
            <span style={{ fontSize: 13 }}>📧 Email</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!name || !keywords || saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)',
            color: '#fff',
            cursor: saving ? 'wait' : 'pointer', opacity: saving || !name || !keywords ? 0.6 : 1,
          }}>
            {saving ? 'Creando...' : 'Crear Monitor'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditJobModal({ job, onClose }) {
  const [name, setName] = useState(job.name || '');
  const [keywords, setKeywords] = useState(
    (typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords || []).join(', ')
  );
  const [channels, setChannels] = useState(
    typeof job.channels === 'string' ? JSON.parse(job.channels) : job.channels || []
  );
  const [schedule, setSchedule] = useState(job.schedule_minutes || 60);
  const [notifyChat, setNotifyChat] = useState(job.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job.notify_email ?? false);
  const [rssUrls, setRssUrls] = useState(
    (typeof job.google_alerts_rss_urls === 'string'
      ? JSON.parse(job.google_alerts_rss_urls)
      : job.google_alerts_rss_urls || []
    ).join(', ')
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          channels,
          schedule_minutes: schedule,
          notify_google_chat: notifyChat,
          notify_email: notifyEmail,
          google_alerts_rss_urls: rssUrls.split(',').map(u => u.trim()).filter(Boolean),
        }),
      });
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Editar Monitor</h2>
          <span style={{ fontSize: 11, color: '#999', background: '#f5f0eb', borderRadius: 6, padding: '2px 8px' }}>ID: {job.id}</span>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nombre</span>
          <input value={name} onChange={e => setName(e.target.value)} style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Keywords (separados por coma)</span>
          <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="visa, inmigración, Estados Unidos" style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Canales</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {CHANNELS.map(ch => (
              <button key={ch.id} onClick={() => setChannels(prev =>
                prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id]
              )} style={{
                background: channels.includes(ch.id) ? SOURCE_COLORS[ch.id] : '#f0f0f0',
                color: channels.includes(ch.id) ? '#fff' : '#666',
                border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              }}>
                {ch.icon} {ch.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Frecuencia (minutos)</span>
          <select value={schedule} onChange={e => setSchedule(Number(e.target.value))} style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }}>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada hora</option>
            <option value={120}>Cada 2 horas</option>
            <option value={360}>Cada 6 horas</option>
            <option value={720}>Cada 12 horas</option>
            <option value={1440}>Cada día</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>URLs de Google Alerts RSS (separadas por coma)</span>
          <input value={rssUrls} onChange={e => setRssUrls(e.target.value)} placeholder="https://www.google.com/alerts/feeds/12345/67890" style={{
            width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginTop: 4,
          }} />
        </label>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyChat} onChange={e => setNotifyChat(e.target.checked)} />
            <span style={{ fontSize: 13 }}>📢 Google Chat</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} />
            <span style={{ fontSize: 13 }}>📧 Email</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!name || !keywords || saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)',
            color: '#fff',
            cursor: saving ? 'wait' : 'pointer', opacity: saving || !name || !keywords ? 0.6 : 1,
          }}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
