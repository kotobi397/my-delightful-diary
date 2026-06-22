// Background worker: pulls Arabic stories/texts from archive.org,
// downloads a cover image and the full text, splits it into chapters,
// and inserts them under a random AI bot account.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface Config {
  enabled: boolean;
  topics: string[]; // used as archive.org search queries
  chapters_per_story: number;
  stories_per_run: number;
  min_chapter_words: number;
  language: string;
  total_generated: number;
}

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  description?: string | string[];
  subject?: string | string[];
  language?: string | string[];
}

async function fetchWithTimeout(
  url: string,
  ms = 12000,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.join(' ');
  return typeof v === 'string' ? v : '';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

// Split text into N chapters at paragraph boundaries
function splitIntoChapters(text: string, n: number, minWords: number): string[] {
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];

  const totalWords = paragraphs.reduce((a, p) => a + wordCount(p), 0);
  const target = Math.max(minWords, Math.floor(totalWords / n));
  const chapters: string[] = [];
  let buf: string[] = [];
  let bufWords = 0;
  for (const p of paragraphs) {
    buf.push(p);
    bufWords += wordCount(p);
    if (bufWords >= target && chapters.length < n - 1) {
      chapters.push(buf.join('\n\n'));
      buf = [];
      bufWords = 0;
    }
  }
  if (buf.length > 0) chapters.push(buf.join('\n\n'));
  return chapters.filter((c) => wordCount(c) >= 50);
}

async function searchArchive(query: string, rows = 30): Promise<ArchiveDoc[]> {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    `(${query}) AND mediatype:texts AND language:(Arabic OR ara OR arabic)`,
  )}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=description&fl[]=subject&fl[]=language&sort[]=random&rows=${rows}&page=1&output=json`;
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) throw new Error(`archive search ${res.status}`);
  const json = await res.json();
  return (json?.response?.docs || []) as ArchiveDoc[];
}

// Get full text of an item via the _djvu.txt sibling (most archive.org text items have it)
async function fetchItemText(identifier: string): Promise<string | null> {
  // First try the metadata to find a text-like file
  const metaRes = await fetchWithTimeout(
    `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
    15000,
  );
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  const files: Array<{ name: string; format?: string }> = meta?.files || [];

  // Preferred text files
  const candidates = files
    .filter((f) => /\.(txt)$/i.test(f.name))
    .sort((a, b) => {
      const score = (n: string) =>
        /_djvu\.txt$/i.test(n) ? 0 : /_text\.txt$/i.test(n) ? 1 : 2;
      return score(a.name) - score(b.name);
    });
  if (candidates.length === 0) return null;

  const fileName = candidates[0].name;
  const textUrl = `https://archive.org/download/${encodeURIComponent(
    identifier,
  )}/${encodeURIComponent(fileName)}`;
  const txtRes = await fetchWithTimeout(textUrl, 30000);
  if (!txtRes.ok) return null;
  const text = await txtRes.text();
  return text && text.length > 500 ? text : null;
}

// Use Mistral AI to clean OCR/text artifacts and fix Arabic distortions
async function cleanWithMistral(raw: string): Promise<string> {
  const apiKey = Deno.env.get('MISTRAL_API_KEY');
  if (!apiKey) return raw;
  // Mistral has token limits; trim input to ~8k chars to keep one chapter safe
  const input = raw.length > 8000 ? raw.slice(0, 8000) : raw;
  try {
    const res = await fetchWithTimeout(
      'https://api.mistral.ai/v1/chat/completions',
      45000,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'أنت محرر لغوي عربي خبير. مهمتك تنظيف نص مأخوذ من OCR لـ Archive.org وإصلاح كل التشوهات: حروف ملصقة، أحرف لاتينية غريبة وسط الكلمات، فراغات زائدة، أرقام صفحات عشوائية، رموز غير مفهومة، أخطاء إملائية واضحة. لا تختصر القصة ولا تحذف فقرات، فقط أعد كتابتها بعربية فصحى سليمة ومضبوطة. أعد النص النظيف مباشرة بدون أي تعليق أو مقدمة.',
            },
            { role: 'user', content: input },
          ],
        }),
      },
    );
    if (!res.ok) {
      console.warn('mistral clean failed', res.status, await res.text().catch(() => ''));
      return raw;
    }
    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content;
    return typeof txt === 'string' && txt.trim().length > 100 ? txt.trim() : raw;
  } catch (e) {
    console.warn('mistral clean error', (e as Error).message);
    return raw;
  }
}

