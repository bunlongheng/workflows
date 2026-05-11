import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import pg from 'pg';
import { markProcessed } from './watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
console.log(`[pipeline] ANTHROPIC_API_KEY loaded: ${ANTHROPIC_API_KEY ? 'yes' : 'no'}`);

const pool = new pg.Pool({
  host: '/var/run/postgresql',
  database: '2026',
  user: 'postgres',
});

function getOAuthToken() {
  try {
    return JSON.parse(fs.readFileSync('./data/youtube-token.json', 'utf-8'));
  } catch {
    return null;
  }
}

export async function processVideo(videoId) {
  console.log(`[pipeline] Processing video: ${videoId}`);

  // Step 1: Get video title (using OAuth or fallback)
  const title = await getVideoTitle(videoId);

  // Step 2: Get transcript
  const transcript = await getTranscript(videoId);
  if (!transcript) {
    console.warn(`[pipeline] No transcript available for ${videoId}`);
    markProcessed(videoId, title, { summary: 'No transcript available' });
    return { videoId, title, error: 'No transcript available' };
  }

  console.log(`[pipeline] Transcript length: ${transcript.length} chars`);

  // Step 3: AI Processing
  const result = await aiProcess(title, transcript);

  // Step 4: Deliver to Stickies
  await deliverOutput(videoId, title, result);

  // Step 5: Generate Mind Map
  await generateMindMap(title, videoId, result);

  // Step 6: Generate Diagram
  await generateDiagram(title, videoId, result);

  // Step 7: Mark as processed
  markProcessed(videoId, title, result);

  console.log(`[pipeline] Done: ${title}`);
  return { videoId, title, ...result };
}

async function getTranscript(videoId) {
  // Method 1: Innertube player API (no auth needed, Android client bypasses blocks)
  try {
    const transcript = await fetchViaAndroidClient(videoId);
    if (transcript) return transcript;
  } catch (err) {
    console.log(`[transcript] Android client failed: ${err.message}`);
  }

  // Method 2: youtubetranscript.com public API
  try {
    const transcript = await fetchViaPublicAPI(videoId);
    if (transcript) return transcript;
  } catch (err) {
    console.log(`[transcript] Public API failed: ${err.message}`);
  }

  return null;
}

async function fetchViaAndroidClient(videoId) {
  // TV embedded player - works reliably for captions
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'TV_EMBEDDED_PLAYER',
          clientVersion: '2.0',
          hl: 'en',
        },
        thirdParty: { embedUrl: 'https://www.youtube.com' },
      },
    }),
  });

  if (!res.ok) throw new Error(`Innertube: ${res.status}`);

  const data = await res.json();
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!tracks || tracks.length === 0) {
    console.log('[transcript] No captions available for this video');
    return null;
  }

  const enTrack = tracks.find((t) => t.languageCode === 'en') || tracks[0];
  if (!enTrack?.baseUrl) return null;

  const captionRes = await fetch(enTrack.baseUrl + '&fmt=srv3');
  if (!captionRes.ok) throw new Error(`Caption XML: ${captionRes.status}`);

  const xml = await captionRes.text();
  return parseTimedTextXml(xml);
}

async function fetchViaPublicAPI(videoId) {
  const res = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
  if (!res.ok) throw new Error(`Public API: ${res.status}`);
  const xml = await res.text();
  if (!xml.includes('<text')) return null;
  return parseTimedTextXml(xml);
}

function parseTimedTextXml(xml) {
  const matches = xml.match(/<text[^>]*>(.*?)<\/text>/gs) || [];
  const texts = matches.map((m) => {
    return m.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, ' ').trim();
  });
  const joined = texts.join(' ').replace(/\s+/g, ' ').trim();
  return joined || null;
}

async function getVideoTitle(videoId) {
  // Try YouTube API with OAuth first
  const token = getOAuthToken();
  if (token?.access_token) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const title = data.items?.[0]?.snippet?.title;
        if (title) return title;
      }
    } catch {}
  }

  // Fallback to noembed
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();
    return data.title || `Video ${videoId}`;
  } catch {
    return `Video ${videoId}`;
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
const DEFAULT_USER_ID = '47a18fff-a0c4-4f18-b0f0-40821c18793d';

async function deliverOutput(videoId, title, result) {
  const content = formatAsMarkdown(title, videoId, result);

  // Write directly to stickies table in Postgres
  try {
    await pool.query(
      `INSERT INTO stickies (title, content, folder_name, folder_id, folder_color, type, icon, user_id)
       VALUES ($1, $2, 'YouTube', $3, '#FF3B30', 'markdown', '📺', $4)`,
      [`YT: ${title.slice(0, 50)}`, content, YOUTUBE_FOLDER_ID, DEFAULT_USER_ID]
    );
    console.log(`[output] Saved to Stickies DB: ${title}`);
  } catch (err) {
    console.error(`[output] Stickies DB error: ${err.message}`);
  }

  // Also save to local file as backup
  if (!fs.existsSync('./data/outputs')) fs.mkdirSync('./data/outputs', { recursive: true });
  fs.writeFileSync(`./data/outputs/${videoId}.md`, content);
}

function formatAsMarkdown(title, videoId, result) {
  const lines = [
    `## ${title}`,
    `https://youtube.com/watch?v=${videoId}`,
    '',
    '### Summary',
    result.summary || 'No summary available',
    '',
    '### Top Ideas',
  ];

  if (result.ideas?.length) {
    result.ideas.forEach((idea) => lines.push(`- ${idea}`));
  }

  if (result.topics?.length) {
    lines.push('', `**Topics:** ${result.topics.join(', ')}`);
  }

  return lines.join('\n');
}

const BRANCH_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

async function generateMindMap(title, videoId, result) {
  if (!result.ideas?.length) {
    console.log('[mindmap] No ideas to map, skipping');
    return;
  }

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
      `INSERT INTO mindmaps (name, type, line_style, theme_id, nodes, tags, user_id)
       VALUES ($1, 'mindmap', 'orthogonal', 'default', $2, $3, $4) RETURNING id`,
      [
        `YT: ${title.slice(0, 50)}`,
        JSON.stringify(nodes),
        result.topics || [],
        DEFAULT_USER_ID,
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
      [DEFAULT_USER_ID, `YT: ${title.slice(0, 50)}`, code, result.topics || []]
    );

    const diagramId = dgResult.rows[0]?.id;
    if (diagramId) result._diagramId = diagramId;
    console.log(`[diagram] Created sequence diagram: ${title} id=${diagramId}`);
  } catch (err) {
    console.error(`[diagram] Error: ${err.message}`);
  }
}
