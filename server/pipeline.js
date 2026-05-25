import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { pool } from './db.js';
import { markProcessed } from './watcher.js';
import { AI_BAILOUT_REGEX, escapeHtml, parseJson3, parseTimedTextXml } from './pipeline-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
console.log(`[pipeline] ANTHROPIC_API_KEY loaded: ${ANTHROPIC_API_KEY ? 'yes' : 'no'}`);

function getOAuthToken() {
  try {
    return JSON.parse(fs.readFileSync('./data/youtube-token.json', 'utf-8'));
  } catch {
    return null;
  }
}

export async function processVideo(videoId) {
  console.log(`[pipeline] Processing video: ${videoId}`);

  // Steps 1+2: Metadata and transcript are independent - fetch in parallel
  const [meta, transcript] = await Promise.all([
    getVideoMeta(videoId),
    getTranscript(videoId),
  ]);

  if (!transcript) {
    console.warn(`[pipeline] No transcript available for ${videoId}`);
    markProcessed(videoId, meta.title, { summary: 'No transcript available' });
    return { videoId, title: meta.title, error: 'No transcript available' };
  }

  console.log(`[pipeline] Transcript length: ${transcript.length} chars`);

  // Step 3: AI Processing
  const result = await aiProcess(meta.title, transcript);

  // Detect AI-level failure: empty ideas/topics AND a summary that admits inability
  const noIdeas = !result.ideas?.length;
  const noTopics = !result.topics?.length;
  const summary = (result.summary || '').toLowerCase();
  const aiBailed = AI_BAILOUT_REGEX.test(summary);
  if (noIdeas && noTopics && aiBailed) {
    result.error = 'AI could not extract content from transcript';
  }

  // Step 4: Deliver to Stickies (pass transcript so the sticky includes it)
  await deliverOutput(videoId, meta, result, transcript);

  // Steps 5+6: Mind map and diagram are independent - generate in parallel
  await Promise.all([
    generateMindMap(meta.title, videoId, result),
    generateDiagram(meta.title, videoId, result),
  ]);

  // Step 7: Mark as processed
  markProcessed(videoId, meta.title, result);

  console.log(`[pipeline] Done: ${meta.title}${result.error ? ` (failed: ${result.error})` : ''}`);
  return { videoId, title: meta.title, ...result };
}

// Ordered transcript fetch chain. YouTube fully bot-blocks datacenter IPs
// (Linode VPS), so the most reliable path is yt-dlp with a logged-in cookies
// file. We try, in order: yt-dlp (cookies) -> multi-client innertube -> public API.
async function getTranscript(videoId) {
  const methods = [
    ['yt-dlp', fetchViaYtDlp],
    ['innertube', fetchViaInnertube],
    ['public-api', fetchViaPublicAPI],
    // Paid fallback (transcriptapi.com): only reached when the free methods
    // fail (e.g. datacenter-IP bot block), and only charges a credit on success.
    ['transcriptapi', fetchViaTranscriptApi],
  ];
  for (const [name, fn] of methods) {
    try {
      const t = await fn(videoId);
      if (t && t.length > 0) {
        console.log(`[transcript] got ${t.length} chars via ${name}`);
        return t;
      }
      console.log(`[transcript] ${name} returned nothing`);
    } catch (err) {
      console.log(`[transcript] ${name} failed: ${err.message}`);
    }
  }
  return null;
}

