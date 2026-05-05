'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const SENT_EMOJIS = { positivo: '🟢', negativo: '🔴', neutro: '⚪', neutral: '⚪' };

function formatNum(n) {
  if (!n) return '0';
  if (typeof n === 'string') return n;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function XProfileCard({ profile, tweets }) {
  const [expandedBio, setExpandedBio] = useState(false);
  const [expandedTweet, setExpandedTweet] = useState(null);
  const [commentsCache, setCommentsCache] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const p = profile;
  if (!p) return null;

  const bio = p.bio || '';
  const webData = p.website_data_json ? (() => { try { return JSON.parse(p.website_data_json); } catch { return null; } })() : null;
  const tweetList = tweets || [];

  const loadComments = async (tweetId) => {
    if (commentsCache[tweetId]) return;
    setLoadingComments(prev => ({ ...prev, [tweetId]: true }));
    try {
      const res = await fetch(`${API}/api/data/x/comments?tweet_id=${tweetId}`);
      const data = await res.json();
      setCommentsCache(prev => ({ ...prev, [tweetId]: data.items || [] }));
    } catch (e) {
      console.error('Error loading comments:', e);
    }
    setLoadingComments(prev => ({ ...prev, [tweetId]: false }));
  };

  const toggleTweet = async (i, tweetId) => {
    if (expandedTweet === i) {
      setExpandedTweet(null);
    } else {
      setExpandedTweet(i);
      if (tweetId) await loadComments(tweetId);
    }
  };

  return (
    <div className="surface card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start',
        background: 'linear-gradient(135deg, rgba(29,19,15,0.03), rgba(255,90,31,0.04))',
        borderBottom: '1px solid var(--line)',
      }}>
        <img
          src={p.avatar_url || ''}
          alt={p.name}
          style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0, border: '2px solid var(--line)' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 17, fontFamily: "'Syne', sans-serif" }}>{p.name || p.handle}</strong>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>@{p.handle}</span>
            {p.verified && <span style={{ fontSize: 13, color: 'var(--brand)' }}>✓</span>}
            <span className={`badge ${p.category === 'empresa' ? 'b-plum' : p.category === 'persona' ? 'b-green' : 'b-gray'}`} style={{ fontSize: 9 }}>
              {p.category || 'Sin categoría'}
            </span>
            {p.sector && <span className="badge b-blue" style={{ fontSize: 9 }}>{p.sector}</span>}
            {p.sector_confidence && <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>{(p.sector_confidence * 100).toFixed(0)}%</span>}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: 'var(--ink-3)' }}>
            <span><strong style={{ color: 'var(--ink)' }}>{formatNum(p.followers)}</strong> seguidores</span>
            {p.location && <span>{p.location}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <a href={p.profile_url} target="_blank" className="btn btn-outline btn-sm" style={{ fontSize: 10 }}>X</a>
          {p.website_url && <a href={p.website_url} target="_blank" className="btn btn-outline btn-sm" style={{ fontSize: 10 }}>Web</a>}
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bio && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4, letterSpacing: '0.06em' }}>Bio</div>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                {expandedBio || bio.length < 120 ? bio : `${bio.slice(0, 120)}...`}
                {bio.length > 120 && (
                  <button onClick={() => setExpandedBio(!expandedBio)} style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
                    {expandedBio ? 'menos' : 'más'}
                  </button>
                )}
              </p>
            </div>
          )}
          {webData && (
            <div style={{ background: 'var(--paper)', borderRadius: 10, padding: 12, border: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span>🌐</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>Sitio Web</span>
                <a href={p.website_url} target="_blank" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--brand)' }}>visitar</a>
              </div>
              {webData.title && <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{webData.title}</p>}
              {webData.text_length > 0 && <p style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>{webData.text_length.toLocaleString()} caracteres</p>}
            </div>
          )}
          {p.sector_suggestion && (
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.4, background: 'var(--plum-soft)', borderRadius: 8, padding: 10 }}>
              🤖 {p.sector_suggestion.slice(0, 150)}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 8 }}>
            Tweets <span style={{ color: 'var(--ink-2)' }}>({tweetList.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {tweetList.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
                No hay tweets disponibles
              </div>
            ) : (
              tweetList.map((t, i) => (
                <div key={i}>
                  <div
                    onClick={() => toggleTweet(i, t.tweet_id)}
                    style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: i % 2 === 0 ? 'var(--paper)' : 'transparent',
                      fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink)',
                      borderBottom: '1px solid var(--line-2)',
                      cursor: t.replies > 0 ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                        {SENT_EMOJIS[t.sentiment] || '⚪'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span>{t.text?.length > 180 ? t.text.slice(0, 180) + '...' : t.text}</span>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: 'var(--ink-3)' }}>
                          {t.likes > 0 && <span>❤️ {formatNum(t.likes)}</span>}
                          {t.retweets > 0 && <span>🔁 {formatNum(t.retweets)}</span>}
                          {t.replies > 0 && <span>💬 {formatNum(t.replies)}</span>}
                          {t.tweet_url && (
                            <a href={t.tweet_url} target="_blank" style={{ color: 'var(--brand)', marginLeft: 'auto' }}
                              onClick={e => e.stopPropagation()}>
                              abrir
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comments section */}
                  {expandedTweet === i && (
                    <div style={{ padding: '8px 10px 8px 24px', background: '#f8f6f4', borderRadius: 8, marginTop: 2, marginBottom: 4 }}>
                      {loadingComments[t.tweet_id] ? (
                        <div style={{ fontSize: 11, color: '#888', padding: 8 }}>Cargando comentarios...</div>
                      ) : commentsCache[t.tweet_id] && commentsCache[t.tweet_id].length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4 }}>
                            💬 {commentsCache[t.tweet_id].length} respuestas
                          </div>
                          {commentsCache[t.tweet_id].slice(0, 15).map((c, ci) => (
                            <div key={ci} style={{
                              padding: '6px 8px', borderRadius: 6, background: '#fff',
                              border: '1px solid #eee', fontSize: 11, lineHeight: 1.4,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <strong style={{ fontSize: 10, color: '#555' }}>{c.author || 'Anónimo'}</strong>
                                {c.likes > 0 && <span style={{ fontSize: 9, color: '#888' }}>❤️ {formatNum(c.likes)}</span>}
                              </div>
                              <span style={{ color: '#333' }}>{c.text?.length > 280 ? c.text.slice(0, 280) + '...' : c.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#999', padding: 8 }}>
                          Sin comentarios — configura X_AUTH_TOKEN en .env para ver respuestas
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
