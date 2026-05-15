import { NextResponse } from 'next/server';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

const STICKIES_URL = 'http://localhost:4444';

interface HealthCheck {
  id: string;
  name: string;
  connected: boolean;
  method: string;
  detail?: string;
}

async function checkStickies(): Promise<HealthCheck> {
  try {
    const res = await fetch(`${STICKIES_URL}/api/stickies?limit=1`, { signal: AbortSignal.timeout(3000) });
    return { id: 'stickies', name: 'Stickies', connected: res.ok, method: 'API health check', detail: res.ok ? 'API reachable' : `HTTP ${res.status}` };
  } catch {
    return { id: 'stickies', name: 'Stickies', connected: false, method: 'API health check', detail: 'Unreachable' };
  }
}

async function checkYouTube(): Promise<HealthCheck> {
  try {
    const res = await fetch(`${VPS_URL}/api/youtube/status`, { signal: AbortSignal.timeout(3000), headers: vpsAuthHeaders() });
    const data = await res.json();
    return {
      id: 'youtube',
      name: 'YouTube',
      connected: data.connected === true,
      method: 'OAuth token on VPS',
      detail: data.connected ? `Token for ${data.account?.name || 'unknown'}` : 'No token',
    };
  } catch {
    return { id: 'youtube', name: 'YouTube', connected: false, method: 'OAuth token on VPS', detail: 'VPS unreachable' };
  }
}

export async function GET() {
  const checks = await Promise.all([checkYouTube(), checkStickies()]);
  return NextResponse.json({ checks });
}
