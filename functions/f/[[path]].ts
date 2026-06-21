// Cloudflare Pages Function — File (PDF) CDN proxy
// Route: /f/<bucket>/<path>

export const onRequest = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);
  const originalPath = url.pathname;

  const parts = originalPath.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'f') {
    return new Response(JSON.stringify({ error: 'Invalid path. Use /f/<bucket>/<path>' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }

  const bucket = parts[1];
  const filePath = parts.slice(2).join('/');

  const etagSource = `${bucket}/${filePath}`;
  const etag = `"file-${await hashString(etagSource)}"`;

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        'cache-control': 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*',
      },
    });
  }

  const supabaseBase = 'https://kydmyxsgyxeubhmqzrgo.supabase.co/storage/v1/object/public';
  const targetUrl = `${supabaseBase}/${bucket}/${filePath}${url.search}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: { accept: request.headers.get('accept') || '*/*' },
      cf: { cacheTtl: 31536000, cacheEverything: true },
    } as any);

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: upstream.status,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('cdn-cache-control', 'public, max-age=31536000, immutable');
    headers.set('etag', etag);
    headers.set('access-control-allow-origin', '*');
    headers.set('x-cdn-status', 'hit');

    if (upstream.headers.get('accept-ranges')) {
      headers.set('accept-ranges', 'bytes');
    }

    return new Response(upstream.body, { status: 200, headers });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'CDN proxy failure', message: err?.message || 'unknown' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      }
    );
  }
};

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
