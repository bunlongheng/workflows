import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  : 'http://localhost:3008/api/auth/gmail/callback';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error || !code || !CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/automations/new?connection=gmail&status=error', request.url));
  }

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
    return NextResponse.redirect(new URL('/automations/new?connection=gmail&status=error', request.url));
  }

  const tokens = await tokenRes.json();

  // Get email
  let accountEmail = '';
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (userRes.ok) {
    const userData = await userRes.json();
    accountEmail = userData.email || '';
  }

  // Save token to VPS
  try {
    await fetch(`${VPS_URL}/api/gmail/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        accountEmail,
      }),
    });

    // Register connection
    await fetch(`${VPS_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationId: 'gmail',
        accountName: accountEmail || 'Gmail',
        accountEmail,
        scopes: ['gmail.readonly'],
      }),
    });
  } catch (err) {
    console.error('[gmail-callback] Failed to forward tokens:', err);
  }

  const successUrl = new URL('/automations/new', request.url);
  successUrl.searchParams.set('connection', 'gmail');
  successUrl.searchParams.set('status', 'success');
  successUrl.searchParams.set('account', accountEmail);

  return NextResponse.redirect(successUrl.toString());
}
