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
});
