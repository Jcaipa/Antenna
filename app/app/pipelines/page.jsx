'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Sidebar from '../../components/Sidebar';
import { fetcher } from '../../lib/api';
import { isLoggedIn } from '../../lib/auth';

export default function PipelinesPage() {
  const router = useRouter();
  const { data: logs, error, mutate } = useSWR('/api/runner/logs', fetcher, {
    refreshInterval: 5000 // Refresh every 5s to see log status updates
  });

  useEffect(() => {
    if (!isLoggedIn()) router.push('/login');
  }, [router]);

  const loadRun = (id) => {
    router.push(`/dashboard?run_id=${id}`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>Historial de Pipelines</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Trazabilidad e inteligencia histórica.</p>
          </div>
        </header>

        <section className="content fade-up">
          <div className="surface card">
            <div className="section-head mb">
              <h3 className="card-title">Ejecuciones Recientes</h3>
              <button 
                onClick={() => mutate()} 
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11 }}
              >
                Actualizar Lista
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Módulo / Script</th>
                    <th>Iniciado</th>
                    <th>Keywords</th>
                    <th>Estado</th>
                    <th>Snapshot</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.map((log) => (
                    <tr key={log.id}>
                      <td style={{ opacity: 0.5 }}>#{log.id}</td>
                      <td>
                        <strong>{log.module_id}</strong>
                      </td>
                      <td>{formatDate(log.started_at)}</td>
                      <td>
                        <span style={{ fontSize: 12, display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.keywords || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          log.status === 'done' ? 'b-green' : 
                          log.status === 'running' ? 'b-brand' : 
                          log.status === 'error' ? 'b-danger' : 'b-gray'
                        }`}>
                          {log.status === 'done' ? 'Completado' : 
                           log.status === 'running' ? 'En proceso...' : 
                           log.status === 'error' ? 'Fallido' : log.status}
                        </span>
                      </td>
                      <td>
                        {log.snapshot_path ? (
                          <span className="badge b-plum" style={{ fontSize: 10 }}>Snapshot OK</span>
                        ) : (
                          <span style={{ opacity: 0.3 }}>-</span>
                        )}
                      </td>
                      <td>
                        {log.snapshot_path && (
                          <button 
                            onClick={() => loadRun(log.id)}
                            className="btn btn-brand btn-sm"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                          >
                            Cargar en Dashboard
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs?.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                        No hay ejecuciones registradas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt" style={{ padding: '12px', borderRadius: 12, background: 'rgba(255, 90, 31, 0.05)', border: '1px dashed var(--brand)' }}>
            <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              <strong>Nota:</strong> Los snapshots son copias persistentes de los datos en el momento de la ejecución. 
              Al cargar un snapshot, el Dashboard mostrará exactamente lo que se encontró en esa fecha y para esas keywords.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
