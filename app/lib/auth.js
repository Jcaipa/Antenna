'use client';

export function getUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('antenna_user') || 'null'); }
  catch { return null; }
}

export function setUser(user) {
  localStorage.setItem('antenna_user', JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem('antenna_user');
}

export function isLoggedIn() {
  return !!getUser();
}
