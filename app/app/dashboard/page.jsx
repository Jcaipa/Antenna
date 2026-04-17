'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Sidebar from '../../components/Sidebar';
import NewsTable from '../../components/NewsTable';
import { SentimentDonut, KeywordBar } from '../../components/ReportCharts';
import ExportBtn from '../../components/ExportBtn';
import { fetcher } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'social';
  const runId = searchParams.get('run_id');
  
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('');

  const queryParams = new URLSearchParams();
  if (runId) queryParams.set('run_id', runId);
  if (keyword) queryParams.set('keyword', keyword);
  if (country) queryParams.set('country', country);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const { data: social, error: socialErr } = useSWR(`/api/data/social${query}`, fetcher);
  const { data: seo,    error: seoErr }    = useSWR(`/api/data/seo${query}`, fetcher);
  const { data: trends, error: trendsErr } = useSWR(`/api/data/trends${query}`, fetcher);
  const { data: comp,   error: compErr }   = useSWR(`/api/data/competitive${query}`, fetcher);
  const { data: paid }   = useSWR(`/api/data/paid${query}`, fetcher);

  useEffect(() => {
    if (!isLoggedIn()) router.push('/login');
  }, [router]);

  const setTab = (t) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', t);
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>Dashboard Inteligente</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Señales de mercado agregadas</p>
              {runId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--brand)', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                  <span>VISTA HISTÓRICA #{runId}</span>
                  <button 
                    onClick={() => router.push('/dashboard')} 
                    style={{ background: 'white', color: 'var(--brand)', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="tabs">
            <button onClick={() => setTab('social')}      className={`tab-btn ${currentTab === 'social' ? 'active' : ''}`}>Social</button>
            <button onClick={() => setTab('seo')}         className={`tab-btn ${currentTab === 'seo' ? 'active' : ''}`}>SEO</button>
            <button onClick={() => setTab('trends')}      className={`tab-btn ${currentTab === 'trends' ? 'active' : ''}`}>Trends</button>
            <button onClick={() => setTab('competitive')} className={`tab-btn ${currentTab === 'competitive' ? 'active' : ''}`}>Competencia</button>
            <button onClick={() => setTab('paid')}        className={`tab-btn ${currentTab === 'paid' ? 'active' : ''}`}>Paid</button>
          </div>
        </header>

        {/* Dynamic Filter Bar */}
        <div className="filter-bar surface" style={{ borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <SearchIcon style={{ width: 16, opacity: 0.5 }} />
            <input 
              type="text" 
              placeholder="Filtrar por keyword..." 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="clean-input"
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--line)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.5 }}>País:</span>
            <select 
              value={country} 
              onChange={(e) => setCountry(e.target.value)}
              className="clean-select"
              style={{ fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <option value="">Todos</option>
              <option value="us">US</option>
              <option value="mx">MX</option>
              <option value="co">CO</option>
              <option value="es">ES</option>
            </select>
          </div>
          { (keyword || country) && (
            <button onClick={() => { setKeyword(''); setCountry(''); }} className="btn-link" style={{ fontSize: 11, color: 'var(--brand)' }}>Limpiar Filtros</button>
          )}
        </div>

        <section className="content">
          {currentTab === 'social' && (
            <div className="fade-up">
              <div className="section-head mb">
                <div>
                  <h2 className="syne">Social Listening</h2>
                  <p>Monitoreo de News, Reddit y YouTube.</p>
                </div>
                <ExportBtn data={social?.items} filename="social-listening" />
              </div>
              
              <div className="grid-3 mb">
                <div className="surface card">
                  <h3 className="card-title">Sentimiento</h3>
                  <SentimentDonut data={social?.sentiment_counts} />
                </div>
                <div className="surface card" style={{ gridColumn: 'span 2' }}>
                  <h3 className="card-title">Top Keywords</h3>
                  <KeywordBar data={social?.top_keywords || []} />
                </div>
              </div>

              <div className="surface card">
                <h3 className="card-title">Feed de Noticias</h3>
                <NewsTable items={social?.items} loading={!social} />
              </div>
            </div>
          )}

          {currentTab === 'seo' && (
            <div className="fade-up">
              <div className="section-head mb">
                <h2 className="syne">SEO & Search Visibility</h2>
                <ExportBtn data={seo?.items} filename="seo-rankings" />
              </div>
              <div className="surface card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Keyword</th>
                        <th>País</th>
                        <th>Posición</th>
                        <th>Título</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seo?.items?.map((item, i) => (
                        <tr key={i}>
                          <td><strong>{item.keyword || item.keyword_busqueda}</strong></td>
                          <td><span className="badge b-gray">{item.country || item.pais_busqueda}</span></td>
                          <td><span className={`badge ${parseInt(item.position) <= 3 ? 'b-green' : 'b-amber'}`}>{item.position}</span></td>
                          <td>{item.title}</td>
                          <td><a href={item.link} target="_blank" className="btn btn-outline btn-sm">Ver SERP</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'trends' && (
            <div className="fade-up">
              <div className="section-head mb">
                <h2 className="syne">Trends Engine</h2>
              </div>
              <div className="grid-2 mb">
                <div className="surface card">
                  <h3 className="card-title">Google Trends Interés</h3>
                  <KeywordBar data={trends?.kw_interest || []} />
                </div>
                <div className="surface card">
                  <h3 className="card-title">Hacker News Tech Signals</h3>
                  <div className="news-feed">
                    {trends?.hacker_news?.map((h, i) => (
                      <div key={i} className="news-item">
                        <div className="news-content">
                          <h4 className="news-title"><a href={h.url} target="_blank">{h.titulo || h.title}</a></h4>
                          <div className="news-meta">
                            <span className="badge b-plum">{h.points || h.puntos} puntos</span>
                            <span>{h.comments} comentarios</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* YouTube Signals */}
              {trends?.youtube?.length > 0 && (
                <div className="surface card">
                  <h3 className="card-title" style={{ marginBottom: 16 }}>
                    YouTube Video Signals
                    <span className="badge b-gray" style={{ marginLeft: 8 }}>{trends.youtube.length} videos</span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {trends.youtube.map((v, i) => (
                      <a key={i} href={v.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <div style={{
                          padding: '12px 14px', borderRadius: 12,
                          border: '1.5px solid var(--line)',
                          background: 'var(--paper)',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          cursor: 'pointer',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(255,90,31,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>▶️</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>YouTube</span>
                            <span className={`badge ${v.sentiment === 'positivo' ? 'b-green' : v.sentiment === 'negativo' ? 'b-red' : 'b-gray'}`} style={{ marginLeft: 'auto', fontSize: 9 }}>
                              {v.sentiment || 'neutral'}
                            </span>
                          </div>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6 }}>
                            {v.title || v.titulo}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v.channel || v.canal}</p>
                          {v.keyword && (
                            <span className="badge b-amber" style={{ fontSize: 9, marginTop: 6 }}>{v.keyword}</span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentTab === 'competitive' && (
            <div className="fade-up">
              <div className="section-head mb">
                <h2 className="syne">Competencia</h2>
              </div>
              <div className="grid-2">
                <div className="surface card">
                  <h3 className="card-title">Autoridad de Dominio (DA)</h3>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Dominio</th><th>DA</th><th>Rango</th></tr></thead>
                      <tbody>
                        {comp?.authority?.map((a, i) => (
                          <tr key={i}>
                            <td>{a.domain}</td>
                            <td><strong>{a.da}</strong></td>
                            <td><div style={{height: 6, background: 'var(--line)', borderRadius: 3, flex: 1}}><div style={{width: `${a.da}%`, height: '100%', background: 'var(--brand)', borderRadius: 'inherit'}}></div></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="surface card">
                  <h3 className="card-title">Tech Prototyping</h3>
                  <p className="card-note mb">Tecnologías detectadas en sitios competidores.</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Empresa</th><th>Tech</th></tr></thead>
                      <tbody>
                        {comp?.tech_stack?.map((t, i) => (
                          <tr key={i}>
                            <td>{t.company}</td>
                            <td><div style={{display:'flex', gap:4, flexWrap:'wrap'}}>{t.tech?.split(',').map(s => <span key={s} className="badge b-gray">{s}</span>)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'paid' && (
            <div className="fade-up">
              <div className="section-head mb">
                <h2 className="syne">Paid Signals</h2>
                <ExportBtn data={[...(paid?.google_ads || []), ...(paid?.meta_ads || [])]} filename="paid-signals" />
              </div>

              {/* Google Ads */}
              <div className="surface card mb">
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 className="card-title">Google Ads</h3>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Anuncios pagados en Google Search vía SerpAPI</p>
                  </div>
                  <span className="badge b-gray">{paid?.total_google || 0} anuncios</span>
                </div>
                {paid?.google_ads?.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Keyword</th><th>País</th><th>Anunciante</th><th>Copy</th><th>URL</th></tr></thead>
                      <tbody>
                        {paid.google_ads.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.keyword}</strong></td>
                            <td><span className="badge b-gray">{(a.country || '').toUpperCase()}</span></td>
                            <td>{a.page_name || '-'}</td>
                            <td style={{ fontSize: 11, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.copy || '-'}</td>
                            <td><a href={a.ad_url} target="_blank" className="btn btn-outline btn-sm">Ver</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                    <p style={{ fontWeight: 600, marginBottom: 6 }}>Sin anuncios detectados</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 400, margin: '0 auto' }}>
                      Google no muestra ads de pago para keywords informacionales (noticias, política).
                      Usa keywords comerciales como <em>"vuelos baratos"</em>, <em>"seguro de viaje"</em> o <em>"hotel miami"</em> para ver anuncios.
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Ads */}
              <div className="surface card">
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 className="card-title">Meta Ad Library</h3>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Anuncios activos en Facebook e Instagram</p>
                  </div>
                  <span className="badge b-gray">{paid?.total_meta || 0} anuncios</span>
                </div>
                {paid?.meta_ads?.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Keyword</th><th>País</th><th>Página</th><th>Copy</th></tr></thead>
                      <tbody>
                        {paid.meta_ads.map((a, i) => (
                          <tr key={i}>
                            <td><strong>{a.keyword}</strong></td>
                            <td><span className="badge b-gray">{(a.country || '').toUpperCase()}</span></td>
                            <td>{a.page_name || '-'}</td>
                            <td style={{ fontSize: 11, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.copy || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <p style={{ fontWeight: 600, marginBottom: 6 }}>Meta Access Token requerido</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 400, margin: '0 auto' }}>
                      Agrega <code style={{ background: 'var(--paper-2)', padding: '1px 5px', borderRadius: 4 }}>META_ACCESS_TOKEN</code> en el archivo <code style={{ background: 'var(--paper-2)', padding: '1px 5px', borderRadius: 4 }}>.env</code> para acceder a la Meta Ad Library.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SearchIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
