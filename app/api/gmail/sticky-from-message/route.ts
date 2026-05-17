import { NextRequest, NextResponse } from 'next/server';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

// POST /api/gmail/sticky-from-message
// Body: { automationId, messageId }
// Proxies the VPS manual-run endpoint that strips the email body and saves a
// sticky directly to the shared stickies table.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { automationId, messageId } = body || {};
  if (!automationId || !messageId) {
    return NextResponse.json({ ok: false, error: 'automationId and messageId required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${VPS_URL}/api/gmail/sticky-from-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify({ automationId, messageId }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'VPS unreachable' }, { status: 502 });
  }
}
