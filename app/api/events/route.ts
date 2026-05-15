import { VPS_URL, vpsAuthHeaders } from '@/lib/vps';

export async function GET() {
  const upstream = await fetch(`${VPS_URL}/api/events`, {
    headers: { Accept: 'text/event-stream', ...vpsAuthHeaders() },
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
