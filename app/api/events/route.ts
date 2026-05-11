const VPS_URL = process.env.VPS_URL || 'http://45.79.212.154:3009';

export async function GET() {
  const upstream = await fetch(`${VPS_URL}/api/events`, {
    headers: { Accept: 'text/event-stream' },
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
