import { NextResponse } from 'next/server';
import { setOAuthStateCookie } from '@/lib/oauth-state';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
  : 'http://localhost:3008/api/auth/youtube/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ');

export async function GET() {
  if (!CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID in env.' },
      { status: 500 }
    );
  }

  // Stage a placeholder response so we can mint and persist the state cookie
  // before composing the final redirect URL.
  const stageRes = NextResponse.next();
  const state = setOAuthStateCookie(stageRes, 'youtube');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  // Forward the state cookie onto the actual redirect response
  stageRes.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}
