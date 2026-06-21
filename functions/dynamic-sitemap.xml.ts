// Cloudflare Pages Function — Dynamic Sitemap
// Route: /dynamic-sitemap.xml

function encodePathSegment(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export const onRequest = async (_context: any) => {
  const SUPABASE_URL = 'https://kydmyxsgyxeubhmqzrgo.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZG15eHNneXhldWJobXF6cmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0ODQ3NjQsImV4cCI6MjA2MjA2MDc2NH0.b-ckDfOmmf2x__FG5Snm9px8j4pqPke5Ra1RgoGEqP0';

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'count=exact',
  };

  try {
    const urls: any[] = [];
    const existing = new Set<string>();

    const addUrl = (item: any) => {
      if (!existing.has(item.url)) {
        existing.add(item.url);
        urls.push(item);
      }
    };

    const staticPages = [
      { url: 'https://kotobi.xyz/', changefreq: 'daily', priority: 1.0 },
      { url: 'https://kotobi.xyz/categories', changefreq: 'weekly', priority: 0.9 },
      { url: 'https://kotobi.xyz/authors', changefreq: 'weekly', priority: 0.9 },
      { url: 'https://kotobi.xyz/quotes', changefreq: 'daily', priority: 0.8 },
      { url: 'https://kotobi.xyz/reading-clubs', changefreq: 'weekly', priority: 0.7 },
      { url: 'https://kotobi.xyz/suggestions', changefreq: 'weekly', priority: 0.7 },
      { url: 'https://kotobi.xyz/upload-book', changefreq: 'monthly', priority: 0.6 },
      { url: 'https://kotobi.xyz/about-us', changefreq: 'monthly', priority: 0.5 },
      { url: 'https://kotobi.xyz/contact-us', changefreq: 'monthly', priority: 0.5 },
      { url: 'https://kotobi.xyz/donation', changefreq: 'monthly', priority: 0.5 },
      { url: 'https://kotobi.xyz/site-updates', changefreq: 'weekly', priority: 0.5 },
      { url: 'https://kotobi.xyz/privacy-policy', changefreq: 'yearly', priority: 0.3 },
      { url: 'https://kotobi.xyz/terms-of-service', changefreq: 'yearly', priority: 0.3 },
    ];

    staticPages.forEach((page) => addUrl({ ...page, lastmod: new Date().toISOString() }));

    const limit = 1000;

    // Books
    let offset = 0;
    while (true) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/book_submissions?select=id,slug,reviewed_at,created_at&status=eq.approved&order=created_at.desc&offset=${offset}&limit=${limit}`,
        { headers }
      );
      if (!res.ok) break;
      const books = await res.json();
      for (const book of books) {
        const slug = book.slug || book.id;
        addUrl({
          url: `https://kotobi.xyz/book/${encodePathSegment(slug)}`,
          lastmod: book.reviewed_at || book.created_at || new Date().toISOString(),
          changefreq: 'monthly',
          priority: 0.8,
        });
      }
      if (books.length < limit) break;
      offset += limit;
    }

    // Authors
    offset = 0;
    while (true) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/authors?select=id,slug,name,created_at&order=created_at.desc&offset=${offset}&limit=${limit}`,
        { headers }
      );
      if (!res.ok) break;
      const authors = await res.json();
      for (const author of authors) {
        const authorPath = author.slug && author.slug.trim() !== '' ? author.slug : author.name;
        addUrl({
          url: `https://kotobi.xyz/author/${encodePathSegment(authorPath)}`,
          lastmod: author.created_at || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
      if (authors.length < limit) break;
      offset += limit;
    }

    // Users
    offset = 0;
    while (true) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,username,created_at,last_seen&order=created_at.desc&offset=${offset}&limit=${limit}`,
        { headers }
      );
      if (!res.ok) break;
      const users = await res.json();
      for (const user of users) {
        const identifier = user.username && user.username.trim() !== '' ? user.username : user.id;
        addUrl({
          url: `https://kotobi.xyz/user/${encodePathSegment(identifier)}`,
          lastmod: user.last_seen || user.created_at || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.6,
        });
      }
      if (users.length < limit) break;
      offset += limit;
    }

    // Categories
    offset = 0;
    while (true) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/categories?select=name,created_at&order=created_at.desc&offset=${offset}&limit=${limit}`,
        { headers }
      );
      if (!res.ok) break;
      const categories = await res.json();
      for (const cat of categories) {
        addUrl({
          url: `https://kotobi.xyz/category/${encodePathSegment(cat.name)}`,
          lastmod: cat.created_at || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
      if (categories.length < limit) break;
      offset += limit;
    }

    const sanitizeXmlValue = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u: any) => `  <url>
    <loc>${sanitizeXmlValue(u.url)}</loc>
    <lastmod>${new Date(u.lastmod || new Date()).toISOString()}</lastmod>
    <changefreq>${u.changefreq || 'weekly'}</changefreq>
    <priority>${u.priority || 0.5}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://kotobi.xyz/</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://kotobi.xyz/categories</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://kotobi.xyz/authors</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
</urlset>`;
    return new Response(fallback, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
};