// yt-dlp is the gold standard - actively maintained, adapts to YouTube changes.
// Datacenter IPs (Linode VPS) hit "Sign in to confirm you're not a bot", so route
// through a residential exit when available:
//   - YTDLP_PROXY (e.g. socks5://127.0.0.1:1080, an SSH SOCKS tunnel into the M4
//     over Tailscale) makes YouTube see the home IP - free + unlimited + reliable.
//   - YOUTUBE_COOKIES_FILE (browser cookies) is an alternative bypass.
function fetchViaYtDlp(videoId) {
  return new Promise((resolve, reject) => {
    const tmpBase = `/tmp/yt-${videoId}-${Date.now()}`;
    const cookiesFile = process.env.YOUTUBE_COOKIES_FILE || './data/youtube-cookies.txt';
    const proxy = process.env.YTDLP_PROXY;
    const args = [
      '--skip-download', '--no-warnings', '--quiet',
      '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en.*', '--sub-format', 'json3',
      '-o', `${tmpBase}.%(ext)s`,
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    if (proxy) args.unshift('--proxy', proxy);
    if (fs.existsSync(cookiesFile)) args.unshift('--cookies', cookiesFile);

    const child = spawn('yt-dlp', args, { timeout: 60000 });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => reject(new Error(`yt-dlp spawn: ${e.message}`)));
    child.on('close', () => {
      try {
        const dir = '/tmp';
        const prefix = tmpBase.split('/').pop();
        const subFile = fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.json3'));
        if (!subFile) {
          return reject(new Error(stderr.split('\n').filter(Boolean).pop() || 'no subtitle file produced'));
        }
        const full = `${dir}/${subFile}`;
        const json3 = fs.readFileSync(full, 'utf-8');
        fs.unlinkSync(full);
        resolve(parseJson3(json3));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Multi-client innertube. Different clients have different bot-detection;
// fetch the caption track as json3 (cleaner than srv3 XML).
async function fetchViaInnertube(videoId) {
  const clients = [
    { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en' },
    { clientName: 'IOS', clientVersion: '19.09.3', hl: 'en' },
    { clientName: 'TV_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', _embed: true },
    { clientName: 'WEB', clientVersion: '2.20240101', hl: 'en' },
  ];
  for (const c of clients) {
    try {
      const { _embed, ...client } = c;
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          context: { client, ...(_embed ? { thirdParty: { embedUrl: 'https://www.youtube.com' } } : {}) },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks || tracks.length === 0) continue;
      const enTrack = tracks.find((t) => t.languageCode === 'en') || tracks[0];
      if (!enTrack?.baseUrl) continue;
      const capRes = await fetch(enTrack.baseUrl + '&fmt=json3');
      if (!capRes.ok) continue;
      const parsed = parseJson3(await capRes.text());
      if (parsed) return parsed;
    } catch {
      // try next client
    }
  }
  return null;
}

async function fetchViaPublicAPI(videoId) {
  const res = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
  if (!res.ok) throw new Error(`Public API: ${res.status}`);
  const xml = await res.text();
  if (!xml.includes('<text')) return null;
  const parsed = parseTimedTextXml(xml);
  // This endpoint frequently returns a truncated/error stub (~100-150 chars).
  // Reject anything implausibly short so junk never gets summarized as a real
  // transcript - better to report "no transcript" truthfully.
  if (!parsed || parsed.length < 200) return null;
  return parsed;
}

// transcriptapi.com - hosted service with residential proxies. Works from the
// datacenter VPS where YouTube blocks direct access. 1 credit per success only.
async function fetchViaTranscriptApi(videoId) {
  const key = process.env.TRANSCRIPTAPI_KEY;
  if (!key) return null; // not configured - skip silently
  const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`transcriptapi: ${res.status}`);
  const data = await res.json();
  const segs = Array.isArray(data?.transcript) ? data.transcript : [];
  const joined = segs.map((s) => s?.text || '').join(' ').replace(/\s+/g, ' ').trim();
  return joined || null;
}

async function getVideoMeta(videoId) {
  // Try YouTube API with OAuth first - gets title, channel, description
  const token = getOAuthToken();
  if (token?.access_token) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const snippet = data.items?.[0]?.snippet;
        if (snippet?.title) {
          return {
            title: snippet.title,
            channel: snippet.channelTitle || '',
            description: snippet.description || '',
          };
        }
      }
    } catch {}
  }

  // Fallback to noembed (title only)
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();
    return { title: data.title || `Video ${videoId}`, channel: data.author_name || '', description: '' };
  } catch {
    return { title: `Video ${videoId}`, channel: '', description: '' };
  }
}

async function aiProcess(title, transcript) {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[ai] No ANTHROPIC_API_KEY - returning raw transcript');
    return { summary: transcript.slice(0, 500), ideas: [], topics: [], transcript };
  }

  const trimmed = transcript.slice(0, 50000);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are analyzing a YouTube video transcript. Video title: "${title}"

Transcript:
${trimmed}

Provide a JSON response with:
1. "summary" - A concise 3-5 sentence summary
2. "ideas" - Array of 5-7 top ideas/takeaways (one sentence each)
3. "topics" - Array of 3-5 topic tags

Respond ONLY with valid JSON, no markdown.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  let text = data.content[0]?.text || '{}';

  // Strip markdown code blocks if present
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    return { summary: text, ideas: [], topics: [] };
  }
}

const YOUTUBE_FOLDER_ID = 'e28dfc1d-e1bb-431f-bb54-b27b9f595704';
const STICKIES_USER_ID = '47a18fff-a0c4-4f18-b0f0-40821c18793d';
const DIAGRAMS_USER_ID = '731ace87-64e5-44db-bf2a-82265f06f4d9';

