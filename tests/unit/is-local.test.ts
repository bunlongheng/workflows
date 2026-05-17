import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// isLocal reads NODE_ENV via process.env at call time, but we resetModules
// per test for consistency with the other env-driven module tests.

describe('isLocal', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { isLocal } = await import('../../lib/is-local');
    expect(isLocal()).toBe(false);
  });

  it('returns true when NODE_ENV is development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { isLocal } = await import('../../lib/is-local');
    expect(isLocal()).toBe(true);
  });

  it('returns true for test / non-production envs as well', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { isLocal } = await import('../../lib/is-local');
    expect(isLocal()).toBe(true);
  });
});
