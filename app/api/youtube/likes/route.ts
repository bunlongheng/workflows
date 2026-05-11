import { NextRequest, NextResponse } from 'next/server';

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function getValidToken(): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const res = await fetch(`${VPS_URL}/api/youtube/token`);
    if (!res.ok) return null;
    const data = await res.json();

    // Check if token is valid
    const testRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + data.access_token);
    if (testRes.ok) return data;

    // Refresh
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
        await fetch(`${VPS_URL}/api/youtube/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: data.refresh_token,
            expires_in: tokens.expires_in,
          }),
        });
        return { access_token: tokens.access_token, refresh_token: data.refresh_token };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const pageToken = request.nextUrl.searchParams.get('pageToken') || '';
  const maxResults = request.nextUrl.searchParams.get('maxResults') || '20';

  const tokenData = await getValidToken();
  if (!tokenData) {
    return NextResponse.json({ error: 'YouTube not connected' }, { status: 401 });
  }

  let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=${maxResults}`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `YouTube API: ${res.status}` }, { status: 502 });
  }

  const data = await res.json();

  const videos = (data.items || []).map((item: {
    id: string;
    snippet: { title: string; channelTitle: string; publishedAt: string; description: string; thumbnails: { medium: { url: string } } };
    contentDetails: { duration: string };
    statistics: { viewCount: string };
  }) => ({
    videoId: item.id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    duration: item.contentDetails?.duration || '',
    views: item.statistics?.viewCount || '0',
    description: (item.snippet.description || '').slice(0, 200),
  }));

  return NextResponse.json({
    videos,
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || 0,
  });
}
