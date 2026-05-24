import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The env vars in lib/vps.ts are captured at module load, so we must
// resetModules + stubEnv before each import.

describe('vpsAuthHeaders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns empty headers when VPS_AUTH_TOKEN is unset', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', '');
    const { vpsAuthHeaders } = await import('../../lib/vps');
    expect(vpsAuthHeaders()).toEqual({});
  });

  it('returns Authorization Bearer header when VPS_AUTH_TOKEN is set', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'secret-token-123');
    const { vpsAuthHeaders } = await import('../../lib/vps');
    expect(vpsAuthHeaders()).toEqual({
      Authorization: 'Bearer secret-token-123',
    });
  });
});

describe('vpsSseUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VPS_URL', 'http://example.test:3009');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the URL unchanged when no token is configured', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', '');
    const { vpsSseUrl } = await import('../../lib/vps');
    expect(vpsSseUrl('/api/events')).toBe('http://example.test:3009/api/events');
  });

  it('appends ?token= when path has no query string', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'abc def');
    const { vpsSseUrl } = await import('../../lib/vps');
    expect(vpsSseUrl('/api/events')).toBe(
      'http://example.test:3009/api/events?token=abc%20def'
    );
  });

  it('appends &token= when path already has a query string', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'tok');
    const { vpsSseUrl } = await import('../../lib/vps');
    expect(vpsSseUrl('/api/events?foo=bar')).toBe(
      'http://example.test:3009/api/events?foo=bar&token=tok'
    );
  });

  it('url-encodes token special characters in the query', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'a=b&c d');
    const { vpsSseUrl } = await import('../../lib/vps');
    expect(vpsSseUrl('/api/events')).toBe(
      'http://example.test:3009/api/events?token=a%3Db%26c%20d'
    );
  });
});

describe('VPS_URL default', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults VPS_URL when env var is unset', async () => {
    vi.stubEnv('VPS_URL', '');
    const { VPS_URL } = await import('../../lib/vps');
    expect(VPS_URL).toBe('http://45.79.212.154:3009');
  });

  it('uses the configured VPS_URL when set', async () => {
    vi.stubEnv('VPS_URL', 'http://custom.host:9999');
    const { VPS_URL } = await import('../../lib/vps');
    expect(VPS_URL).toBe('http://custom.host:9999');
  });
});

describe('vps request wrappers (mocked fetch)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VPS_URL', 'http://example.test:3009');
    vi.stubEnv('VPS_AUTH_TOKEN', '');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function ok(body: unknown, status = 200) {
    return { ok: true, status, json: async () => body };
  }
  function notOk(status: number) {
    return { ok: false, status, json: async () => ({}) };
  }

  it('vpsGet uses GET, cache no-store, and no Content-Type (no body)', async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [] }));
    const { vpsGet } = await import('../../lib/vps');
    const out = await vpsGet<{ items: unknown[] }>('/api/list');
    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://example.test:3009/api/list');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('vpsPost serializes the body and sets Content-Type: application/json', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 1 }, 201));
    const { vpsPost } = await import('../../lib/vps');
    const out = await vpsPost<{ id: number }>('/api/create', { name: 'x' });
    expect(out).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://example.test:3009/api/create');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('vpsPatch sends PATCH with a JSON body', async () => {
    fetchMock.mockResolvedValueOnce(ok({ updated: true }));
    const { vpsPatch } = await import('../../lib/vps');
    const out = await vpsPatch<{ updated: boolean }>('/api/item/1', { active: false });
    expect(out).toEqual({ updated: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ active: false }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('vpsDelete sends DELETE with no body and no Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(ok({ deleted: true }));
    const { vpsDelete } = await import('../../lib/vps');
    const out = await vpsDelete<{ deleted: boolean }>('/api/item/1');
    expect(out).toEqual({ deleted: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('attaches Authorization header when a token is configured', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'tok-xyz');
    fetchMock.mockResolvedValueOnce(ok({}));
    const { vpsPost } = await import('../../lib/vps');
    await vpsPost('/api/create', { a: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok-xyz');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws VpsError on a 4xx response (GET)', async () => {
    fetchMock.mockResolvedValueOnce(notOk(404));
    const { vpsGet, VpsError } = await import('../../lib/vps');
    const err = (await vpsGet('/api/missing').catch((e) => e)) as InstanceType<
      typeof VpsError
    >;
    expect(err).toBeInstanceOf(VpsError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('VPS: 404');
  });

  it('throws VpsError on a 5xx response (POST)', async () => {
    fetchMock.mockResolvedValueOnce(notOk(503));
    const { vpsPost, VpsError } = await import('../../lib/vps');
    const err = (await vpsPost('/api/create', {}).catch((e) => e)) as InstanceType<
      typeof VpsError
    >;
    expect(err).toBeInstanceOf(VpsError);
    expect(err.status).toBe(503);
  });

  it('VpsError carries name "VpsError" and is an Error instance', async () => {
    const { VpsError } = await import('../../lib/vps');
    const e = new VpsError('boom', 418);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('VpsError');
    expect(e.status).toBe(418);
    expect(e.message).toBe('boom');
  });

  it('propagates a network error (fetch rejects) to the caller', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    const { vpsGet } = await import('../../lib/vps');
    await expect(vpsGet('/api/list')).rejects.toThrow('network down');
  });
});
