'use client';
import { useState, useRef, useEffect } from 'react';
import { API } from '../lib/api';

const QUICK_PROMPTS = [
  '¿Cuáles son las narrativas emergentes esta semana?',
  '¿Cuál es el sentimiento general en redes?',
  '¿Qué keywords están en tendencia?',
  '¿Qué oportunidades de posicionamiento ves?',
];

export default function ChatBubble() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const bottomRef = useRef(null);

  // Check if Gemini is available
  useEffect(() => {
    fetch(`${API}/api/ai/status`)
      .then(r => r.json())
      .then(d => setAvailable(d.gemini_available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'model', text: '' }]);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, use_context: true, model: 'llama-3.3-70b-versatile' }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.error) { full += `\n⚠️ ${json.error}`; break; }
            if (json.text) {
              full += json.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'model', text: full };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'model', text: `❌ Error: ${e.message}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        title={available ? 'Antenna AI' : 'Gemini no configurado'}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: available ? 'var(--brand)' : '#444',
          border: 'none', cursor: available ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(255,90,31,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
        {loading && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            width: 12, height: 12, borderRadius: '50%',
            background: '#22c55e', border: '2px solid var(--bg-0)',
            animation: 'pulse 1.2s infinite',
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 28, zIndex: 999,
          width: 370, height: 540,
          background: '#fff',
          border: '1px solid rgba(32,24,19,0.12)',
          borderRadius: 20, display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(31,17,8,0.18)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(32,24,19,0.08)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, rgba(255,90,31,0.08), rgba(241,198,79,0.06))',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(255,90,31,0.35)',
            }}>
              <SparkleIcon size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#201813' }}>Antenna AI</div>
              <div style={{ fontSize: 10, color: '#988d84' }}>Grounded en tu inteligencia actual</div>
            </div>
            <button
              onClick={() => setMessages([])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#988d84', padding: '4px 8px', borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(32,24,19,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >Limpiar</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#faf8f6' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <p style={{ fontSize: 11.5, color: '#988d84', textAlign: 'center', marginBottom: 4 }}>Pregúntame sobre tus datos de inteligencia</p>
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => sendMessage(p)} style={{
                    textAlign: 'left', padding: '9px 13px',
                    borderRadius: 10, border: '1px solid rgba(32,24,19,0.12)',
                    background: '#fff', cursor: 'pointer',
                    fontSize: 11.5, color: '#5f564f',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 3px rgba(32,24,19,0.06)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,90,31,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,90,31,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'rgba(32,24,19,0.12)'; }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
              }}>
                <div style={{
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user'
                    ? 'var(--brand)'
                    : '#fff',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(32,24,19,0.10)',
                  boxShadow: m.role === 'user'
                    ? '0 2px 8px rgba(255,90,31,0.25)'
                    : '0 1px 4px rgba(32,24,19,0.06)',
                  fontSize: 12.5, lineHeight: 1.55,
                  color: m.role === 'user' ? '#fff' : '#201813',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text || (loading && i === messages.length - 1 ? <ThinkingDots /> : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(32,24,19,0.08)', display: 'flex', gap: 8, background: '#fff' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Pregunta sobre tus datos..."
              disabled={loading || !available}
              style={{
                flex: 1,
                background: '#f5f0ec',
                border: '1px solid rgba(32,24,19,0.12)',
                borderRadius: 10,
                padding: '9px 13px', fontSize: 12.5, color: '#201813',
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || !available}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: input.trim() ? 'var(--brand)' : 'rgba(32,24,19,0.08)',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                boxShadow: input.trim() ? '0 2px 8px rgba(255,90,31,0.3)' : 'none',
              }}
            >
              <SendIcon color={input.trim() ? '#fff' : '#988d84'} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#c9bfb8',
          animation: `pulse 1.2s ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </span>
  );
}

function SparkleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function SendIcon({ color = 'currentColor' }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
