'use client';
import { useState, useRef, useEffect } from 'react';
import { API } from '../lib/api';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

const ALL_COUNTRIES = [
  { code: 'us', label: 'United States',      flag: '🇺🇸' },
  { code: 'mx', label: 'México',             flag: '🇲🇽' },
  { code: 'co', label: 'Colombia',           flag: '🇨🇴' },
  { code: 'ar', label: 'Argentina',          flag: '🇦🇷' },
  { code: 'br', label: 'Brasil',             flag: '🇧🇷' },
  { code: 'cl', label: 'Chile',              flag: '🇨🇱' },
  { code: 'pe', label: 'Perú',              flag: '🇵🇪' },
  { code: 'ec', label: 'Ecuador',            flag: '🇪🇨' },
  { code: 've', label: 'Venezuela',          flag: '🇻🇪' },
  { code: 'cr', label: 'Costa Rica',         flag: '🇨🇷' },
  { code: 'pa', label: 'Panamá',            flag: '🇵🇦' },
  { code: 'do', label: 'Rep. Dominicana',    flag: '🇩🇴' },
  { code: 'es', label: 'España',            flag: '🇪🇸' },
];

const CATEGORIES = [
  {
    label: 'Social Listening',
    color: '#3b82f6',
    modules: [
      { id: 'social_news',    label: 'Google News',       icon: '🌍' },
      { id: 'social_reddit',  label: 'Reddit Feed',       icon: '💬' },
      { id: 'social_youtube', label: 'YouTube Intel',     icon: '🎥' },
    ],
  },
  {
    label: 'Trends Engine',
    color: '#10b981',
    modules: [
      { id: 'trends',      label: 'Google Trends', icon: '📈' },
      { id: 'hacker_news', label: 'Hacker News',   icon: '🔥' },
    ],
  },
  {
    label: 'Competitive Intelligence',
    color: '#f59e0b',
    modules: [
      { id: 'competitive', label: 'Competitor Monitor', icon: '🕵️' },
    ],
  },
  {
    label: 'SEO / AEO',
    color: '#8b5cf6',
    modules: [
      { id: 'seo', label: 'SERP Rankings', icon: '🔍' },
    ],
  },
  {
    label: 'Paid Signals',
    color: '#ef4444',
    modules: [
      { id: 'google_ads', label: 'Google Ads', icon: '💰' },
      { id: 'meta_ads',   label: 'Meta Ads',   icon: '📣' },
    ],
  },
];

