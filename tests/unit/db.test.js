import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// server/db.js does `import pg from 'pg'` then `new pg.Pool(...)`. The real `pg`
// package is only installed on the VPS (it lives in server/package.json, not the
// root deps used by vitest), and we never want a live Postgres connection in a
// unit test. So we mock `pg` with a Pool stub that records its constructor args
// and exposes the same query/connect/end surface real code relies on.

const poolInstances = [];

class FakePool {
  constructor(config) {
    this.options = config;
    this.totalCount = 0;
    poolInstances.push(this);
  }
  query() {
    return Promise.resolve({ rows: [] });
  }
  connect() {
    return Promise.resolve({ release() {} });
  }
  end() {
    return Promise.resolve();
  }
}

vi.mock('pg', () => ({
  default: { Pool: FakePool },
}));

describe('server/db pool', () => {
  beforeEach(() => {
    vi.resetModules();
    poolInstances.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports the same pool as both named and default export', async () => {
    const mod = await import('../../server/db.js');
    expect(mod.pool).toBeDefined();
    expect(mod.default).toBe(mod.pool);
  });

  it('looks like a pg Pool (exposes query / connect / end functions)', async () => {
    const { pool } = await import('../../server/db.js');
    expect(typeof pool.query).toBe('function');
    expect(typeof pool.connect).toBe('function');
    expect(typeof pool.end).toBe('function');
  });

  it('constructs exactly one Pool on import', async () => {
    await import('../../server/db.js');
    expect(poolInstances).toHaveLength(1);
  });

  it('is configured for the local socket + "2026" database as postgres', async () => {
    const { pool } = await import('../../server/db.js');
    expect(pool.options).toEqual({
      host: '/var/run/postgresql',
      database: '2026',
      user: 'postgres',
    });
  });

  it('has not opened any connections on import (lazy pool)', async () => {
    const { pool } = await import('../../server/db.js');
    expect(pool.totalCount).toBe(0);
  });
});
