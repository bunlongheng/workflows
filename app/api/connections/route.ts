import { NextRequest, NextResponse } from 'next/server';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

export async function GET() {
  try {
    const res = await fetch(`${VPS_URL}/api/connections`, { cache: 'no-store', headers: vpsAuthHeaders() });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ connections: [], error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${VPS_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vpsAuthHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { integrationId } = await request.json();
    const res = await fetch(`${VPS_URL}/api/connections/${integrationId}`, {
      method: 'DELETE',
      headers: vpsAuthHeaders(),
    });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
