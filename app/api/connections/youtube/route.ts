import { NextResponse } from 'next/server';

// In production: revoke token and delete from database
export async function DELETE() {
  return NextResponse.json({ success: true, message: 'YouTube disconnected' });
}