// Download archive.org cover and upload to Supabase storage; returns public URL
async function uploadCoverToStorage(
  supabase: any,
  identifier: string,
): Promise<string | null> {
  try {
    const srcUrl = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
    const res = await fetchWithTimeout(srcUrl, 20000);
    if (!res.ok) {
      console.warn('cover download failed', res.status);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg';
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 500) return null;
    const path = `archive-covers/${identifier}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('stories')
      .upload(path, buf, { contentType, upsert: true });
    if (upErr) {
      console.warn('cover upload error', upErr.message);
      return null;
    }
    const { data } = supabase.storage.from('stories').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn('cover upload exception', (e as Error).message);
    return null;
  }
}






// @ts-ignore - EdgeRuntime is provided by Supabase edge-runtime
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function runWorker(): Promise<{ ok: boolean; stories: number; chapters: number; errors: string[] } | { skipped: true; reason: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { data: cfgRow, error: cfgErr } = await supabase
      .from('auto_story_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    const cfg = (cfgRow || {}) as Config;

    if (!cfg.enabled) {
      return { skipped: true, reason: 'disabled' };
    }


    const topics =
      Array.isArray(cfg.topics) && cfg.topics.length > 0
        ? cfg.topics
        : ['قصة', 'حكاية', 'رواية قصيرة'];
    const chaptersPerStory = Math.max(1, Math.min(20, cfg.chapters_per_story || 5));
    const storiesPerRun = Math.max(1, Math.min(5, cfg.stories_per_run || 1));
    const minWords = Math.max(100, cfg.min_chapter_words || 350);
    const lang = cfg.language || 'ar';

    const { data: bots, error: botsErr } = await supabase
      .from('ai_bot_accounts')
      .select('profile_id, display_name')
      .limit(200);
    if (botsErr) throw botsErr;
    if (!bots || bots.length === 0) throw new Error('لا يوجد حسابات بوت AI متاحة');

    // Existing identifiers we already imported (avoid duplicates by title prefix tag)
    const { data: existing } = await supabase
      .from('user_stories')
      .select('description')
      .ilike('description', 'archive_id:%')
      .limit(2000);
    const knownIds = new Set<string>(
      (existing || [])
        .map((r: any) =>
          ((r.description as string) || '').split('\n')[0].replace(/^archive_id:\s*/i, '').trim(),
        )
        .filter(Boolean),
    );

    let createdStories = 0;
    let createdChapters = 0;
    const errors: string[] = [];

    for (let s = 0; s < storiesPerRun; s++) {
      try {
        const query = pick(topics);
        const docs = await searchArchive(query, 40);
        if (docs.length === 0) {
          errors.push(`لا نتائج لـ "${query}"`);
          continue;
        }

        // Pick first not-yet-imported item that has usable text
        let imported = false;
        for (const doc of docs.sort(() => Math.random() - 0.5)) {
          if (!doc.identifier || knownIds.has(doc.identifier)) continue;

          const text = await fetchItemText(doc.identifier).catch(() => null);
          if (!text) continue;

          const chapters = splitIntoChapters(text, chaptersPerStory, minWords);
          if (chapters.length === 0) continue;

          const title = (asText(doc.title) || `قصة من Archive.org`).slice(0, 200);
          const author = asText(doc.creator).slice(0, 100);
          const summary = asText(doc.description).replace(/<[^>]+>/g, ' ').slice(0, 800);
          const subject = asText(doc.subject).slice(0, 100);
          const coverUrl = `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`;
          const bot = pick(bots);

          const description = [
            `archive_id: ${doc.identifier}`,
            author ? `المؤلف الأصلي: ${author}` : '',
            summary,
          ]
            .filter(Boolean)
            .join('\n');

          const { data: story, error: storyErr } = await supabase
            .from('user_stories')
            .insert({
              author_id: bot.profile_id,
              title,
              description,
              cover_url: coverUrl,
              category: subject || 'قصة',
              language: lang,
              status: 'published',
              is_public: true,
            })
            .select('id')
            .single();
          if (storyErr) {
            errors.push(`insert story: ${storyErr.message}`);
            continue;
          }
          createdStories++;
          knownIds.add(doc.identifier);

          for (let i = 0; i < chapters.length; i++) {
            const cleaned = await cleanWithMistral(chapters[i]);
            const { error: chErr } = await supabase.from('story_chapters').insert({
              story_id: story.id,
              chapter_number: i + 1,
              title: `الفصل ${i + 1}`,
              content: cleaned,
              is_published: true,
              published_at: new Date().toISOString(),
              word_count: wordCount(cleaned),
            });
            if (chErr) {
              errors.push(`chapter ${i + 1}: ${chErr.message}`);
            } else {
              createdChapters++;
            }
          }

          imported = true;
          break;
        }

        if (!imported) errors.push(`لم يتم العثور على عنصر صالح لـ "${query}"`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    await supabase
      .from('auto_story_config')
      .update({
        total_generated: (cfg.total_generated || 0) + createdStories,
        last_run_at: new Date().toISOString(),
        last_status: `أُضيفت ${createdStories} قصة (${createdChapters} فصل) من Archive.org`,
        last_error: errors.length ? errors.join(' | ').slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return { ok: true, stories: createdStories, chapters: createdChapters, errors };
  } catch (e) {
    await supabase
      .from('auto_story_config')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'فشل',
        last_error: (e as Error).message.slice(0, 500),
      })
      .eq('id', 1);
    return { ok: false, stories: 0, chapters: 0, errors: [(e as Error).message] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Run in background so the request returns immediately;
  // Mistral cleanup of multiple chapters can take >60s.
  const task = runWorker().catch((e) => console.error('worker error', e));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(task);
  }

  return new Response(
    JSON.stringify({ started: true, message: 'يتم التوليد في الخلفية، تابع الحالة من لوحة الإدارة.' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

