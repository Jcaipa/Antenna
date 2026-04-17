'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { API } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

const MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Mejor calidad' },
  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  note: 'Más rápido' },
  { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',    note: 'Google' },
];

const QUICK_PROMPTS = [
  { icon: '🧠', text: 'Analiza las narrativas emergentes en los datos actuales' },
  { icon: '📊', text: '¿Cuál es el sentimiento predominante y por qué?' },
  { icon: '🔍', text: '¿Qué keywords tienen mayor potencial estratégico?' },
  { icon: '⚠️',  text: '¿Qué riesgos detectas en la conversación online?' },
  { icon: '🚀', text: '¿Cuáles son las 3 acciones que recomendarías esta semana?' },
  { icon: '🎯', text: 'Compara el posicionamiento SEO vs la conversación en redes' },
];

export default function AIPage() {
  const router = useRouter();
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [model, setModel]             = useState('llama-3.3-70b-versatile');
  const [useContext, setUseContext]    = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading]     = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const bottomRef    = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) router.push('/login');
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const uploadFile = async (file) => {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/api/ai/upload`, { method: 'POST', body: form });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Error al subir'); }
      const data = await res.json();
      setAttachments(prev => [...prev, data]);
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFilePick = (e) => {
    Array.from(e.target.files || []).forEach(uploadFile);
    e.target.value = '';
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files || []).forEach(uploadFile);
  }, []);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { role: 'user', text: q, attachments: [...attachments] };
    setMessages(prev => [...prev, userMsg]);
    setAttachments([]);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'model', text: '', thinking: '', showThinking: false }]);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const body = {
        message: q, history, use_context: useContext, model,
        file_uri:  attachments[0]?.file_uri  || null,
        mime_type: attachments[0]?.mime_type || null,
      };

      const res     = await fetch(`${API}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '', fullThinking = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.error) { fullText += `\n⚠️ ${json.error}`; break; }
            if (json.thinking) { fullThinking += json.thinking; }
            else if (json.text) { fullText += json.text; }
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'model', text: fullText, thinking: fullThinking,
                showThinking: updated[updated.length - 1]?.showThinking || false,
              };
              return updated;
            });
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'model', text: `❌ Error: ${e.message}`, thinking: '' };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleThinking = (idx) => {
    setMessages(prev => prev.map((m, i) =>
      i === idx ? { ...m, showThinking: !m.showThinking } : m
    ));
  };

  const hasInput = input.trim() || attachments.length > 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Topbar */}
        <header className="topbar" style={{ flexShrink: 0 }}>
          <div>
            <h1 className="syne" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>Antenna AI</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Analista de inteligencia grounded en tus datos</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {MODELS.map(m => (
              <button key={m.id} onClick={() => setModel(m.id)} style={{
                padding: '6px 13px', borderRadius: 8, border: '1.5px solid',
                borderColor: model === m.id ? 'var(--brand)' : 'rgba(32,24,19,0.14)',
                background: model === m.id ? 'rgba(255,90,31,0.08)' : '#fff',
                color: model === m.id ? 'var(--brand)' : 'var(--ink-3)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                boxShadow: model === m.id ? '0 0 0 3px rgba(255,90,31,0.1)' : 'none',
                transition: 'all 0.15s',
              }}>
                {m.label}
                <span style={{ fontSize: 9, opacity: 0.55, marginLeft: 5 }}>{m.note}</span>
              </button>
            ))}
            <button onClick={() => setUseContext(v => !v)} style={{
              padding: '6px 13px', borderRadius: 8, border: '1.5px solid',
              borderColor: useContext ? '#16a34a' : 'rgba(32,24,19,0.14)',
              background: useContext ? 'rgba(22,163,74,0.08)' : '#fff',
              color: useContext ? '#16a34a' : 'var(--ink-3)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {useContext ? '✓ Con datos' : '○ Sin datos'}
            </button>
          </div>
        </header>

        {/* Messages area */}
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '28px 40px',
            display: 'flex', flexDirection: 'column', gap: 22,
            background: '#faf8f6',
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {dragOver && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(255,90,31,0.08)',
              border: '3px dashed var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', borderRadius: 16,
            }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>Suelta el archivo aquí</p>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: 660, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 22,
                  background: 'rgba(255,90,31,0.10)',
                  border: '1.5px solid rgba(255,90,31,0.18)',
                  margin: '0 auto 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 30,
                }}>✦</div>
                <h2 className="syne" style={{ fontSize: 22, marginBottom: 10, color: '#201813' }}>¿Qué quieres analizar?</h2>
                <p style={{ fontSize: 13.5, color: '#988d84', lineHeight: 1.6 }}>
                  Tengo acceso a todos tus datos de inteligencia: noticias, redes, trends, SEO y competidores.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => sendMessage(p.text)} style={{
                    textAlign: 'left', padding: '14px 16px',
                    borderRadius: 14, border: '1.5px solid rgba(32,24,19,0.10)',
                    background: '#fff', cursor: 'pointer',
                    fontSize: 12.5, color: '#5f564f', lineHeight: 1.5,
                    boxShadow: '0 1px 4px rgba(32,24,19,0.06)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,90,31,0.4)'; e.currentTarget.style.background = 'rgba(255,90,31,0.04)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(255,90,31,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(32,24,19,0.10)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(32,24,19,0.06)'; }}
                  >
                    <span style={{ marginRight: 8, fontSize: 15 }}>{p.icon}</span>{p.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '100%',
            }}>
              {/* Attachment chips (user) */}
              {m.attachments?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {m.attachments.map((a, j) => (
                    <span key={j} style={{
                      fontSize: 10.5, padding: '3px 10px', borderRadius: 6,
                      background: 'rgba(255,90,31,0.10)', color: 'var(--brand)',
                      border: '1px solid rgba(255,90,31,0.25)',
                    }}>
                      📎 {a.name} ({a.size_kb}KB)
                    </span>
                  ))}
                </div>
              )}

              {/* Thinking block */}
              {m.role === 'model' && m.thinking && (
                <div style={{ maxWidth: '82%', marginBottom: 6 }}>
                  <button onClick={() => toggleThinking(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11.5, color: '#8b5cf6',
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 0',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      transform: m.showThinking ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                      fontSize: 9,
                    }}>▶</span>
                    Razonamiento ({m.thinking.length} chars)
                  </button>
                  {m.showThinking && (
                    <div style={{
                      marginTop: 6, padding: '12px 16px',
                      borderRadius: 12,
                      background: 'rgba(139,92,246,0.06)',
                      border: '1.5px solid rgba(139,92,246,0.18)',
                      fontSize: 11.5, color: '#7c3aed',
                      whiteSpace: 'pre-wrap', lineHeight: 1.65,
                      fontFamily: 'monospace',
                    }}>
                      {m.thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Bubble */}
              <div style={{
                maxWidth: '82%',
                padding: '13px 18px',
                borderRadius: m.role === 'user' ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
                background: m.role === 'user' ? 'var(--brand)' : '#fff',
                border: m.role === 'model' ? '1.5px solid rgba(32,24,19,0.10)' : 'none',
                boxShadow: m.role === 'user'
                  ? '0 3px 12px rgba(255,90,31,0.28)'
                  : '0 1px 6px rgba(32,24,19,0.07)',
                fontSize: 13.5, lineHeight: 1.7,
                color: m.role === 'user' ? '#fff' : '#201813',
                whiteSpace: 'pre-wrap',
              }}>
                {m.text || (loading && i === messages.length - 1
                  ? <span style={{ color: '#c9bfb8', fontSize: 12 }}>Pensando...</span>
                  : null
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          flexShrink: 0, padding: '14px 40px 22px',
          borderTop: '1px solid rgba(32,24,19,0.08)',
          background: '#fff',
        }}>
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {attachments.map((a, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 8, fontSize: 11.5,
                  background: 'rgba(255,90,31,0.08)', border: '1px solid rgba(255,90,31,0.25)',
                  color: 'var(--brand)',
                }}>
                  <FileIcon mime={a.mime_type} />
                  {a.name} <span style={{ opacity: 0.55 }}>({a.size_kb}KB)</span>
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.65, padding: 0, fontSize: 15, color: 'inherit', lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: '#f5f0ec',
            border: '1.5px solid rgba(32,24,19,0.12)',
            borderRadius: 16, padding: '10px 14px',
            boxShadow: '0 1px 4px rgba(32,24,19,0.05)',
          }}>
            {/* Attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Adjuntar imagen, PDF o audio"
              style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: '#fff', border: '1.5px solid rgba(32,24,19,0.12)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#988d84', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(32,24,19,0.12)'; e.currentTarget.style.color = '#988d84'; }}
            >
              {uploading ? '⏳' : <AttachIcon />}
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,audio/*"
              style={{ display: 'none' }} onChange={handleFilePick} />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', fontSize: 13.5, color: '#201813',
                lineHeight: 1.55, fontFamily: 'inherit', minHeight: 26,
              }}
            />

            {/* Send */}
            <button
              onClick={() => sendMessage()}
              disabled={loading || !hasInput}
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: hasInput ? 'var(--brand)' : 'rgba(32,24,19,0.10)',
                border: 'none', cursor: hasInput ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: hasInput ? '0 3px 10px rgba(255,90,31,0.3)' : 'none',
              }}
            >
              <SendIcon active={hasInput} />
            </button>
          </div>
          <p style={{ fontSize: 10.5, color: '#c9bfb8', marginTop: 8, textAlign: 'center' }}>
            Soporta imágenes, PDFs y audio · Arrastra archivos al chat · Shift+Enter para nueva línea
          </p>
        </div>
      </main>
    </div>
  );
}

function FileIcon({ mime = '' }) {
  if (mime.startsWith('image'))  return <span>🖼️</span>;
  if (mime.includes('pdf'))      return <span>📄</span>;
  if (mime.startsWith('audio'))  return <span>🎵</span>;
  return <span>📎</span>;
}

function AttachIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

function SendIcon({ active }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#fff' : '#988d84'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
