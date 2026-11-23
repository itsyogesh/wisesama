/** Public feed alias; the canonical API owns XML generation. */
export async function GET(request: Request) {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  try {
    const upstream = await fetch(`${base}/api/v1/intel/feed.xml${new URL(request.url).search}`, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!upstream.ok)
      return new Response('The feed is temporarily unavailable. Please try again.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    return new Response(await upstream.text(), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('The feed is temporarily unavailable. Please try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
