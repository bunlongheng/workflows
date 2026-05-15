// Helper for talking to the VPS automations service.
// Centralizes the base URL + JSON fetch boilerplate used by Next.js route handlers.

export const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

export class VpsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'VpsError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${VPS_URL}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new VpsError(`VPS: ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

export function vpsGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function vpsPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function vpsPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function vpsDelete<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