async function deliverOutput(videoId, meta, result, transcript) {
  const content = formatAsHTML(meta, videoId, result, transcript);

  // Write directly to stickies table in Postgres. type MUST be 'html' - the
  // content is HTML and the Stickies app renders by type (markdown would show
  // raw tags). The Stickies external API rejects markdown outright.
  try {
    await pool.query(
      `INSERT INTO stickies (title, content, folder_name, folder_id, folder_color, type, icon, user_id)
       VALUES ($1, $2, 'YouTube', $3, '#FF3B30', 'html', '📺', $4)`,
      [`YT: ${meta.title.slice(0, 50)}`, content, YOUTUBE_FOLDER_ID, STICKIES_USER_ID]
    );
    console.log(`[output] Saved to Stickies DB: ${meta.title}`);
  } catch (err) {
    console.error(`[output] Stickies DB error: ${err.message}`);
  }

  // Also save to local file as backup
  if (!fs.existsSync('./data/outputs')) fs.mkdirSync('./data/outputs', { recursive: true });
  fs.writeFileSync(`./data/outputs/${videoId}.html`, content);
}

function formatAsHTML(meta, videoId, result, transcript) {
  const { title, channel, description } = meta;
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const url = `https://youtube.com/watch?v=${videoId}`;

  const safeTitle = escapeHtml(title);
  const safeChannel = escapeHtml(channel);

  const topicsHTML = (result.topics || []).map(t =>
    `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;background:#1e1e1e;color:#aaa;font-size:11px;">${escapeHtml(t)}</span>`
  ).join('');

  const ideasHTML = (result.ideas || []).map(idea =>
    `<li style="margin-bottom:6px;line-height:1.5;">${escapeHtml(idea)}</li>`
  ).join('');

  // Extract links from description
  const links = (description || '').match(/https?:\/\/[^\s)]+/g) || [];
  const uniqueLinks = [...new Set(links)].slice(0, 15);

  const linksHTML = uniqueLinks.length > 0
    ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Links</h3>
<ul style="margin:0;padding-left:16px;font-size:13px;">${uniqueLinks.map(l => `<li style="margin-bottom:4px;"><a href="${escapeHtml(l)}" target="_blank" style="color:#6366f1;word-break:break-all;">${escapeHtml(l)}</a></li>`).join('')}</ul>`
    : '';

  const descHTML = description
    ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Description</h3>
<p style="margin:0;line-height:1.6;color:#999;font-size:13px;white-space:pre-wrap;">${escapeHtml(description.slice(0, 2000))}</p>`
    : '';

  // Full transcript, collapsed by default so the sticky stays skimmable.
  const transcriptHTML = transcript
    ? `<details style="margin:20px 0 0;">
<summary style="cursor:pointer;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Full Transcript (${transcript.length.toLocaleString()} chars)</summary>
<p style="margin:8px 0 0;line-height:1.7;color:#bbb;font-size:13px;white-space:pre-wrap;">${escapeHtml(transcript)}</p>
</details>`
    : '';

  return `<div style="font-family:-apple-system,system-ui,sans-serif;color:#e0e0e0;max-width:100%;overflow-wrap:break-word;">
<a href="${url}" target="_blank" style="text-decoration:none;">
  <img src="${thumbnail}" alt="${safeTitle}" style="width:100%;border-radius:8px;margin-bottom:12px;" />
</a>

<h2 style="margin:0 0 4px 0;font-size:18px;color:#fff;line-height:1.3;">${safeTitle}</h2>
${safeChannel ? `<p style="margin:0 0 2px;color:#888;font-size:12px;">${safeChannel}</p>` : ''}
<a href="${url}" target="_blank" style="color:#666;font-size:12px;text-decoration:none;">${url}</a>

${topicsHTML ? `<div style="margin:12px 0;">${topicsHTML}</div>` : ''}

<h3 style="margin:16px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Summary</h3>
<p style="margin:0;line-height:1.6;color:#ccc;font-size:14px;">${escapeHtml(result.summary) || 'No summary available'}</p>

${ideasHTML ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Key Takeaways</h3>
<ol style="margin:0;padding-left:20px;color:#ccc;font-size:14px;">${ideasHTML}</ol>` : ''}

