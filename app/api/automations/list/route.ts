import { NextResponse } from 'next/server';
import { vpsGet } from '@/lib/vps';

export async function GET() {
  try {
    const data = await vpsGet('/api/automations/list');
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ automations: [], error: (err as Error).message }, { status: 502 });
  }
}
