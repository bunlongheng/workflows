import { NextRequest, NextResponse } from 'next/server';
import { verifyAndClearOAuthState } from '@/lib/oauth-state';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
  : 'http://localhost:3008/api/auth/youtube/callback';

function errorRedirect(request: NextRequest): NextResponse {
  const url = new URL('/automations/new?connection=youtube&status=error', request.url);
  const res = NextResponse.redirect(url);
  verifyAndClearOAuthState(request, res, 'youtube');
  return res;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return errorRedirect(request);
  }

  if (!code || !CLIENT_ID || !CLIENT_SECRET) {
    return errorRedirect(request);
  }

  // CSRF: verify state echoed back matches the cookie we set during init.
  const stateProbe = NextResponse.next();
  const stateOk = verifyAndClearOAuthState(request, stateProbe, 'youtube');
  if (!stateOk) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
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
    return errorRedirect(request);
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

  // Forward tokens to VPS server for the watcher pipeline. If this fails,
  // the connection is unusable downstream — redirect to error rather than
  // misleading the user with a success state.
  try {
    const vpsRes = await fetch(`${VPS_URL}/api/youtube/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        accountName,
        accountEmail,
      }),
    });
    if (!vpsRes.ok) {
      console.error('[youtube-callback] VPS forward returned', vpsRes.status);
      return errorRedirect(request);
    }
  } catch (err) {
    console.error('[youtube-callback] Failed to forward tokens to VPS:', err);
    return errorRedirect(request);
  }

  // Defensive: assert the redirect target is same-origin. Today the URL is
  // built from `request.url` so this is by construction, but if a future
  // change ever sources the target from a query/cookie param this guard
  // prevents open-redirect attacks.
  const requestOrigin = new URL(request.url).origin;
  const successUrl = new URL('/automations/new', request.url);
  successUrl.searchParams.set('connection', 'youtube');
  successUrl.searchParams.set('status', 'success');
  successUrl.searchParams.set('account', accountName);
  successUrl.searchParams.set('email', accountEmail);

  const finalUrl =
    successUrl.origin === requestOrigin
      ? successUrl
      : new URL('/automations/new?connection=youtube&status=success', request.url);

  const res = NextResponse.redirect(finalUrl.toString());
  // Carry forward the state-cookie deletion onto the success response
  stateProbe.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
