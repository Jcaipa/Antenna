'use client';
import { useState } from 'react';

export default function ExportBtn({ data, filename = 'reporte-antenna' }) {
  const [loading, setLoading] = useState(false);

  const exportCSV = () => {
    setLoading(true);
    try {
      if (!data || data.length === 0) return;
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export error', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={exportCSV} className="btn btn-outline btn-sm" disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 14, height: 14}}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="12" x2="12" y2="3"/>
      </svg>
      {loading ? 'Exportando...' : 'Exportar CSV'}
    </button>
  );
}
