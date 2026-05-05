'use client';
import { useState, useEffect, useRef } from 'react';
import UnifiedShell from '../../components/UnifiedShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import FlowBuilder from '../../components/FlowBuilder';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CHANNELS = {
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500' },
  news: { label: 'Noticias', icon: '📰', color: '#2D3748' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600' },
  google_alert: { label: 'Google Alerts', icon: '🔔', color: '#4285F4' },
  google_trends: { label: 'Google Trends', icon: '📈', color: '#4285F4' },
  google_serp: { label: 'Google SERP', icon: '🔍', color: '#34A853' },
  google_ads: { label: 'Google Ads', icon: '🎯', color: '#FBBC04' },
  meta_ads: { label: 'Meta Ads', icon: '📱', color: '#1877F2' },
  site_monitor: { label: 'Sitios Web', icon: '🌐', color: '#6B7280' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000000' },
};

export default function MonitorsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [runOutput, setRunOutput] = useState('');
  const [runningJobId, setRunningJobId] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [flowJob, setFlowJob] = useState(null);
  const outputRef = useRef(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API}/api/jobs/`);
      const data = await res.json();
      setJobs(data.items || []);
    } catch (e) { console.error(e); }
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

  const runJob = async (job) => {
    setRunningJobId(job.id);
    setRunOutput('');
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
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    } catch (e) { setRunOutput(`Error: ${e.message}`); }
    setRunningJobId(null);
    fetchJobs();
  };

  const deleteJob = async (id) => {
    if (!confirm('Eliminar este monitor?')) return;
    await fetch(`${API}/api/jobs/${id}`, { method: 'DELETE' });
    fetchJobs();
  };

  return (
    <UnifiedShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-2xl tracking-[-0.03em] text-[#201813] dark:text-[var(--ink)]">Monitores</h1>
          <p className="text-[13px] text-[#988d84] mt-1">Configura y ejecuta monitoreo multicanal</p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && (
            <div className="flex bg-[rgba(32,24,19,0.06)] rounded-[10px] p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  viewMode === 'cards' ? 'bg-white text-[#201813] shadow-sm' : 'text-[#5f564f] hover:text-[#201813]'
                }`}
              >
                📋 Cards
              </button>
              <button
                onClick={() => { setViewMode('flow'); if (!flowJob && jobs.length > 0) setFlowJob(jobs[0]); }}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  viewMode === 'flow' ? 'bg-white text-[#201813] shadow-sm' : 'text-[#5f564f] hover:text-[#201813]'
                }`}
              >
                🔀 Flow
              </button>
            </div>
          )}
          <Button onClick={() => setShowCreate(true)}>+ Nuevo Monitor</Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[rgba(255,255,255,0.82)] border border-[rgba(255,255,255,0.48)] backdrop-blur-[16px] rounded-[20px] p-6">
              <Skeleton height="24px" width="200px" className="mb-4" />
              <div className="flex gap-2 mb-3">
                <Skeleton height="28px" width="60px" />
                <Skeleton height="28px" width="60px" />
                <Skeleton height="28px" width="60px" />
              </div>
              <Skeleton height="16px" width="300px" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && jobs.length === 0 && (
        <div className="text-center py-20 animate-fade-up">
          <div className="text-6xl mb-6 opacity-60">📡</div>
          <h2 className="font-syne text-2xl text-[#201813] dark:text-[var(--ink)] mb-3">Crea tu primer monitor</h2>
          <p className="text-[14px] text-[#988d84] mb-8 max-w-md mx-auto leading-relaxed">
            Define las <strong>keywords</strong> que quieres rastrear, selecciona los <strong>canales</strong>
            donde buscar (X, Reddit, TikTok, Noticias...), y recibe <strong>alertas</strong> en Google Chat.
          </p>
          <Button onClick={() => setShowCreate(true)} className="text-base px-8 py-3">+ Crear Monitor</Button>
        </div>
      )}

      {/* Cards view */}
      {!loading && jobs.length > 0 && viewMode === 'cards' && (
        <div className="space-y-4">
          {jobs.map((job, i) => (
            <Card key={job.id} className="!p-5 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start justify-between gap-4">
                {/* Left: job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => toggleActive(job)}
                      className={`w-[44px] h-[24px] rounded-full relative transition-colors flex-shrink-0 ${
                        job.active ? 'bg-[#2b8e5c]' : 'bg-[#ccc]'
                      }`}
                    >
                      <span className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow transition-all ${
                        job.active ? 'left-[22px]' : 'left-[2px]'
                      }`} />
                    </button>
                    <h3 className="font-syne text-[16px] text-[#201813]">{job.name}</h3>
                    <Badge color={job.active ? 'green' : 'gray'}>{job.active ? 'Activo' : 'Pausado'}</Badge>
                  </div>

                  {/* Keywords */}
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {(typeof job.keywords === 'string' ? JSON.parse(job.keywords) : job.keywords || []).map(kw => (
                      <span key={kw} className="text-[11px] text-[#5f564f] bg-[rgba(32,24,19,0.06)] px-[8px] py-[2px] rounded-[6px]">{kw}</span>
                    ))}
                  </div>

                  {/* Channel badges */}
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {(typeof job.channels === 'string' ? JSON.parse(job.channels) : job.channels || []).map(ch => {
                      const cn = CHANNELS[ch];
                      return cn ? (
                        <span
                          key={ch}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-[8px] py-[2px] rounded-[6px] text-white"
                          style={{ background: cn.color }}
                        >
                          {cn.icon} {cn.label}
                        </span>
                      ) : null;
                    })}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-[11px] text-[#988d84]">
                    <span>Cada {job.schedule_minutes}min</span>
                    {job.last_run_at && <span>Último: {new Date(job.last_run_at).toLocaleString('es')}</span>}
                    <span>{job.notify_google_chat ? '📢' : ''} {job.notify_email ? '📧' : ''}</span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button size="sm" variant="primary" onClick={() => runJob(job)} disabled={runningJobId === job.id}>
                    {runningJobId === job.id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" />
                        Ejecutando...
                      </span>
                    ) : '▶ Ejecutar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setFlowJob(job); setViewMode('flow'); }}>
                    🔀 Flow
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingJob(job); setShowEdit(true); }}>
                    ✏️ Editar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteJob(job.id)}>
                    🗑 Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Flow view - full screen */}
      {!loading && jobs.length > 0 && viewMode === 'flow' && flowJob && (
        <FlowBuilder
          job={flowJob}
          onBack={() => setViewMode('cards')}
          onRun={async () => {
            await runJob(flowJob);
            fetchJobs();
          }}
          onSave={async (body) => {
            await fetch(`${API}/api/jobs/${flowJob.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            fetchJobs();
          }}
        />
      )}

      {/* Run output */}
      {runOutput && (
        <div ref={outputRef} className="mt-6 bg-[#1a1a2e] rounded-[16px] p-4 max-h-[300px] overflow-y-auto">
          <pre className="text-[#0f0] text-[12px] whitespace-pre-wrap m-0 font-mono">{runOutput}</pre>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <JobModal onClose={() => { setShowCreate(false); fetchJobs(); }} />}
      {showEdit && editingJob && (
        <JobModal job={editingJob} onClose={() => { setShowEdit(false); setEditingJob(null); fetchJobs(); }} />
      )}
    </UnifiedShell>
  );
}

function JobModal({ job, onClose }) {
  const isEdit = !!job;
  const [name, setName] = useState(job?.name || '');
  const [keywords, setKeywords] = useState(
    ((typeof job?.keywords === 'string' ? JSON.parse(job.keywords) : job?.keywords) || []).join(', ')
  );
  const [channels, setChannels] = useState(
    (typeof job?.channels === 'string' ? JSON.parse(job.channels) : job?.channels) ||
    Object.keys(CHANNELS)
  );
  const [schedule, setSchedule] = useState(job?.schedule_minutes || 60);
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email ?? false);
  const [rssUrl, setRssUrl] = useState(
    ((typeof job?.google_alerts_rss_urls === 'string' ? JSON.parse(job.google_alerts_rss_urls) : job?.google_alerts_rss_urls) || []).join(', ')
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        channels,
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
        google_alerts_rss_urls: rssUrl.split(',').map(u => u.trim()).filter(Boolean),
      };
      if (isEdit) {
        await fetch(`${API}/api/jobs/${job.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } else {
        await fetch(`${API}/api/jobs/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }
      onClose();
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-[20px] p-7 w-[520px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(31,17,8,0.12)]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-syne text-lg text-[#201813]">{isEdit ? 'Editar' : 'Nuevo'} Monitor</h2>
          <button onClick={onClose} className="text-[#988d84] hover:text-[#201813] text-lg">✕</button>
        </div>

        <label className="block mb-4">
          <span className="text-[12px] font-bold text-[#5f564f] uppercase tracking-[0.08em] block mb-1.5">Nombre</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Vigilancia Visa" className="w-full px-3.5 py-2.5 rounded-[12px] border border-[rgba(32,24,19,0.12)] text-[13px] text-[#201813] outline-none focus:border-[#ff5a1f] focus:shadow-[0_0_0_3px_rgba(255,90,31,0.12)]" />
        </label>

        <label className="block mb-4">
          <span className="text-[12px] font-bold text-[#5f564f] uppercase tracking-[0.08em] block mb-1.5">Keywords (separadas por coma)</span>
          <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="visa, inmigración, Estados Unidos" className="w-full px-3.5 py-2.5 rounded-[12px] border border-[rgba(32,24,19,0.12)] text-[13px] text-[#201813] outline-none focus:border-[#ff5a1f] focus:shadow-[0_0_0_3px_rgba(255,90,31,0.12)]" />
        </label>

        <div className="mb-4">
          <span className="text-[12px] font-bold text-[#5f564f] uppercase tracking-[0.08em] block mb-2">Canales</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CHANNELS).map(([id, ch]) => (
              <button
                key={id}
                onClick={() => setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  channels.includes(id)
                    ? 'text-white' : 'text-[#5f564f] bg-[#f0f0f0] hover:bg-[#e5e5e5]'
                }`}
                style={channels.includes(id) ? { background: ch.color } : {}}
              >
                {ch.icon} {ch.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-4">
          <span className="text-[12px] font-bold text-[#5f564f] uppercase tracking-[0.08em] block mb-1.5">Frecuencia</span>
          <select value={schedule} onChange={e => setSchedule(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-[12px] border border-[rgba(32,24,19,0.12)] text-[13px] text-[#201813] outline-none focus:border-[#ff5a1f] bg-white">
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada hora</option>
            <option value={120}>Cada 2 horas</option>
            <option value={360}>Cada 6 horas</option>
            <option value={720}>Cada 12 horas</option>
            <option value={1440}>Cada día</option>
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-[12px] font-bold text-[#5f564f] uppercase tracking-[0.08em] block mb-1.5">Google Alerts RSS URLs</span>
          <input value={rssUrl} onChange={e => setRssUrl(e.target.value)} placeholder="https://www.google.com/alerts/feeds/..." className="w-full px-3.5 py-2.5 rounded-[12px] border border-[rgba(32,24,19,0.12)] text-[13px] text-[#201813] outline-none focus:border-[#ff5a1f] focus:shadow-[0_0_0_3px_rgba(255,90,31,0.12)]" />
        </label>

        <div className="flex gap-4 mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyChat} onChange={e => setNotifyChat(e.target.checked)} className="w-4 h-4 accent-[#ff5a1f]" />
            <span className="text-[13px] text-[#201813]">📢 Google Chat</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className="w-4 h-4 accent-[#ff5a1f]" />
            <span className="text-[13px] text-[#201813]">📧 Email</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!name || !keywords || saving}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Monitor'}
          </Button>
        </div>
      </div>
    </div>
  );
}
