import { NextRequest, NextResponse } from 'next/server';

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

export async function GET() {
  try {
    const res = await fetch(`${VPS_URL}/api/connections`, { cache: 'no-store' });
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
      headers: { 'Content-Type': 'application/json' },
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
    });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
