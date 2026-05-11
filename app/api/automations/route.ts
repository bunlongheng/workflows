import { NextResponse } from 'next/server';

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

export async function GET() {
  try {
    const res = await fetch(`${VPS_URL}/api/youtube/status`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { connected: false, processed: 0, recent: [], error: (err as Error).message },
      { status: 502 }
    );
  }
}
