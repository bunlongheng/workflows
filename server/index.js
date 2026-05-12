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
import pg from 'pg';
const pool = new pg.Pool({
  host: '/var/run/postgresql',
  database: '2026',
  user: 'postgres',
});

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

// List all automations with their integrations and recent logs
app.get('/api/automations/list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id, a.name, a.trigger_type, a.action_type, a.active, a.action_config,
        a.created_at, a.updated_at,
        COALESCE(ti.name, a.trigger_integration_type) as trigger_integration_name,
        COALESCE(ti.type, a.trigger_integration_type) as trigger_integration_type,
        COALESCE(ai.name, a.action_integration_type) as action_integration_name,
        COALESCE(ai.type, a.action_integration_type) as action_integration_type,
        (SELECT count(*) FROM automation_logs WHERE automation_id = a.id) as total_runs,
        (SELECT count(*) FROM automation_logs WHERE automation_id = a.id AND result IN ('success', 'ok')) as success_runs,
        (SELECT triggered_at FROM automation_logs WHERE automation_id = a.id ORDER BY triggered_at DESC LIMIT 1) as last_run
      FROM automations a
      LEFT JOIN integrations ti ON a.trigger_integration_id = ti.id
      LEFT JOIN integrations ai ON a.action_integration_id = ai.id
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

// Toggle automation active/inactive
app.patch('/api/automations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await pool.query('UPDATE automations SET active = $1, updated_at = now() WHERE id = $2', [active, id]);
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
    'Access-Control-Allow-Origin': '*',
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

  async function runCheck() {
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
    }
  }

  setInterval(runCheck, CHECK_INTERVAL);
  runCheck(); // Run immediately on start
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
  startWatcher();
});
