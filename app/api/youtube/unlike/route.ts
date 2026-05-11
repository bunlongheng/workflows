import { NextRequest, NextResponse } from 'next/server';

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function getValidToken(): Promise<string | null> {
  try {
    // Get token from VPS
    const res = await fetch(`${VPS_URL}/api/youtube/token`);
    if (!res.ok) return null;
    const data = await res.json();

    // Test if token is still valid
    const testRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + data.access_token);
    if (testRes.ok) return data.access_token;

    // Token expired - refresh it
    if (data.refresh_token && CLIENT_ID && CLIENT_SECRET) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: data.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshRes.ok) {
        const tokens = await refreshRes.json();
        // Update token on VPS
        await fetch(`${VPS_URL}/api/youtube/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: data.refresh_token,
            expires_in: tokens.expires_in,
          }),
        });
        return tokens.access_token;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { videoId } = await request.json();

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 });
  }

  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: 'YouTube not connected or token expired. Reconnect YouTube.' }, { status: 401 });
  }

  // Unlike on YouTube (set rating to 'none')
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=none`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `YouTube API: ${res.status}` }, { status: 502 });
  }

  return NextResponse.json({ success: true, videoId, unliked: true });
}
