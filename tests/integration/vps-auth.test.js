import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

// Replica of the bearer-auth middleware in server/index.js. We intentionally
// don't import server/index.js because it boots Express, dotenv, the watcher,
// and a pg.Pool on import. The behavior under test is the auth middleware
// itself, so a faithful replica is the right unit of test.
function buildApp(VPS_AUTH_TOKEN) {
  const app = express();

  app.use((req, res, next) => {
    if (!VPS_AUTH_TOKEN) return next();
    if (req.path === '/health') return next();
    if (req.path === '/api/events' && req.query.token === VPS_AUTH_TOKEN) return next();

    const header = req.headers.authorization || '';
    const expected = `Bearer ${VPS_AUTH_TOKEN}`;
    if (header !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/foo', (req, res) => res.json({ ok: true }));
  app.get('/api/events', (req, res) => res.json({ stream: true }));

  return app;
}

describe('VPS bearer-auth middleware (replica)', () => {
  const TOKEN = 'super-secret-vps-token';

  it('GET /health returns 200 with no header', async () => {
    const app = buildApp(TOKEN);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/foo returns 401 with no header', async () => {
    const app = buildApp(TOKEN);
    const res = await request(app).get('/api/foo');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('GET /api/foo returns 401 with the wrong bearer token', async () => {
    const app = buildApp(TOKEN);
    const res = await request(app)
      .get('/api/foo')
      .set('Authorization', 'Bearer not-the-right-token');
    expect(res.status).toBe(401);
  });

  it('GET /api/foo returns 200 with the correct bearer token', async () => {
    const app = buildApp(TOKEN);
    const res = await request(app)
      .get('/api/foo')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /api/events allows ?token= query fallback (SSE)', async () => {
    const app = buildApp(TOKEN);
    const res = await request(app).get(`/api/events?token=${encodeURIComponent(TOKEN)}`);
    expect(res.status).toBe(200);
  });

  it('passes everything through when VPS_AUTH_TOKEN is empty (dev mode)', async () => {
    const app = buildApp('');
    const res = await request(app).get('/api/foo');
    expect(res.status).toBe(200);
  });
});
