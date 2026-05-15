import { NextResponse } from 'next/server';
import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

export async function GET() {
  try {
    const res = await fetch(`${VPS_URL}/api/youtube/processed`, { cache: 'no-store', headers: vpsAuthHeaders() });
    if (!res.ok) throw new Error(`VPS: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ ids: [], error: (err as Error).message }, { status: 502 });
  }
}
