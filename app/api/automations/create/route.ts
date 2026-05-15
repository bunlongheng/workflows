import { NextRequest, NextResponse } from 'next/server';
import { vpsPost } from '@/lib/vps';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await vpsPost('/api/automations', body);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
