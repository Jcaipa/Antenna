const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch(path, opts = {}) {
  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('antenna_user') || 'null')
    : null;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (user?.email) headers['X-User-Email'] = user.email;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const fetcher = (url) => apiFetch(url);
export { API };