export default function Generator() {
  const [query, setQuery] = useState('');
  const [selectedCountries, setSelectedCountries] = useState(['us', 'mx', 'co']);
  const [selectedMods, setSelectedMods] = useState(['social_news']);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const logEndRef = useRef(null);

  // Fetch credential status from backend
  const { data: credStatus } = useSWR(`${API}/api/runner/credentials`, fetcher, {
    refreshInterval: 30000,
  });

  const isAvailable = (moduleId) => {
    if (!credStatus) return true; // optimistic while loading
    return credStatus[moduleId]?.available !== false;
  };

  const getMissingVars = (moduleId) => {
    if (!credStatus) return [];
    return credStatus[moduleId]?.missing || [];
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const toggleMod = (id) => {
    if (!isAvailable(id)) return; // locked modules can't be selected
    setSelectedMods(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleRun = async () => {
    if (!query) return alert('Por favor ingresa un término de búsqueda');
    if (selectedMods.length === 0) return alert('Selecciona al menos un módulo');

    setRunning(true);
    setLogs([]);
    setProgress(0);

    let completed = 0;
    const total = selectedMods.length;

    for (const modId of selectedMods) {
      setLogs(prev => [...prev, `\n> Iniciando búsqueda en ${modId.toUpperCase()}...`]);
      try {
        await new Promise((resolve, reject) => {
          fetch(`${API}/api/runner/run/${modId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: query, countries: selectedCountries.join(',') }),
          }).then(async (res) => {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ')) {
                  setLogs(prev => [...prev, line.replace('data: ', '')]);
                }
              }
            }
            completed++;
            setProgress(Math.round((completed / total) * 100));
            resolve();
          }).catch(reject);
        });
      } catch (e) {
        setLogs(prev => [...prev, `❌ Error en ${modId}: ${e.message}`]);
      }
    }

    setLogs(prev => [...prev, '\n✅ Inteligencia generada con éxito.']);
    setRunning(false);
  };

  return (
    <div className="surface card fade-up" style={{ background: 'var(--bg-0)', color: '#fff', border: 'none', overflow: 'hidden' }}>
      <div className="card-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="syne" style={{ fontSize: 22, color: 'var(--brand)' }}>Generador de Inteligencia</h2>
          <p style={{ fontSize: 13, opacity: 0.6 }}>Ingresa un tema para activar los motores de búsqueda.</p>
        </div>
        {running && <div className="dot-live"></div>}
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Left: config */}
        <div>
          <div className="form-group">
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.5)' }}>¿Qué quieres investigar?</label>
            <input
              className="form-input"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', height: 50, fontSize: 16 }}
              placeholder="Ej: Tendencias IA, Mercado Real Estate México..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={running}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Países Target</label>
            <CountryPicker
              selected={selectedCountries}
              onChange={setSelectedCountries}
              disabled={running}
            />
          </div>

          <div className="form-label" style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Motores de Búsqueda</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.label}>
                {/* Category label */}
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: cat.color, marginBottom: 6, letterSpacing: '0.08em' }}>
                  {cat.label}
                </div>

                {/* Module buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {cat.modules.map(m => {
                    const available  = isAvailable(m.id);
                    const selected   = selectedMods.includes(m.id);
                    const missing    = getMissingVars(m.id);

                    return (
                      <div key={m.id} style={{ position: 'relative' }}>
                        <button
                          onClick={() => toggleMod(m.id)}
                          disabled={running || !available}
                          title={!available ? `Requiere: ${missing.join(', ')}` : ''}
                          style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                            borderRadius: 10, border: '1px solid',
                            borderColor: !available
                              ? 'rgba(255,255,255,0.06)'
                              : selected ? cat.color : 'rgba(255,255,255,0.1)',
                            background: !available
                              ? 'rgba(255,255,255,0.03)'
                              : selected ? `${cat.color}18` : 'transparent',
                            color: !available
                              ? 'rgba(255,255,255,0.2)'
                              : selected ? '#fff' : 'rgba(255,255,255,0.4)',
                            fontSize: 11, fontWeight: 600,
                            transition: 'all 0.2s',
                            cursor: (!available || running) ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 14, opacity: available ? 1 : 0.3 }}>{m.icon}</span>
                          <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
                          {!available && <LockIcon />}
                        </button>

                        {/* Tooltip on hover showing which env var is missing */}
                        {!available && (
                          <div style={{
                            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#f87171',
                            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
                            opacity: 0, transition: 'opacity 0.15s',
                          }} className="mod-tooltip">
                            🔑 Falta: <strong>{missing.join(', ')}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleRun}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 24, height: 50, fontSize: 15 }}
            disabled={running}
          >
            {running ? 'Generando Inteligencia...' : '🚀 Lanzar Motores'}
          </button>
        </div>

        {/* Right: progress + log */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="form-label" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
            Progreso <span>{progress}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 12 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--brand)', borderRadius: 'inherit', transition: 'width 0.4s' }} />
          </div>

          <div style={{
            flex: 1, background: '#000', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: 16, fontFamily: 'monospace', fontSize: 11, color: '#67d391',
            overflowY: 'auto', maxHeight: 300,
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{log}</div>
            ))}
            <div ref={logEndRef} />
            {logs.length === 0 && <span style={{ opacity: 0.3 }}>Esperando ejecución...</span>}
          </div>
        </div>
      </div>

      <style>{`
        div:hover > .mod-tooltip { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

function CountryPicker({ selected, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = ALL_COUNTRIES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (code) => {
    onChange(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const getCountry = (code) => ALL_COUNTRIES.find(c => c.code === code);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Selected chips + search input */}
      <div
        onClick={() => { if (!disabled) setOpen(true); }}
        style={{
          minHeight: 42,
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'var(--brand)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          padding: '6px 10px',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'text',
          transition: 'border-color 0.2s',
        }}
      >
        {selected.map(code => {
          const c = getCountry(code);
          if (!c) return null;
          return (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,90,31,0.18)', border: '1px solid rgba(255,90,31,0.4)',
              borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#fff',
            }}>
              {c.flag} {c.code.toUpperCase()}
              {!disabled && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(code); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13 }}
                >×</button>
              )}
            </span>
          );
        })}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder={selected.length === 0 ? 'Escribe para buscar...' : ''}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 12, flex: 1, minWidth: 80,
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
          background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Sin resultados</div>
          )}
          {filtered.map(c => {
            const isSelected = selected.includes(c.code);
            return (
              <div
                key={c.code}
                onClick={() => { toggle(c.code); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer', fontSize: 12,
                  background: isSelected ? 'rgba(255,90,31,0.12)' : 'transparent',
                  color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isSelected ? 'rgba(255,90,31,0.2)' : 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'rgba(255,90,31,0.12)' : 'transparent'}
              >
                <span style={{ fontSize: 16 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ opacity: 0.4, fontFamily: 'monospace', fontSize: 10 }}>{c.code.toUpperCase()}</span>
                {isSelected && <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
