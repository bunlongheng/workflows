// TODO: Legacy duplicate of server/pipeline.js parseTimedTextXml path. Still called from
// app/automations/[id]/page.tsx and mcp/index.js. Migrate those callers to the VPS pipeline,
// then delete this route and remove the youtube-transcript dependency from package.json.
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STICKIES_URL = process.env.STICKIES_URL || 'http://localhost:4444';
const STICKIES_TOKEN = process.env.STICKIES_TOKEN || '';

export async function POST(request: NextRequest) {
  const { videoId, videoUrl } = await request.json();
  const id = videoId || extractVideoId(videoUrl);

  if (!id) {
    return NextResponse.json({ error: 'videoId or videoUrl required' }, { status: 400 });
  }

  try {
    // Step 1: Get title + description
    const meta = await getVideoMeta(id);
    const title = meta.title;
    const description = meta.description;
    const channelName = meta.channelName;
    console.log(`[process] ${title}`);

    // Step 2: Get transcript
    const transcript = await getTranscript(id);
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript available', title, videoId: id });
    }
    console.log(`[process] Transcript: ${transcript.length} chars`);

    // Step 3: AI summarize
    const result = await summarize(title, transcript);
    console.log(`[process] Summary generated`);

    // Step 4: Post to Stickies
    const sticky = await postToStickies(title, id, description, channelName, result);
    console.log(`[process] Posted to Stickies: ${sticky?.id || 'failed'}`);

    // Step 5: Log to automation_logs on VPS DB
    await logAutomation(id, title, result);

    return NextResponse.json({
      success: true,
      videoId: id,
      title,
      channelName,
      ...result,
      stickyId: sticky?.id,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function getVideoMeta(videoId: string): Promise<{ title: string; description: string; channelName: string }> {
  try {
    // Use oEmbed for title
    const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const oembed = await oembedRes.json();

    // Use innertube for description
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en' } },
      }),
    });

    let description = '';
    let channelName = oembed.author_name || '';

    if (playerRes.ok) {
      const data = await playerRes.json();
      description = data?.videoDetails?.shortDescription || '';
      channelName = data?.videoDetails?.author || channelName;
    }

    return {
      title: oembed.title || `Video ${videoId}`,
      description,
      channelName,
    };
  } catch {
    return { title: `Video ${videoId}`, description: '', channelName: '' };
  }
}

async function getTranscript(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) return null;
    return segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.error('[transcript]', (err as Error).message);
    return null;
  }
}

async function summarize(title: string, transcript: string) {
  if (!ANTHROPIC_API_KEY) {
    return { summary: transcript.slice(0, 500), ideas: [], topics: [] };
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
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyze this YouTube video transcript.

Title: "${title}"

Transcript:
${trimmed}

Return JSON only (no markdown):
{
  "summary": "3-5 sentence summary",
  "ideas": ["idea 1", "idea 2", ...5-7 ideas],
  "topics": ["topic 1", "topic 2", ...3-5 tags]
}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Claude API: ${res.status}`);

  const data = await res.json();
  const text = data.content[0]?.text || '{}';

  try {
    return JSON.parse(text);
  } catch {
    return { summary: text, ideas: [], topics: [] };
  }
}

async function postToStickies(title: string, videoId: string, description: string, channelName: string, result: { summary?: string; ideas?: string[]; topics?: string[] }) {
  const videoUrl = `https://youtube.com/watch?v=${videoId}`;
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const links = description.match(/https?:\/\/[^\s)]+/g) || [];
  const uniqueLinks = [...new Set(links)].slice(0, 15);

  const topicsHTML = (result.topics || []).map(t =>
    `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;background:#1e1e1e;color:#aaa;font-size:11px;">${t}</span>`
  ).join('');

  const ideasHTML = (result.ideas || []).map(idea =>
    `<li style="margin-bottom:6px;line-height:1.5;">${idea}</li>`
  ).join('');

  const linksHTML = uniqueLinks.length > 0
    ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Links</h3>
<ul style="margin:0;padding-left:16px;font-size:13px;">${uniqueLinks.map(l => `<li style="margin-bottom:4px;"><a href="${l}" target="_blank" style="color:#6366f1;word-break:break-all;">${l}</a></li>`).join('')}</ul>`
    : '';

  const descHTML = description
    ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Description</h3>
<p style="margin:0;line-height:1.6;color:#999;font-size:13px;white-space:pre-wrap;">${description.slice(0, 2000)}</p>`
    : '';

  const content = `<div style="font-family:-apple-system,system-ui,sans-serif;color:#e0e0e0;max-width:100%;overflow-wrap:break-word;">
<a href="${videoUrl}" target="_blank" style="text-decoration:none;">
  <img src="${thumbnail}" alt="${title}" style="width:100%;border-radius:8px;margin-bottom:12px;" />
</a>

<h2 style="margin:0 0 4px 0;font-size:18px;color:#fff;line-height:1.3;">${title}</h2>
<p style="margin:0 0 2px;color:#888;font-size:12px;">${channelName}</p>
<a href="${videoUrl}" target="_blank" style="color:#666;font-size:12px;text-decoration:none;">${videoUrl}</a>

${topicsHTML ? `<div style="margin:12px 0;">${topicsHTML}</div>` : ''}

<h3 style="margin:16px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Summary</h3>
<p style="margin:0;line-height:1.6;color:#ccc;font-size:14px;">${result.summary || 'No summary available'}</p>

${ideasHTML ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">Key Takeaways</h3>
<ol style="margin:0;padding-left:20px;color:#ccc;font-size:14px;">${ideasHTML}</ol>` : ''}

${descHTML}
${linksHTML}
</div>`;

  try {
    const res = await fetch(`${STICKIES_URL}/api/stickies/ext`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STICKIES_TOKEN}`,
      },
      body: JSON.stringify({
        title: `YT: ${title.slice(0, 50)}`,
        content,
        type: 'markdown',
        folder_name: 'YouTube',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.note;
    }
  } catch (err) {
    console.error('[stickies]', err);
  }

  return null;
}

async function logAutomation(videoId: string, title: string, result: { summary?: string; error?: string; ideas?: unknown[]; topics?: unknown[] }) {
  try {
    let summary = result.summary || '';
    // Clean JSON wrapper if present
    try {
      const parsed = JSON.parse(summary);
      summary = parsed.summary || summary;
    } catch {}

    const noIdeas = !result.ideas?.length;
    const noTopics = !result.topics?.length;
    const aiBailed = /transcript (unavailab|not avail|missing)|cannot summarize|no transcript|unable to provide|insufficient (content|information)/i.test(summary);
    const failed = !!result.error || (noIdeas && noTopics && aiBailed);
    const detail = failed
      ? `${result.error || 'AI could not extract content'}${summary ? ` - ${summary}` : ''}`
      : summary;

    await fetch(`${VPS_URL}/api/automations/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify({
        videoId,
        title,
        summary: detail.slice(0, 500),
        result: failed ? 'failed' : 'success',
      }),
    });
  } catch (err) {
    console.error('[log]', err);
  }
}
