import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.resolve('./data/history.json');

// Ensure data directory exists
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

// OAuth token state
let oauthToken = null;

export function setOAuthToken(token) {
  oauthToken = token;
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export async function checkForNewLikes() {
  if (!oauthToken?.access_token) {
    console.log('[watcher] No YouTube token - skipping. Connect YouTube in the Automations app.');
    return [];
  }

  // Use OAuth token to fetch liked videos playlist
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/videos?part=snippet&myRating=like&maxResults=10',
    {
      headers: {
        Authorization: `Bearer ${oauthToken.access_token}`,
      },
    }
  );

  if (res.status === 401) {
    // Token expired - try refresh
    console.log('[watcher] Token expired, attempting refresh...');
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      console.error('[watcher] Token refresh failed - reconnect YouTube in the app');
      return [];
    }
    // Retry with new token
    return checkForNewLikes();
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const history = loadHistory();
  const processedIds = new Set(history.map((h) => h.videoId));

  const newVideos = [];

  for (const item of data.items || []) {
    const videoId = item.id;
    const title = item.snippet?.title;

    if (videoId && !processedIds.has(videoId)) {
      newVideos.push({ videoId, title, likedAt: new Date().toISOString() });
    }
  }

  return newVideos;
}

async function refreshAccessToken() {
  if (!oauthToken?.refresh_token) return false;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[watcher] Cannot refresh - no GOOGLE_CLIENT_ID/SECRET on VPS');
    return false;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oauthToken.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) return false;

    const tokens = await res.json();
    oauthToken.access_token = tokens.access_token;
    oauthToken.expires_in = tokens.expires_in;
    oauthToken.saved_at = new Date().toISOString();

    // Persist updated token
    fs.writeFileSync('./data/youtube-token.json', JSON.stringify(oauthToken, null, 2));
    console.log('[watcher] Token refreshed successfully');
    return true;
  } catch (err) {
    console.error('[watcher] Refresh error:', err.message);
    return false;
  }
}

export function markProcessed(videoId, title, result) {
  const history = loadHistory();
  history.push({
    videoId,
    title,
    processedAt: new Date().toISOString(),
    summary: result?.summary?.slice(0, 100) || '',
  });
  // Keep last 200 entries
  if (history.length > 200) history.splice(0, history.length - 200);
  saveHistory(history);
}
