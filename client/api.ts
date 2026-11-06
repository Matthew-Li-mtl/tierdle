// All communication with the server goes through this file.
import type { Session, SessionUser } from '../shared/types.js';

// Kept only in memory, so it is gone on reload and page scripts cannot find it in storage.
let accessToken: string | null = null;
let refreshing: Promise<SessionUser | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function requestRefresh(): Promise<SessionUser | null> {
  const response = await fetch('/api/auth/refresh', { method: 'POST' });
  const session: Session | null = response.ok ? await response.json() : null;
  accessToken = session?.accessToken ?? null;
  return session?.user ?? null;
}

async function refreshWithLock(): Promise<SessionUser | null> {
  try {
    return await navigator.locks.request('tierdle-refresh', requestRefresh);
  } finally {
    refreshing = null;
  }
}

// Each refresh token works only once, so two refreshes must never run at the same time.
// `refreshing` covers this tab, and the browser's lock covers other open tabs.
export function refreshSession(): Promise<SessionUser | null> {
  refreshing ??= refreshWithLock();
  return refreshing;
}

function send(path: string, method: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const hadToken = accessToken !== null;
  let response = await send(path, method, body);

  // Access tokens last 15 minutes. When one expires, get a new one and try once more.
  if (response.status === 401 && hadToken) {
    await refreshSession();
    if (accessToken) {
      response = await send(path, method, body);
    } else {
      window.location.reload(); // the session is over, so start again as a guest
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data;
}
