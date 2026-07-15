import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
import fs from 'fs';
import express from 'express';
import { checkForNewLikes, setOAuthToken } from './watcher.js';
import { processVideo } from './pipeline.js';
import { extractVideoId, maskEmail } from './helpers.js';
import { extractText } from './email-text.js';

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

  // Inbound webhooks are called by external services that can't send the
  // global bearer token; they authenticate via their own per-automation secret.
  if (req.path.startsWith('/api/hooks/')) return next();

  // SSE EventSource cannot send custom headers; allow token via query param fallback.
  if (req.path === '/api/events' && req.query.token === VPS_AUTH_TOKEN) return next();

  const header = req.headers.authorization || '';
  const expected = `Bearer ${VPS_AUTH_TOKEN}`;
  if (header !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});
const TOKEN_FILE = './data/youtube-token.json';

// On-demand sync: assigned by startWatcher(), called by POST /api/sync.
// lastSyncAt throttles rapid re-opens / duplicate tabs so a burst of app loads
// cannot fan out into a burst of YouTube calls.
let runSyncNow = async () => ({ likes: 0 });
let lastSyncAt = 0;

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

  console.log(`[connect] YouTube connected: ${accountName} (${maskEmail(accountEmail)})`);
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
  console.log(`[gmail] Connected: ${maskEmail(accountEmail)}`);
  res.json({ success: true });
});

app.post('/api/gmail/disconnect', (req, res) => {
  try { fs.unlinkSync(GMAIL_TOKEN_FILE); } catch {}
  console.log('[gmail] Disconnected');
  res.json({ success: true });
});

// --- Philips Hue (local bridge over Tailscale) ---
// The Hue bridge lives on the home LAN. The always-on local machine controls
// it directly over http; the VPS reaches that machine over Tailscale and
// forwards the desired light state. No Philips cloud / OAuth.
const HUE_LOCAL_URL = process.env.HUE_LOCAL_URL || 'http://100.99.41.27:3008';

// Map a saved action type to a light mode. An explicit config.mode wins so the
// UI can pick flashing / fade / solid / colorloop independently of action type.
function hueModeFor(actionType, config) {
  if (config.mode) return String(config.mode);
  if (actionType === 'set_color') return 'solid';
  if (actionType === 'toggle_lights') return (config.on === false || config.on === 'false') ? 'off' : 'solid';
  if (actionType === 'set_scene') return 'colorloop';
  return 'flashing';
}

