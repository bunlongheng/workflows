import { NextRequest, NextResponse } from 'next/server';
import { vpsDelete } from '@/lib/vps';

// DELETE /api/automations/:id/logs        -> clear all logs
// DELETE /api/automations/:id/logs?result=failed -> clear only failed logs
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = request.nextUrl.searchParams.get('result');
  const suffix = result === 'failed' ? '?result=failed' : '';
  try {
    const data = await vpsDelete(`/api/automations/${id}/logs${suffix}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
