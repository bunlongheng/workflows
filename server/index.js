import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
import fs from 'fs';
import express from 'express';
import { checkForNewLikes, setOAuthToken } from './watcher.js';
import { processVideo } from './pipeline.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;

// --- Bearer-token auth ---
// All routes require `Authorization: Bearer ${VPS_AUTH_TOKEN}`.
// If VPS_AUTH_TOKEN is unset/empty, auth is bypassed (with a startup warn) so
// local-dev runs keep working without setup.
//
// TODO (Next.js side, not owned by this agent): when VPS_AUTH_TOKEN is set,
// the proxy/server routes that call this VPS need to forward the header.
// Files to update:
//   - app/api/automations/route.ts
//   - app/api/automations/[id]/route.ts
//   - app/api/automations/log/route.ts
//   - app/api/connections/route.ts
//   - app/api/connections/[integrationId]/route.ts
//   - app/api/youtube/* (connect, disconnect, processed, status, process, token)
//   - app/api/gmail/* (connect, disconnect, search)
//   - any client SSE wiring that hits /api/events
const VPS_AUTH_TOKEN = process.env.VPS_AUTH_TOKEN || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

if (!VPS_AUTH_TOKEN) {
  console.warn('[auth] VPS_AUTH_TOKEN is empty - bearer auth is DISABLED (dev mode)');
}
if (!ALLOWED_ORIGIN) {
  console.warn('[cors] ALLOWED_ORIGIN is empty - SSE will fall back to "*"');
}

app.use((req, res, next) => {
  // No auth configured - allow everything (dev)
  if (!VPS_AUTH_TOKEN) return next();

  // /health stays open for uptime checks
  if (req.path === '/health') return next();

  // SSE EventSource cannot send custom headers; allow token via query param fallback.
  if (req.path === '/api/events' && req.query.token === VPS_AUTH_TOKEN) return next();

  const header = req.headers.authorization || '';
  const expected = `Bearer ${VPS_AUTH_TOKEN}`;
  if (header !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});
const CHECK_INTERVAL = process.env.CHECK_INTERVAL_SEC
  ? parseInt(process.env.CHECK_INTERVAL_SEC) * 1000
  : (parseInt(process.env.CHECK_INTERVAL_MIN) || 5) * 60 * 1000;
const TOKEN_FILE = './data/youtube-token.json';

// Load saved token on startup
try {
  const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  if (saved.access_token) {
    setOAuthToken(saved);
    console.log(`[startup] Loaded YouTube token for ${saved.accountName || 'unknown'}`);
  }
} catch {
  console.log('[startup] No saved YouTube token - waiting for connection');
}

// Health check
app.get('/health', (req, res) => {
  let hasToken = false;
  try {
    hasToken = fs.existsSync(TOKEN_FILE);
  } catch {}

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    service: 'automations-server',
    youtube_connected: hasToken,
  });
});

// Receive OAuth token from Automations app after user connects YouTube
app.post('/api/youtube/connect', (req, res) => {
  const { access_token, refresh_token, expires_in, accountName, accountEmail } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'access_token required' });
  }

  const tokenData = {
    access_token,
    refresh_token,
    expires_in,
    accountName,
    accountEmail,
    saved_at: new Date().toISOString(),
  };

  // Save token to disk
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));

  // Set token in watcher
  setOAuthToken(tokenData);

  console.log(`[connect] YouTube connected: ${accountName} (${accountEmail})`);
  res.json({ success: true, message: `Connected as ${accountName}` });
});

// --- Gmail ---
const GMAIL_TOKEN_FILE = './data/gmail-token.json';

app.post('/api/gmail/connect', (req, res) => {
  const { access_token, refresh_token, expires_in, accountEmail } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token required' });

  const tokenData = { access_token, refresh_token, expires_in, accountEmail, saved_at: new Date().toISOString() };
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(tokenData, null, 2));
  console.log(`[gmail] Connected: ${accountEmail}`);
  res.json({ success: true });
});

app.post('/api/gmail/disconnect', (req, res) => {
  try { fs.unlinkSync(GMAIL_TOKEN_FILE); } catch {}
  console.log('[gmail] Disconnected');
  res.json({ success: true });
});

