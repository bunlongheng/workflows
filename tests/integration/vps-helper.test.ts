import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vpsGet is a small wrapper around fetch that inlines vpsAuthHeaders() and
// throws VpsError on non-OK responses. Env is read at module load, so we
// resetModules per test and re-import after stubbing.

describe('vpsGet', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VPS_URL', 'http://example.test:3009');

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends Authorization: Bearer <token> when VPS_AUTH_TOKEN is set', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', 'my-token');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { vpsGet } = await import('../../lib/vps');
    const out = await vpsGet<{ ok: boolean }>('/api/automations/list');

    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://example.test:3009/api/automations/list');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer my-token' });
  });

  it('omits Authorization header when VPS_AUTH_TOKEN is empty', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', '');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { vpsGet } = await import('../../lib/vps');
    await vpsGet('/api/automations/list');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('throws VpsError with status when response is non-OK', async () => {
    vi.stubEnv('VPS_AUTH_TOKEN', '');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { vpsGet, VpsError } = await import('../../lib/vps');

    const err = (await vpsGet('/api/anything').catch((e) => e)) as InstanceType<typeof VpsError>;
    expect(err).toBeInstanceOf(VpsError);
    expect(err.status).toBe(500);
    expect(err.name).toBe('VpsError');
  });
});