// Forward a Hue action to the local machine, which drives the LAN bridge.
async function runHueAction(actionType, config) {
  const body = {
    mode: hueModeFor(actionType, config),
    color: config.color || 'red',
    group: config.group_id || config.group,
    brightness: config.brightness,
    flash_count: config.flash_count || config.flashes || config.times,
    fade_seconds: config.fade_seconds,
    on: config.on,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${HUE_LOCAL_URL}/api/hue/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `local hue control failed (${r.status})`);
    return { executed: true, actionType, ...data };
  } finally {
    clearTimeout(timer);
  }
}

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
    console.error('[gmail/search] error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Build a Gmail search query string from an automation row (trigger_type + condition).
// Returns '' if the automation has no usable condition.
function buildGmailQueryForAutomation(triggerType, condition) {
  const cond = condition || {};
  if (triggerType === 'search_query_match') {
    const raw = cond.query || '';
    if (!raw) return '';
    return raw.startsWith('"') ? raw : `"${raw}"`;
  }
  if (triggerType === 'subject_match') return cond.subject ? `subject:"${cond.subject}"` : '';
  if (triggerType === 'from_match') return cond.from ? `from:${cond.from}` : '';
  if (triggerType === 'body_match') return cond.body ? `"${cond.body}"` : '';
  if (triggerType === 'new_email_received') return cond.query || 'is:unread';
  return '';
}

// Recursively pull text/plain (preferred) or text/html out of a Gmail message payload.
function extractGmailBody(payload) {
  if (!payload) return { text: '', html: '' };
  let text = '';
  let html = '';
  const visit = (part) => {
    if (!part) return;
    const mime = part.mimeType || '';
    const dataB64 = part.body?.data;
    if (dataB64) {
      try {
        const decoded = Buffer.from(dataB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        if (mime === 'text/plain' && !text) text = decoded;
        else if (mime === 'text/html' && !html) html = decoded;
      } catch {}
    }
    if (Array.isArray(part.parts)) part.parts.forEach(visit);
  };
  visit(payload);
  return { text, html };
}

// GET /api/gmail/messages?automationId=<id>
// List recent Gmail messages matching an automation's condition. Used by the
// manual-run UI to show "what would trigger this if it were auto".
app.get('/api/gmail/messages', async (req, res) => {
  const { automationId } = req.query;
  if (!automationId) return res.status(400).json({ error: 'automationId required' });

  try {
    const autoRes = await pool.query(
      `SELECT id, trigger_type, condition FROM automations WHERE id = $1`,
      [automationId]
    );
    if (autoRes.rows.length === 0) return res.status(404).json({ error: 'automation not found' });
    const auto = autoRes.rows[0];

    const query = buildGmailQueryForAutomation(auto.trigger_type, auto.condition);
    if (!query) return res.json({ messages: [] });

    const accessToken = await getGmailAccessToken();
    if (!accessToken) return res.status(401).json({ error: 'Gmail not connected' });

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!gmailRes.ok) return res.status(gmailRes.status).json({ error: 'Gmail API error' });
    const data = await gmailRes.json();

    const messages = [];
    for (const msg of (data.messages || []).slice(0, 20)) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!detailRes.ok) continue;
      const d = await detailRes.json();
      const headers = d.payload?.headers || [];
      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: headers.find((h) => h.name === 'Subject')?.value || '',
        from: headers.find((h) => h.name === 'From')?.value || '',
        date: headers.find((h) => h.name === 'Date')?.value || '',
        snippet: d.snippet || '',
      });
    }
    res.json({ messages });
  } catch (err) {
    console.error('[gmail/messages] error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/gmail/sticky-from-message
// Manual run: fetch the full message, extract clean text, save to stickies, log it.
// Body: { automationId, messageId }
app.post('/api/gmail/sticky-from-message', async (req, res) => {
  const { automationId, messageId } = req.body || {};
  if (!automationId || !messageId) {
    return res.status(400).json({ error: 'automationId and messageId required' });
  }

  let autoName = '';
  try {
    const autoRes = await pool.query(
      `SELECT id, name, action_config FROM automations WHERE id = $1`,
      [automationId]
    );
    if (autoRes.rows.length === 0) return res.status(404).json({ error: 'automation not found' });
    autoName = autoRes.rows[0].name || '';
    const actionConfig = autoRes.rows[0].action_config || {};
    const folder = actionConfig.folder || 'Gmail';

    const accessToken = await getGmailAccessToken();
    if (!accessToken) return res.status(401).json({ error: 'Gmail not connected' });

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) return res.status(msgRes.status).json({ error: 'Gmail API error' });
    const msg = await msgRes.json();

    const headers = msg.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find((h) => h.name === 'From')?.value || '';
    const { text, html } = extractGmailBody(msg.payload);
    const cleanText = extractText(text || html || msg.snippet || '', subject);

    // Same shape pipeline.js uses for stickies insert
    const STICKIES_USER_ID = '47a18fff-a0c4-4f18-b0f0-40821c18793d';
    const stickyRes = await pool.query(
      `INSERT INTO stickies (title, content, folder_name, folder_color, type, icon, user_id, created_by_key)
       VALUES ($1, $2, $3, '#3b82f6', 'markdown', '📧', $4, 'automations-gmail') RETURNING id`,
      [subject.slice(0, 200), cleanText, folder, STICKIES_USER_ID]
    );
    const stickyId = stickyRes.rows[0]?.id;
    pool.query(`UPDATE api_keys SET last_used_at = now() WHERE label = 'automations-gmail' AND revoked_at IS NULL`).catch(() => {});

    await pool.query(
      `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [automationId, autoName, JSON.stringify({ messageId, subject, from, stickyId }), 'success', `Saved "${subject}" to Stickies/${folder}`.slice(0, 500), 'manual']
    );
    broadcast('logged', { automationId, type: 'gmail', subject, manual: true });

    res.json({ ok: true, stickyId });
  } catch (err) {
    console.error('[gmail/sticky-from-message] error:', err.message);
    try {
      await pool.query(
        `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [automationId, autoName, JSON.stringify({ messageId }), 'failed', err.message.slice(0, 500), 'manual']
      );
    } catch {}
    res.status(500).json({ ok: false, error: err.message });
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
    res.status(500).json({ error: 'internal error' });
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
    res.status(500).json({ error: 'internal error' });
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
    console.error('[automations] Get error:', err.message);
    res.status(500).json({ error: 'internal error' });
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
    console.error('[automations] Delete error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Clear all execution logs for an automation (optionally only failed ones with ?result=failed)
app.delete('/api/automations/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.query.result === 'failed') {
      await pool.query(
        `DELETE FROM automation_logs WHERE automation_id = $1 AND result NOT IN ('success','ok')`,
        [id]
      );
    } else {
      await pool.query('DELETE FROM automation_logs WHERE automation_id = $1', [id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[automations] Clear logs error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Delete a single execution log (scoped to its automation for safety)
app.delete('/api/automations/:id/logs/:logId', async (req, res) => {
  try {
    const { id, logId } = req.params;
    await pool.query('DELETE FROM automation_logs WHERE id = $1 AND automation_id = $2', [logId, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[automations] Delete log error:', err.message);
    res.status(500).json({ error: 'internal error' });
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
    console.error('[automations] Patch error:', err.message);
    res.status(500).json({ error: 'internal error' });
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
    res.status(500).json({ error: 'internal error' });
  }
});

// Natural-language -> automation. Claude turns a sentence into a structured
// automation, which we validate and create (reusing the same dedup/insert path).
const AUTOMATION_CATALOG = `
TRIGGERS (trigger_integration_type -> trigger_type, with the EXACT condition keys to use):
- gmail -> subject_match (condition: {"subject": "..."}) | from_match (condition: {"from": "..."}) | body_match (condition: {"body": "..."}) | search_query_match (condition: {"query": "..."}) | new_email_received (condition: {})
- webhook -> webhook_received (condition: {"secret": "..."} optional)
- youtube -> new_video_uploaded | video_liked
- hue -> motion_detected | button_pressed
Use ONLY those exact condition key names (e.g. "subject", never "subject_contains").
ACTIONS (action_integration_type -> action_type):
- stickies -> create_sticky        (config: folder)
- claude -> summarize | analyze | generate | classify   (config: prompt, model, output_folder)
- webhook -> send_webhook | post_request   (config: url, method, headers, body, ai_prompt)
- hue -> set_color | flash_lights | toggle_lights | set_scene   (config: group, color, brightness)
- gmail -> send_email   (config: to, subject, body)
`;

app.post('/api/automations/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const instruction = `You convert a plain-English request into ONE automation for a no-code builder.
Use ONLY these integration/trigger/action types:
${AUTOMATION_CATALOG}
Respond with ONLY valid JSON (no markdown) shaped exactly:
{"name": string, "trigger_integration_type": string, "trigger_type": string, "action_integration_type": string, "action_type": string, "action_config": object, "condition": object}
Pick the closest matching types. Put trigger filters (keywords, sender, query, secret) in "condition" and action settings in "action_config". Keep "name" short (max 6 words).`;
    const raw = await callClaude({ instruction, input: text.trim() });
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|^```\s*|```$/gm, '').trim());
    } catch {
      return res.status(422).json({ error: 'Could not understand that. Try rephrasing.', raw: raw.slice(0, 300) });
    }
    const { name, trigger_type, trigger_integration_type, action_type, action_integration_type, action_config, condition } = parsed;
    if (!name || !trigger_type || !action_type) {
      return res.status(422).json({ error: 'Incomplete automation generated', parsed });
    }
    // Claude tends to invent stale model ids; drop it so the server default applies.
    if (action_config && typeof action_config === 'object') delete action_config.model;

    // Dedup (same rule as POST /api/automations)
    if (trigger_integration_type && action_integration_type) {
      const dupe = await pool.query(
        `SELECT id, name FROM automations WHERE trigger_integration_type = $1 AND action_integration_type = $2 AND trigger_type = $3 AND action_type = $4 LIMIT 1`,
        [trigger_integration_type, action_integration_type, trigger_type, action_type]
      );
      if (dupe.rows.length > 0) {
        return res.status(409).json({ error: `Duplicate: "${dupe.rows[0].name}" already exists`, parsed });
      }
    }

    const result = await pool.query(
      `INSERT INTO automations (name, trigger_type, trigger_integration_type, action_type, action_integration_type, action_config, condition)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, trigger_type, trigger_integration_type || null, action_type, action_integration_type || null, action_config || {}, condition || {}]
    );
    console.log(`[nl] Created "${name}" from: ${text.slice(0, 80)}`);
    res.json({ automation: result.rows[0] });
  } catch (err) {
    console.error('[nl] parse error:', err.message);
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
    res.status(500).json({ error: 'internal error' });
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
    res.status(500).json({ error: 'internal error' });
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
    res.status(500).json({ error: 'internal error' });
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
    res.status(500).json({ error: 'internal error' });
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

// On-demand sync - the app calls this when opened or via the "Sync now" button.
// Replaces the old background poll: nothing hits YouTube/Gmail unless you ask.
app.post('/api/sync', async (req, res) => {
  const now = Date.now();
  if (now - lastSyncAt < 15000) {
    return res.json({ throttled: true, likes: 0 });
  }
  lastSyncAt = now;
  try {
    const result = await runSyncNow();
    res.json({ synced: true, ...result });
  } catch (err) {
    console.error('[sync] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Watcher loop
function startWatcher() {
  console.log('[watcher] Ready - on-demand sync only (no background polling)');

  // Concurrency guard: a slow tick must not stack on top of itself.
  let ytRunning = false;
  async function runCheck() {
    if (ytRunning) {
      console.log('[watcher] previous tick still running - skip');
      return;
    }
    ytRunning = true;
    let count = 0;
    try {
      const newLikes = await checkForNewLikes();
      count = newLikes.length;
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
            const failed = !!result.error;
            const logResult = failed ? 'failed' : 'success';
            const detail = failed
              ? `${result.error}${result.summary ? ` - ${result.summary}` : ''}`
              : (result.summary || '');
            for (const row of match.rows) {
              await pool.query(
                `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [row.id, row.name, JSON.stringify({ videoId: video.videoId, title: video.title, stickyId: result._stickyId || null, mindmapId: result._mindmapId || null, diagramId: result._diagramId || null }), logResult, detail.slice(0, 500), 'watcher']
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
    return count;
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

  // On-demand only: no background polling. YouTube has no "like" webhook, so the
  // app triggers a sync when opened or via the "Sync now" button (POST /api/sync).
  // Idle quota usage is zero - nothing runs while the app is closed.
  runSyncNow = async () => {
    const [likes] = await Promise.all([runCheck(), runGmailGuarded()]);
    return { likes: likes || 0 };
  };
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
        // Accept both the canonical key and the natural-language `_contains` variant.
        const subjectVal = cond.subject || cond.subject_contains;
        const fromVal = cond.from || cond.from_contains;
        const bodyVal = cond.body || cond.body_contains;
        let query = '';
        if (auto.trigger_type === 'search_query_match') {
          const raw = cond.query || '';
          query = raw.startsWith('"') ? raw : `"${raw}"`;
        }
        // Skip when a filter value is missing - otherwise `subject:""` matches every recent email.
        else if (auto.trigger_type === 'subject_match') { if (!subjectVal) continue; query = `subject:"${subjectVal}"`; }
        else if (auto.trigger_type === 'from_match') { if (!fromVal) continue; query = `from:${fromVal}`; }
        else if (auto.trigger_type === 'body_match') { if (!bodyVal) continue; query = `"${bodyVal}"`; }
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

          // Gmail's subject:/from: search is word/stem-based (and thread-wide),
          // not a literal substring match, so re-verify the configured filter
          // against the real header locally before acting.
          if (auto.trigger_type === 'subject_match' && subjectVal && !subject.toLowerCase().includes(String(subjectVal).toLowerCase())) continue;
          if (auto.trigger_type === 'from_match' && fromVal && !from.toLowerCase().includes(String(fromVal).toLowerCase())) continue;

          console.log(`[gmail-watcher] Match for "${auto.name}": ${subject} from ${maskEmail(from)}`);
          broadcast('gmail_match', { automationId: auto.id, subject, from, messageId: msg.id });

          // Manual mode: don't auto-execute. Just log as pending so the user
          // sees it queued and can trigger it from the UI.
          const isManual = auto.action_config?.manual === true || auto.action_config?.manual === 'true';
          if (isManual) {
            await pool.query(
              `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [auto.id, auto.name, JSON.stringify({ messageId: msg.id, subject, from }), 'pending', 'Waiting for manual run', 'gmail-watcher']
            );
            broadcast('logged', { automationId: auto.id, type: 'gmail', subject, pending: true });
            continue;
          }

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

// Inbound webhook receiver - external services POST here to fire an automation.
// Public (bypasses global bearer); optional per-automation secret in condition.secret.
app.all('/api/hooks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const found = await pool.query(
      `SELECT id, name, active, trigger_type, condition, action_type, action_config
       FROM automations WHERE id = $1 AND trigger_type = 'webhook_received' LIMIT 1`,
      [id]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'webhook not found' });
    const auto = found.rows[0];
    if (!auto.active) return res.status(403).json({ error: 'automation is paused' });

    const secret = auto.condition?.secret;
    if (secret) {
      const provided = req.headers['x-webhook-secret'] || req.query.secret;
      if (provided !== secret) return res.status(401).json({ error: 'invalid secret' });
    }

    const payload = (req.body && Object.keys(req.body).length) ? req.body : { ...req.query };
    console.log(`[webhook-in] Fired "${auto.name}" (${id})`);
    broadcast('webhook_received', { automationId: auto.id, payload });

    const isManual = auto.action_config?.manual === true || auto.action_config?.manual === 'true';
    if (isManual) {
      await pool.query(
        `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [auto.id, auto.name, JSON.stringify(payload), 'pending', 'Waiting for manual run', 'webhook-in']
      );
      broadcast('logged', { automationId: auto.id, type: 'webhook', pending: true });
      return res.json({ ok: true, queued: true });
    }

    let result = 'success';
    let detail_text = `Webhook payload received`;
    try {
      await executeAction(auto.action_type, auto.action_config, payload);
    } catch (actionErr) {
      result = 'error';
      detail_text = actionErr.message;
    }
    await pool.query(
      `INSERT INTO automation_logs (automation_id, automation_name, trigger_payload, result, detail, via)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [auto.id, auto.name, JSON.stringify(payload), result, detail_text.slice(0, 500), 'webhook-in']
    );
    broadcast('logged', { automationId: auto.id, type: 'webhook' });
    res.json({ ok: result === 'success', result });
  } catch (err) {
    console.error('[webhook-in] Error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

async function executeAction(actionType, config, triggerData) {
  console.log(`[action] Executing ${actionType}`, config);

  if (actionType === 'set_color' || actionType === 'flash_lights' || actionType === 'toggle_lights' || actionType === 'set_scene') {
    broadcast('hue_action', { actionType, config, trigger: triggerData });
    try {
      const result = await runHueAction(actionType, config);
      console.log(`[hue] ${actionType} done:`, result);
      return result;
    } catch (err) {
      console.error(`[hue] ${actionType} failed:`, err.message);
      throw err;
    }
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

  if (actionType === 'summarize' || actionType === 'analyze' || actionType === 'generate' || actionType === 'classify') {
    const instruction = config.prompt || CLAUDE_INSTRUCTIONS[actionType];
    const input = payloadToText(triggerData);
    const output = await callClaude({ instruction, input, model: config.model, apiKey: config.api_key });

    const folder = config.output_folder || config.folder || 'APPs/AUTOMATIONS';
    const title = (triggerData?.subject || `Claude ${actionType}`).slice(0, 200);
    const STICKIES_USER_ID = '47a18fff-a0c4-4f18-b0f0-40821c18793d';
    const stickyRes = await pool.query(
      `INSERT INTO stickies (title, content, folder_name, folder_color, type, icon, user_id, created_by_key)
       VALUES ($1, $2, $3, '#8b5cf6', 'markdown', '🤖', $4, 'automations-claude') RETURNING id`,
      [title, output, folder, STICKIES_USER_ID]
    );
    console.log(`[claude] ${actionType} -> sticky ${stickyRes.rows[0]?.id}`);
    return { executed: true, actionType, stickyId: stickyRes.rows[0]?.id, output: output.slice(0, 500) };
  }

  if (actionType === 'send_webhook' || actionType === 'post_request') {
    const url = fillTemplate(config.url || '', triggerData);
    if (!url) throw new Error('Webhook URL is required');
    const method = (config.method || 'POST').toUpperCase();

    let headers = { 'Content-Type': 'application/json' };
    if (config.headers) {
      try {
        const extra = typeof config.headers === 'string' ? JSON.parse(config.headers) : config.headers;
        headers = { ...headers, ...extra };
      } catch {
        console.warn('[webhook] Ignoring invalid headers JSON');
      }
    }

    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      if (config.ai_prompt) {
        // AI-enhance: run the payload through Claude, send the result as the body.
        const ai = await callClaude({ instruction: config.ai_prompt, input: payloadToText(triggerData), model: config.model, apiKey: config.api_key });
        body = config.body ? fillTemplate(config.body, { ...triggerData, ai }) : JSON.stringify({ text: ai });
      } else {
        body = config.body ? fillTemplate(config.body, triggerData) : JSON.stringify(triggerData || {});
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(url, { method, headers, body, signal: controller.signal });
      const text = await resp.text().catch(() => '');
      console.log(`[webhook] ${method} ${url} -> ${resp.status}`);
      if (!resp.ok) throw new Error(`Webhook responded ${resp.status}: ${text.slice(0, 200)}`);
      return { executed: true, status: resp.status, response: text.slice(0, 500) };
    } finally {
      clearTimeout(timeout);
    }
  }

  console.log(`[action] Unknown action type: ${actionType}`);
  return { executed: false, reason: 'unknown_action' };
}

// Flatten a trigger payload into plain text for an AI prompt.
function payloadToText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  const parts = [];
  if (data.subject) parts.push(`Subject: ${data.subject}`);
  if (data.from) parts.push(`From: ${data.from}`);
  if (data.snippet) parts.push(`Body: ${data.snippet}`);
  if (parts.length) return parts.join('\n');
  try { return JSON.stringify(data, null, 2); } catch { return String(data); }
}

// Call the Claude API with an instruction + input. Returns the text response.
async function callClaude({ instruction, input, model, apiKey }) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No Anthropic API key configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: `${instruction}\n\n---\n${input}` }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

const CLAUDE_INSTRUCTIONS = {
  summarize: 'Summarize the following content in 3-5 concise sentences.',
  analyze: 'Analyze the following content and extract the key insights as short bullet points.',
  generate: 'Using the following content as context, generate the requested output.',
  classify: 'Classify or categorize the following content. Respond with the category and a one-line reason.',
};

// Replace {{key}} tokens in a string with values from the trigger payload.
function fillTemplate(str, data) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? o : o[k]), data);
    return val == null ? '' : String(val);
  });
}

function getHistory() {
  try {
    const data = fs.readFileSync('./data/history.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Run migrations BEFORE accepting traffic so /api/* doesn't 500 during cold
// start while ALTER TABLE / CREATE INDEX statements settle.
(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error('[startup] migrate failed:', err.message);
    process.exit(1);
  }
  app.listen(PORT, async () => {
    console.log(`[automations-server] Running on port ${PORT}`);
    await seedGmailSeen();
    startWatcher();
  });
})();
