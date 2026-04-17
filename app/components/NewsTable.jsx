'use client';

export default function NewsTable({ items, loading }) {
  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner"></div>
        <span>Cargando feed de noticias...</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="loading-center">
        <span>No hay noticias disponibles para los filtros seleccionados.</span>
      </div>
    );
  }

  return (
    <div className="news-feed">
      {items.map((item, idx) => {
        const sentiment = (item.sentiment || 'neutral').toLowerCase();
        const sentimentBadge = sentiment.includes('pos') ? 'b-green' : (sentiment.includes('neg') ? 'b-red' : 'b-gray');
        
        return (
          <div key={idx} className="news-item fade-up" style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className={`news-source-badge ${getSourceClass(item.fuente)}`}>
              {getSourceIcon(item.fuente)}{item.fuente || 'News'}
            </div>
            <div className="news-content">
              <h4 className="news-title">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || item.titulo || 'Sin título'}</a>
                ) : (
                  item.title || item.titulo || 'Sin título'
                )}
              </h4>
              <div className="news-meta">
                <span>{item.date || item.fecha || 'Fecha desconocida'}</span>
                {item.country && <span className="badge b-gray" style={{height: 18, fontSize: 9}}>{item.country}</span>}
                <span className={`badge ${sentimentBadge}`} style={{height: 18, fontSize: 9}}>{sentiment}</span>
                {item.pilar && <span className="badge b-plum" style={{height: 18, fontSize: 9}}>{item.pilar}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getSourceClass(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('reddit'))  return 'b-red';
  if (s.includes('youtube')) return 'b-plum';
  if (s.includes('news') || s.includes('newsapi') || s.includes('google news')) return 'b-blue';
  return 'b-gray';
}

function getSourceIcon(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('reddit'))  return '🔴 ';
  if (s.includes('youtube')) return '▶️ ';
  if (s.includes('news'))    return '📰 ';
  return '';
}
