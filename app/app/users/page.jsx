'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Sidebar from '../../components/Sidebar';
import { fetcher, apiFetch } from '../../lib/api';
import { isLoggedIn, getUser } from '../../lib/auth';

export default function UsersPage() {
  const router = useRouter();
  const { data: users, error } = useSWR('/api/users/', fetcher);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!isLoggedIn() || !u?.is_admin) router.push('/');
  }, [router]);

  const toggleAdmin = async (email, current) => {
    try {
      await apiFetch(`/api/users/${email}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_admin: !current })
      });
      mutate('/api/users/');
    } catch (e) {
      alert('Error actualizando permiso');
    }
  };

  const inviteUser = async (e) => {
    e.preventDefault();
    if (!inviteEmail.includes('@antpack.co')) return alert('Solo emails @antpack.co');
    setLoading(true);
    try {
      await apiFetch(`/api/users/invite?email=${inviteEmail}`, { method: 'POST' });
      setInviteEmail('');
      mutate('/api/users/');
    } catch (e) {
      alert('Error invitando usuario');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (email) => {
    if (!confirm(`¿Eliminar a ${email}?`)) return;
    try {
      await apiFetch(`/api/users/${email}`, { method: 'DELETE' });
      mutate('/api/users/');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 className="syne" style={{ fontSize: 24 }}>Gestión de Usuarios</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Whitelist de acceso institucional @antpack.co</p>
          </div>
        </header>

        <section className="content">
          <div className="surface card mb">
            <h3 className="card-title">Invitar Colaborador</h3>
            <form onSubmit={inviteUser} style={{ display: 'flex', gap: 10 }}>
              <input 
                className="form-input" 
                placeholder="email@antpack.co" 
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? '...' : 'Invitar'}
              </button>
            </form>
          </div>

          <div className="surface card">
            <h3 className="card-title">Lista de Acceso</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Permisos</th>
                    <th>Último Login</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map(u => (
                    <tr key={u.email}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar">
                            {u.picture ? <img src={u.picture} alt="" /> : u.email[0].toUpperCase()}
                          </div>
                          <div>
                            <strong>{u.name || 'Invitado'}</strong>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'b-green' : 'b-gray'}`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => toggleAdmin(u.email, u.is_admin)} className={`badge ${u.is_admin ? 'b-plum' : 'b-gray'}`} style={{ cursor: 'pointer' }}>
                          {u.is_admin ? 'Admin' : 'Viewer'}
                        </button>
                      </td>
                      <td style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Nunca'}
                      </td>
                      <td>
                        <button onClick={() => deleteUser(u.email)} style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