${descHTML}
${linksHTML}
${transcriptHTML}
</div>`;
}

const BRANCH_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

async function generateMindMap(title, videoId, result) {
  if (!result.ideas?.length) {
    console.log('[mindmap] No ideas to map, skipping');
    return;
  }

  // Load config from the active mindmap automation
  let cfg = {};
  try {
    const r = await pool.query(
      `SELECT action_config FROM automations
       WHERE active = true AND action_integration_type = 'mindmap'
       ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`
    );
    cfg = r.rows[0]?.action_config || {};
  } catch (e) {
    console.warn('[mindmap] Could not load config:', e.message);
  }

  const mmType = cfg.type || 'logic';
  const mmLine = cfg.line || 'brace';
  const titleMax = Math.max(5, Math.min(120, parseInt(cfg.title_max, 10) || 30));
  const titlePrefix = cfg.title_prefix ? `${cfg.title_prefix} ` : '';

  try {
    const rootId = crypto.randomUUID();
    const nodes = [];
    const rootW = 280;
    const rootH = 50;

    // Root node - video title
    nodes.push({
      id: rootId,
      title: title.slice(0, 60),
      parentId: null,
      depth: 0,
      x: 0, y: 0,
      width: rootW, height: rootH,
      color: '#6366f1',
      sortOrder: 0,
    });

    // Topic branches (depth 1)
    const topics = result.topics?.length ? result.topics : ['Key Ideas'];
    const branchGap = 120;
    const startY = -(topics.length - 1) * branchGap / 2;

    topics.forEach((topic, i) => {
      const branchId = crypto.randomUUID();
      const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
      nodes.push({
        id: branchId,
        title: topic,
        parentId: rootId,
        depth: 1,
        x: 400, y: startY + i * branchGap,
        width: 200, height: 40,
        color,
        sortOrder: i,
      });

      // Distribute ideas across topics
      const ideasPerTopic = result.ideas.filter((_, idx) =>
        Math.floor(idx / Math.ceil(result.ideas.length / topics.length)) === i
      );

      ideasPerTopic.forEach((idea, j) => {
        nodes.push({
          id: crypto.randomUUID(),
          title: idea.slice(0, 80),
          parentId: branchId,
          depth: 2,
          x: 700, y: startY + i * branchGap + (j - (ideasPerTopic.length - 1) / 2) * 50,
          width: 240, height: 36,
          color,
          sortOrder: j,
        });
      });
    });

    // Insert into mindmaps table
    const mmResult = await pool.query(
      `INSERT INTO mindmaps (name, type, line_style, theme_id, nodes, user_id)
       VALUES ($1, $2, $3, 'default', $4, $5) RETURNING id`,
      [
        `${titlePrefix}${title.slice(0, titleMax)}`,
        mmType,
        mmLine,
        JSON.stringify(nodes),
        DIAGRAMS_USER_ID,
      ]
    );

    const mindmapId = mmResult.rows[0]?.id;
    if (mindmapId) result._mindmapId = mindmapId;
    console.log(`[mindmap] Created mind map: ${title} (${nodes.length} nodes) id=${mindmapId}`);
  } catch (err) {
    console.error(`[mindmap] Error: ${err.message}`);
  }
}

async function generateDiagram(title, videoId, result) {
  if (!result.ideas?.length || !ANTHROPIC_API_KEY) {
    console.log('[diagram] No ideas or no API key, skipping');
    return;
  }

  try {
    // Ask Claude to generate a Mermaid diagram from the summary
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Generate a Mermaid sequence diagram that shows the key concepts and their relationships from this video summary.

Title: "${title}"
Summary: ${result.summary}
Key Ideas: ${(result.ideas || []).join('; ')}
Topics: ${(result.topics || []).join(', ')}

Return ONLY valid Mermaid syntax starting with "sequenceDiagram". Keep it under 20 interactions. Use short participant names.`,
        }],
      }),
    });

    if (!res.ok) {
      console.error(`[diagram] Claude API: ${res.status}`);
      return;
    }

    const data = await res.json();
    let code = data.content[0]?.text || '';
    code = code.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    if (!code.startsWith('sequenceDiagram')) {
      console.log('[diagram] Invalid Mermaid output, skipping');
      return;
    }

    const dgResult = await pool.query(
      `INSERT INTO diagrams (user_id, title, code, diagram_type, tags)
       VALUES ($1, $2, $3, 'sequence', $4) RETURNING id`,
      [DIAGRAMS_USER_ID, `YT: ${title.slice(0, 50)}`, code, result.topics || []]
    );

    const diagramId = dgResult.rows[0]?.id;
    if (diagramId) result._diagramId = diagramId;
    console.log(`[diagram] Created sequence diagram: ${title} id=${diagramId}`);
  } catch (err) {
    console.error(`[diagram] Error: ${err.message}`);
  }
}