// Gmail search - check for new emails matching a query
app.get('/api/gmail/search', async (req, res) => {
  const query = req.query.q || '';
  try {
    const token = JSON.parse(fs.readFileSync(GMAIL_TOKEN_FILE, 'utf-8'));
    if (!token.access_token) return res.status(401).json({ error: 'No Gmail token' });

    // Refresh if needed
    let accessToken = token.access_token;
    const savedAt = new Date(token.saved_at).getTime();
    const expiresIn = (token.expires_in || 3600) * 1000;
    if (Date.now() - savedAt > expiresIn - 60000) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        token.access_token = accessToken;
        token.saved_at = new Date().toISOString();
        fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(token, null, 2));
      }
    }

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!gmailRes.ok) return res.status(gmailRes.status).json({ error: 'Gmail API error' });

    const data = await gmailRes.json();
    const messages = [];

    for (const msg of (data.messages || []).slice(0, 5)) {
      const detail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (detail.ok) {
        const d = await detail.json();
        const headers = d.payload?.headers || [];
        messages.push({
          id: msg.id,
          threadId: msg.threadId,
          subject: headers.find(h => h.name === 'Subject')?.value || '',
          from: headers.find(h => h.name === 'From')?.value || '',
          date: headers.find(h => h.name === 'Date')?.value || '',
          snippet: d.snippet || '',
        });
      }
    }

    res.json({ messages, total: data.resultSizeEstimate || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect YouTube
app.post('/api/youtube/disconnect', (req, res) => {
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {}
  setOAuthToken(null);
  console.log('[connect] YouTube disconnected');
  res.json({ success: true });
});

// Log automation execution to DB
import { pool } from './db.js';

app.post('/api/automations/log', async (req, res) => {
  const { videoId, title, summary, result: resultStr, automationId } = req.body;

  // Find matching automation by trigger type, or use provided ID
  let autoId = automationId;
  let autoName = '';
  if (!autoId) {
    try {
      const match = await pool.query(
        `SELECT id, name FROM automations WHERE trigger_type = 'video_liked' AND active = true ORDER BY created_at ASC`
      );
      if (match.rows.length > 0) {
        // Log to all active YouTube automations
        for (const row of match.rows) {
          await pool.query(
            `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [row.id, row.name, JSON.stringify({ videoId, title }), resultStr || 'success', (summary || '').slice(0, 500), 'automations-api']
          );
        }
        res.json({ success: true, logged: match.rows.length });
        return;
      }
    } catch {}
  }

  try {
    if (!autoId) {
      res.json({ success: false, error: 'No matching automation found' });
      return;
    }
    await pool.query(
      `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [autoId, autoName, JSON.stringify({ videoId, title }), resultStr || 'success', (summary || '').slice(0, 500), 'automations-api']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[log] DB error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// List all automations with their integrations and recent logs.
// Uses a single LEFT JOIN against an aggregate of automation_logs to avoid
// the previous 3-correlated-subquery N+1 pattern.
app.get('/api/automations/list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id, a.name, a.trigger_type, a.action_type, a.active, a.action_config, a.condition,
        a.created_at, a.updated_at,
        COALESCE(ti.name, a.trigger_integration_type) as trigger_integration_name,
        COALESCE(ti.type, a.trigger_integration_type) as trigger_integration_type,
        COALESCE(ai.name, a.action_integration_type) as action_integration_name,
        COALESCE(ai.type, a.action_integration_type) as action_integration_type,
        COALESCE(l.total_runs, 0) as total_runs,
        COALESCE(l.success_runs, 0) as success_runs,
        l.last_run as last_run
      FROM automations a
      LEFT JOIN integrations ti ON a.trigger_integration_id = ti.id
      LEFT JOIN integrations ai ON a.action_integration_id = ai.id
      LEFT JOIN (
        SELECT
          automation_id,
          count(*) as total_runs,
          count(*) FILTER (WHERE result IN ('success', 'ok')) as success_runs,
          max(triggered_at) as last_run
        FROM automation_logs
        GROUP BY automation_id
      ) l ON l.automation_id = a.id
      ORDER BY a.created_at DESC
    `);
    res.json({ automations: result.rows });
  } catch (err) {
    console.error('[automations] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get single automation with logs
app.get('/api/automations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const autoResult = await pool.query(`
      SELECT a.*,
        COALESCE(ti.name, a.trigger_integration_type) as trigger_integration_name,
        COALESCE(ti.type, a.trigger_integration_type) as trigger_integration_type,
        COALESCE(ai.name, a.action_integration_type) as action_integration_name,
        COALESCE(ai.type, a.action_integration_type) as action_integration_type
      FROM automations a
      LEFT JOIN integrations ti ON a.trigger_integration_id = ti.id
      LEFT JOIN integrations ai ON a.action_integration_id = ai.id
      WHERE a.id = $1
    `, [id]);

    if (autoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const logsResult = await pool.query(
      `SELECT * FROM automation_logs WHERE automation_id = $1 ORDER BY triggered_at DESC LIMIT 50`,
      [id]
    );

    res.json({ automation: autoResult.rows[0], logs: logsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete automation
app.delete('/api/automations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM automation_logs WHERE automation_id = $1', [id]);
    await pool.query('DELETE FROM automations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update automation (toggle active, edit name/condition/action_config)
app.patch('/api/automations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active, name, condition, action_config } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;
    if (active !== undefined) { sets.push(`active = $${idx++}`); vals.push(active); }
    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (condition !== undefined) { sets.push(`condition = $${idx++}`); vals.push(JSON.stringify(condition)); }
    if (action_config !== undefined) { sets.push(`action_config = $${idx++}`); vals.push(JSON.stringify(action_config)); }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    sets.push(`updated_at = now()`);
    vals.push(id);
    await pool.query(`UPDATE automations SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Create automation
app.post('/api/automations', async (req, res) => {
  try {
    const { name, trigger_type, trigger_integration_type, action_type, action_integration_type, action_config, condition } = req.body;
    if (!name || !trigger_type || !action_type) {
      return res.status(400).json({ error: 'name, trigger_type, action_type required' });
    }

    // Prevent duplicates: same trigger+action integration+type combo
    if (trigger_integration_type && action_integration_type) {
      const dupe = await pool.query(
        `SELECT id, name FROM automations WHERE trigger_integration_type = $1 AND action_integration_type = $2 AND trigger_type = $3 AND action_type = $4 LIMIT 1`,
        [trigger_integration_type, action_integration_type, trigger_type, action_type]
      );
      if (dupe.rows.length > 0) {
        return res.status(409).json({ error: `Duplicate: "${dupe.rows[0].name}" already exists with the same trigger and action` });
      }
    }

    // Look up integration UUIDs by type (best effort)
    const triggerInteg = trigger_integration_type
      ? await pool.query('SELECT id FROM integrations WHERE type = $1 LIMIT 1', [trigger_integration_type]).catch(() => ({ rows: [] }))
      : { rows: [] };
    const actionInteg = action_integration_type
      ? await pool.query('SELECT id FROM integrations WHERE type = $1 LIMIT 1', [action_integration_type]).catch(() => ({ rows: [] }))
      : { rows: [] };

    const result = await pool.query(
      `INSERT INTO automations (name, trigger_type, trigger_integration_id, trigger_integration_type, action_type, action_integration_id, action_integration_type, action_config, condition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        name,
        trigger_type,
        triggerInteg.rows[0]?.id || null,
        trigger_integration_type || null,
        action_type,
        actionInteg.rows[0]?.id || null,
        action_integration_type || null,
        action_config || {},
        condition || {},
      ]
    );
    res.json({ automation: result.rows[0] });
  } catch (err) {
    console.error('[automations] Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get OAuth token (for API routes that need it)
app.get('/api/youtube/token', (req, res) => {
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    if (!token.access_token) {
      return res.status(401).json({ error: 'No token' });
    }
    res.json({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
    });
  } catch {
    res.status(401).json({ error: 'No token' });
  }
});

// Manual trigger - POST a video URL/ID directly
app.post('/api/youtube/process', async (req, res) => {
  const { videoId, videoUrl } = req.body;
  const id = videoId || extractVideoId(videoUrl);

  if (!id) {
    return res.status(400).json({ error: 'videoId or videoUrl required' });
  }

  try {
    const result = await processVideo(id);
    res.json({ success: true, result });
  } catch (err) {
    console.error('[process] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Processed video IDs
app.get('/api/youtube/processed', (req, res) => {
  const history = getHistory();
  const ids = history.map(h => h.videoId);
  res.json({ ids });
});

// Status endpoint
app.get('/api/youtube/status', (req, res) => {
  const history = getHistory();
  let connected = false;
  let account = null;
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    connected = true;
    account = { name: token.accountName, email: token.accountEmail };
  } catch {}

  res.json({
    connected,
    account,
    processed: history.length,
    recent: history.slice(-10),
  });
});

// Auto-migrate: ensure connections table exists
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS connections (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      integration_id TEXT NOT NULL UNIQUE,
      account_name TEXT,
      account_email TEXT,
      connected_at TIMESTAMPTZ DEFAULT now(),
      scopes TEXT[]
    )
  `);
  console.log('[migrate] connections table ready');

  // Add integration type columns to automations
  await pool.query(`ALTER TABLE automations ADD COLUMN IF NOT EXISTS trigger_integration_type TEXT`);
  await pool.query(`ALTER TABLE automations ADD COLUMN IF NOT EXISTS action_integration_type TEXT`);

  // Backfill from integrations join
  await pool.query(`
    UPDATE automations a SET
      trigger_integration_type = COALESCE(a.trigger_integration_type, ti.type),
      action_integration_type = COALESCE(a.action_integration_type, ai.type)
    FROM automations a2
    LEFT JOIN integrations ti ON a2.trigger_integration_id = ti.id
    LEFT JOIN integrations ai ON a2.action_integration_id = ai.id
    WHERE a.id = a2.id AND (a.trigger_integration_type IS NULL OR a.action_integration_type IS NULL)
  `);
  console.log('[migrate] automation integration types ready');

  // Apply SQL files under server/migrations. Each statement runs separately so
  // CREATE INDEX CONCURRENTLY is permitted (cannot run inside a transaction).
  try {
    const migrationsDir = join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = fs.readFileSync(join(migrationsDir, file), 'utf-8');
        const statements = sql
          .split(/;\s*(?:\r?\n|$)/)
          .map((s) => s.replace(/--.*$/gm, '').trim())
          .filter(Boolean);
        for (const stmt of statements) {
          try {
            await pool.query(stmt);
          } catch (err) {
            // IF NOT EXISTS should make this idempotent; log and continue.
            console.error(`[migrate] ${file} stmt failed: ${err.message}`);
          }
        }
        console.log(`[migrate] applied ${file} (${statements.length} stmts)`);
      }
    }
  } catch (err) {
    console.error('[migrate] index migrations error:', err.message);
  }
}

// GET /api/connections - list all
app.get('/api/connections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connections ORDER BY connected_at DESC');
    res.json({ connections: result.rows });
  } catch (err) {
    console.error('[connections] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connections - upsert
app.post('/api/connections', async (req, res) => {
  const { integrationId, accountName, accountEmail, scopes } = req.body;
  if (!integrationId) {
    return res.status(400).json({ error: 'integrationId required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO connections (integration_id, account_name, account_email, scopes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (integration_id) DO UPDATE SET
         account_name = EXCLUDED.account_name,
         account_email = EXCLUDED.account_email,
         scopes = EXCLUDED.scopes,
         connected_at = now()
       RETURNING *`,
      [integrationId, accountName || null, accountEmail || null, scopes || null]
    );
    res.json({ connection: result.rows[0] });
  } catch (err) {
    console.error('[connections] Upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/connections/:integrationId
app.delete('/api/connections/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    await pool.query('DELETE FROM connections WHERE integration_id = $1', [integrationId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[connections] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// SSE - live event stream for clients
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN || '*',
  });
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(msg);
  }
}

// Watcher loop
function startWatcher() {
  console.log(`[watcher] Starting - checking every ${CHECK_INTERVAL / 1000}s`);

  // Concurrency guard: a slow tick must not stack on top of itself.
  let ytRunning = false;
  async function runCheck() {
    if (ytRunning) {
      console.log('[watcher] previous tick still running - skip');
      return;
    }
    ytRunning = true;
    try {
      const newLikes = await checkForNewLikes();
      for (const video of newLikes) {
        console.log(`[watcher] New like detected: ${video.title} (${video.videoId})`);
        broadcast('processing', { videoId: video.videoId, title: video.title, status: 'started' });
        try {
          const result = await processVideo(video.videoId);
          broadcast('processed', { videoId: video.videoId, title: video.title, status: 'done', result });

          // Log to all active video_liked automations
          try {
            const match = await pool.query(
              `SELECT id, name FROM automations WHERE trigger_type = 'video_liked' AND active = true`
            );
            for (const row of match.rows) {
              await pool.query(
                `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [row.id, row.name, JSON.stringify({ videoId: video.videoId, title: video.title, mindmapId: result._mindmapId || null, diagramId: result._diagramId || null }), 'success', (result.summary || '').slice(0, 500), 'watcher']
              );
            }
            broadcast('logged', { videoId: video.videoId, automations: match.rows.length });
          } catch (logErr) {
            console.error('[watcher] Log error:', logErr.message);
          }
        } catch (procErr) {
          broadcast('error', { videoId: video.videoId, title: video.title, error: procErr.message });
        }
      }
    } catch (err) {
      console.error('[watcher] Error:', err.message);
    } finally {
      ytRunning = false;
    }
  }

  // Guarded wrapper around the Gmail watcher tick so overlapping intervals
  // (or interval + immediate boot run) cannot pile up.
  let gmailRunning = false;
  async function runGmailGuarded() {
    if (gmailRunning) {
      console.log('[gmail-watcher] previous tick still running - skip');
      return;
    }
    gmailRunning = true;
    try {
      await runGmailCheck();
    } finally {
      gmailRunning = false;
    }
  }

  setInterval(runCheck, CHECK_INTERVAL);
  setInterval(runGmailGuarded, CHECK_INTERVAL);
  runCheck(); // Run immediately on start
  runGmailGuarded(); // Run immediately on start
}

// Gmail watcher - polls for active Gmail automations.
// `gmailSeenIds` is bounded to avoid unbounded heap growth (one entry per
// matched message). When size exceeds GMAIL_SEEN_MAX we drop the oldest
// GMAIL_SEEN_TRIM entries (Sets preserve insertion order in modern V8).
const GMAIL_SEEN_MAX = 5000;
const GMAIL_SEEN_TRIM = 1000;
const gmailSeenIds = new Set();
function rememberGmailSeen(key) {
  gmailSeenIds.add(key);
  if (gmailSeenIds.size > GMAIL_SEEN_MAX) {
    let drop = GMAIL_SEEN_TRIM;
    for (const k of gmailSeenIds) {
      if (drop-- <= 0) break;
      gmailSeenIds.delete(k);
    }
    console.log(`[gmail-watcher] Trimmed ${GMAIL_SEEN_TRIM} oldest seen IDs (now ${gmailSeenIds.size})`);
  }
}

// Seed seen IDs from existing logs to prevent re-firing on restart
async function seedGmailSeen() {
  try {
    const result = await pool.query(
      `SELECT automation_id, trigger_payload FROM automation_logs WHERE via = 'gmail-watcher' ORDER BY triggered_at DESC LIMIT 200`
    );
    for (const row of result.rows) {
      try {
        const p = typeof row.trigger_payload === 'string' ? JSON.parse(row.trigger_payload) : row.trigger_payload;
        if (p?.messageId) rememberGmailSeen(`${row.automation_id}:${p.messageId}`);
      } catch {}
    }
    console.log(`[gmail-watcher] Seeded ${gmailSeenIds.size} seen message IDs`);
  } catch (err) {
    console.error('[gmail-watcher] Seed error:', err.message);
  }
}

async function getGmailAccessToken() {
  try {
    const token = JSON.parse(fs.readFileSync(GMAIL_TOKEN_FILE, 'utf-8'));
    if (!token.access_token) return null;

    const savedAt = new Date(token.saved_at).getTime();
    const expiresIn = (token.expires_in || 3600) * 1000;
    if (Date.now() - savedAt > expiresIn - 60000 && token.refresh_token) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        token.access_token = refreshData.access_token;
        token.saved_at = new Date().toISOString();
        fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(token, null, 2));
      }
    }
    return token.access_token;
  } catch {
    return null;
  }
}

async function runGmailCheck() {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) return;

  try {
    // Find all active Gmail trigger automations
    const autos = await pool.query(
      `SELECT id, name, trigger_type, condition, action_type, action_config
       FROM automations WHERE active = true
       AND (trigger_integration_type = 'gmail' OR trigger_type IN ('search_query_match', 'subject_match', 'from_match', 'body_match', 'new_email_received'))`
    );
    if (autos.rows.length === 0) return;

    for (const auto of autos.rows) {
      try {
        const cond = auto.condition || {};
        let query = '';
        if (auto.trigger_type === 'search_query_match') {
          const raw = cond.query || '';
          // Wrap in quotes for exact phrase match if not already quoted
          query = raw.startsWith('"') ? raw : `"${raw}"`;
        }
        else if (auto.trigger_type === 'subject_match') query = `subject:"${cond.subject || ''}"`;
        else if (auto.trigger_type === 'from_match') query = `from:${cond.from || ''}`;
        else if (auto.trigger_type === 'body_match') query = `"${cond.body || ''}"`;
        else if (auto.trigger_type === 'new_email_received') query = cond.query || 'is:unread';
        if (!query) continue;

        // Only check emails from the last 2 minutes to avoid historical matches
        query += ' newer_than:2m';

        const gmailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!gmailRes.ok) continue;
        const data = await gmailRes.json();
        const messages = data.messages || [];

        for (const msg of messages) {
          const seenKey = `${auto.id}:${msg.id}`;
          if (gmailSeenIds.has(seenKey)) continue;
          rememberGmailSeen(seenKey);

          // Fetch message details
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!detailRes.ok) continue;
          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const from = headers.find(h => h.name === 'From')?.value || '';

          console.log(`[gmail-watcher] Match for "${auto.name}": ${subject} from ${from}`);
          broadcast('gmail_match', { automationId: auto.id, subject, from, messageId: msg.id });

          // Execute action
          let result = 'success';
          let detail_text = `Email: "${subject}" from ${from}`;
          try {
            await executeAction(auto.action_type, auto.action_config, { subject, from, snippet: detail.snippet, messageId: msg.id });
          } catch (actionErr) {
            result = 'error';
            detail_text = actionErr.message;
          }

          // Log execution (skip if already logged for this messageId)
          await pool.query(
            `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [auto.id, auto.name, JSON.stringify({ messageId: msg.id, subject, from }), result, detail_text.slice(0, 500), 'gmail-watcher']
          );
          broadcast('logged', { automationId: auto.id, type: 'gmail', subject });
        }
      } catch (autoErr) {
        console.error(`[gmail-watcher] Error for "${auto.name}":`, autoErr.message);
      }
    }
  } catch (err) {
    console.error('[gmail-watcher] Error:', err.message);
  }
}

async function executeAction(actionType, config, triggerData) {
  console.log(`[action] Executing ${actionType}`, config);

  if (actionType === 'set_color' || actionType === 'flash_lights' || actionType === 'toggle_lights' || actionType === 'set_scene') {
    // Hue action - call local Hue bridge if available
    const group = config.group || 'Office';
    broadcast('hue_action', { actionType, config, trigger: triggerData });
    console.log(`[hue] ${actionType} - group: ${group}, config:`, config);
    return { executed: true, actionType, group };
  }

  if (actionType === 'create_sticky') {
    const title = triggerData.subject || 'Gmail Automation';
    const body = triggerData.snippet || triggerData.subject || '';
    const folder = config.folder || 'Gmail';
    try {
      await pool.query(
        `INSERT INTO stickies (title, body, path, tags) VALUES ($1, $2, $3, $4)`,
        [title, body, `/${folder}`, ['gmail', 'automation']]
      );
      console.log(`[sticky] Created: ${title}`);
      return { executed: true, title };
    } catch (err) {
      console.error('[sticky] Error:', err.message);
      throw err;
    }
  }

  console.log(`[action] Unknown action type: ${actionType}`);
  return { executed: false, reason: 'unknown_action' };
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getHistory() {
  try {
    const data = fs.readFileSync('./data/history.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

app.listen(PORT, async () => {
  console.log(`[automations-server] Running on port ${PORT}`);
  await migrate();
  await seedGmailSeen();
  startWatcher();
});
