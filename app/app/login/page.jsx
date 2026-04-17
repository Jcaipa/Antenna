'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setUser, isLoggedIn } from '../../lib/auth';
import { API } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoggedIn()) {
      router.push('/');
    }
  }, [router]);

  // Mock login for demonstration until real Google OAuth is configured in GCP console
  const handleMockLogin = async () => {
    setLoading(true);
    setError('');
    
    // Simulate API call to backend auth endpoint
    // In real life, this would be the credential from Google One Tap
    const mockCredential = {
      email: 'admin@antpack.co',
      name: 'Admin Antpack',
      picture: 'https://ui-avatars.com/api/?name=Admin+Antpack&background=ff5a1f&color=fff',
      is_admin: true
    };

    try {
      // Simulate backend validation delay
      await new Promise(r => setTimeout(r, 1200));
      
      setUser(mockCredential);
      router.push('/');
    } catch (e) {
      setError('Acceso denegado. Solo cuentas @antpack.co autorizadas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-card fade-up">
        <div className="auth-logo">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <h1 className="auth-title">Antenna</h1>
        <p className="auth-sub">
          Plataforma de Inteligencia de Mercado.<br/>
          Inicia sesión para acceder al dashboard.
        </p>

        {error && <div className="badge b-red mb" style={{ width: '100%', padding: '10px' }}>{error}</div>}

        <button 
          onClick={handleMockLogin} 
          className="google-btn"
          disabled={loading}
        >
          {loading ? (
            <div className="spinner" style={{ width: 18, height: 18, margin: 0 }}></div>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.85 2.2c1.67-1.55 2.63-3.83 2.63-6.53z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.85-2.2c-.79.53-1.8.85-3.11.85-2.39 0-4.41-1.61-5.14-3.77H1L1 13.5C2.48 16.44 5.5 18 9 18z" fill="#34A853"/>
                <path d="M3.86 10.74c-.19-.57-.3-1.17-.3-1.74s.11-1.17.3-1.74V4.5H1A8.98 8.98 0 0 0 1 13.5l2.86-2.76z" fill="#FBBC05"/>
                <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.02 2.3C13.46.86 11.43 0 9 0 5.5 0 2.48 1.56 1 4.5l2.86 2.26C4.59 5.19 6.61 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continuar con Antpack Mail
            </>
          )}
        </button>

        <p className="auth-note">
          Acceso exclusivo para colaboradores de Antpack.<br/>
          Usa tu correo institucional @antpack.co
        </p>
      </div>
    </div>
  );
}
