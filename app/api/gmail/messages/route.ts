import { NextRequest, NextResponse } from 'next/server';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

// GET /api/gmail/messages?automationId=<id>
// Proxies the VPS endpoint that lists recent Gmail messages matching the
// automation's trigger condition (used by the manual-run UI).
export async function GET(request: NextRequest) {
  const automationId = request.nextUrl.searchParams.get('automationId');
  if (!automationId) {
    return NextResponse.json({ error: 'automationId required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${VPS_URL}/api/gmail/messages?automationId=${encodeURIComponent(automationId)}`,
      { cache: 'no-store', headers: vpsAuthHeaders() }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'VPS unreachable' }, { status: 502 });
  }
}
