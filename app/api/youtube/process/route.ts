import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STICKIES_URL = 'http://localhost:4444';
const STICKIES_TOKEN = 'sk_ext_72a5c2daa2602a7ccecddafb04a26e963fd138a2940db174a1c66ac3de5816f9';

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

  // Extract links from description
  const links = description.match(/https?:\/\/[^\s)]+/g) || [];

  const lines = [
    `![${title}](${thumbnail})`,
    '',
    `## ${title}`,
    `**Channel:** ${channelName}`,
    `**Video:** ${videoUrl}`,
    '',
    '### Summary',
    result.summary || 'No summary',
    '',
    '### Top Ideas',
  ];

  if (result.ideas?.length) {
    result.ideas.forEach((idea: string) => lines.push(`- ${idea}`));
  }

  if (result.topics?.length) {
    lines.push('', `**Topics:** ${result.topics.join(', ')}`);
  }

  // Add description
  if (description) {
    lines.push('', '### Description', description.slice(0, 2000));
  }

  // Add links from description
  if (links.length > 0) {
    lines.push('', '### Links');
    const unique = [...new Set(links)];
    unique.slice(0, 20).forEach((link: string) => lines.push(`- ${link}`));
  }

  try {
    const res = await fetch(`${STICKIES_URL}/api/stickies/ext`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STICKIES_TOKEN}`,
      },
      body: JSON.stringify({
        title: `YT: ${title.slice(0, 50)}`,
        content: lines.join('\n'),
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

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

async function logAutomation(videoId: string, title: string, result: { summary?: string }) {
  try {
    let summary = result.summary || '';
    // Clean JSON wrapper if present
    try {
      const parsed = JSON.parse(summary);
      summary = parsed.summary || summary;
    } catch {}

    await fetch(`${VPS_URL}/api/automations/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        title,
        summary: summary.slice(0, 500),
        result: 'success',
      }),
    });
  } catch (err) {
    console.error('[log]', err);
  }
}
