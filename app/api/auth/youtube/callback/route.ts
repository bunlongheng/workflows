import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
  : 'http://localhost:3008/api/auth/youtube/callback';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?connection=youtube&status=error', request.url));
  }

  if (!code || !CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/?connection=youtube&status=error', request.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?connection=youtube&status=error', request.url));
  }

  const tokens = await tokenRes.json();

  // Get user's YouTube channel info
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  let accountName = 'YouTube Account';
  let accountEmail = '';

  if (channelRes.ok) {
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];
    if (channel) {
      accountName = channel.snippet?.title || accountName;
    }
  }

  // Get user email from Google userinfo
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (userRes.ok) {
    const userData = await userRes.json();
    accountEmail = userData.email || '';
  }

  // Forward tokens to VPS server for the watcher pipeline
  try {
    await fetch(`${VPS_URL}/api/youtube/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        accountName,
        accountEmail,
      }),
    });
  } catch (err) {
    console.error('[youtube-callback] Failed to forward tokens to VPS:', err);
  }

  // Redirect back with connection info
  const successUrl = new URL('/', request.url);
  successUrl.searchParams.set('connection', 'youtube');
  successUrl.searchParams.set('status', 'success');
  successUrl.searchParams.set('account', accountName);
  successUrl.searchParams.set('email', accountEmail);

  return NextResponse.redirect(successUrl.toString());
}
