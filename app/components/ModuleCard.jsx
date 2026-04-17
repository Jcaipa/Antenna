'use client';

export default function ModuleCard({ id, label, status, meta, icon, onClick }) {
  const Icon = icon;
  return (
    <div className="module-card fade-up" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="module-card-top">
        <div className={`module-icon ${status ? 'b-green' : 'b-gray'}`}>
          {Icon ? <Icon /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          )}
        </div>
        <div className={`badge ${status ? 'b-green' : 'b-gray'}`}>
          {status ? 'Activo' : 'Sin datos'}
        </div>
      </div>
      <div>
        <h3 className="module-name">{label}</h3>
        <p className="module-meta">{meta || 'Última actualización: Hoy'}</p>
      </div>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
          <div className="dot-live"></div>
          Datos disponibles
        </div>
      )}
    </div>
  );
}
