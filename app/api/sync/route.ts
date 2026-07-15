import { NextResponse } from 'next/server';
import { vpsPost } from '@/lib/vps';

// POST /api/sync -> triggers an on-demand YouTube + Gmail check on the VPS.
// Called when the app opens and by the "Sync now" button. There is no
// background poll, so this is the only thing that detects new likes/emails.
export async function POST() {
  try {
    const data = await vpsPost('/api/sync', {});
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
