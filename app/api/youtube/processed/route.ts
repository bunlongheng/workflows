import { NextResponse } from 'next/server';

const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

export async function GET() {
  try {
    const res = await fetch(`${VPS_URL}/api/youtube/processed`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ ids: [], error: (err as Error).message }, { status: 502 });
  }
}
