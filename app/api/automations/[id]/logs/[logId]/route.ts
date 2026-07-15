import { NextRequest, NextResponse } from 'next/server';
import { vpsDelete } from '@/lib/vps';

// DELETE /api/automations/:id/logs/:logId -> remove a single execution log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const { id, logId } = await params;
  try {
    const data = await vpsDelete(`/api/automations/${id}/logs/${logId}`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
