// Background worker: generates multi-chapter stories using Mistral AI
// and assigns them to random AI bot accounts. Runs from cron every 30 min.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface Config {
  enabled: boolean;
  topics: string[];
  chapters_per_story: number;
  stories_per_run: number;
  min_chapter_words: number;
  model: string;
  language: string;
  total_generated: number;
}

async function mistralJson(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  responseFormat: 'json_object' | 'text' = 'text',
): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85,
      max_tokens: 4000,
      ...(responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mistral ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');

  if (!MISTRAL_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'MISTRAL_API_KEY missing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

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
      return new Response(
        JSON.stringify({ skipped: true, reason: 'disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const topics: string[] =
      Array.isArray(cfg.topics) && cfg.topics.length > 0
        ? cfg.topics
        : ['قصة قصيرة'];
    const chaptersPerStory = Math.max(1, Math.min(20, cfg.chapters_per_story || 5));
    const storiesPerRun = Math.max(1, Math.min(5, cfg.stories_per_run || 1));
    const minWords = Math.max(100, cfg.min_chapter_words || 350);
    const model = cfg.model || 'mistral-small-latest';
    const lang = cfg.language || 'ar';

    // Get pool of active AI bots
    const { data: bots, error: botsErr } = await supabase
      .from('ai_bot_accounts')
      .select('profile_id, display_name')
      .limit(200);
    if (botsErr) throw botsErr;
    if (!bots || bots.length === 0) {
      throw new Error('لا يوجد حسابات بوت AI متاحة');
    }

    let createdStories = 0;
    let createdChapters = 0;
    const errors: string[] = [];

    for (let s = 0; s < storiesPerRun; s++) {
      try {
        const topic = pick(topics);
        const bot = pick(bots);

        // 1) outline + metadata
        const planRaw = await mistralJson(
          MISTRAL_API_KEY,
          model,
          [
            {
              role: 'system',
              content:
                'أنت كاتب روائي محترف. أعِد دائمًا JSON صالحًا فقط دون أي شرح خارج JSON.',
            },
            {
              role: 'user',
              content: `اقترح رواية قصيرة باللغة ${lang === 'ar' ? 'العربية الفصحى' : lang} حول الموضوع التالي: "${topic}".
أعِد JSON بالشكل:
{
  "title": "عنوان جذاب وقصير",
  "description": "ملخص في 2-3 جمل بدون حرق الأحداث",
  "category": "تصنيف عام (مثل: رواية، مغامرة، رومانسي، خيال علمي، تاريخي، فلسفي)",
  "chapters": [
    { "number": 1, "title": "عنوان الفصل", "summary": "ملخص قصير لما يحدث" }
  ]
}
عدد الفصول يجب أن يكون بالضبط ${chaptersPerStory}.`,
            },
          ],
          'json_object',
        );

        let plan: any;
        try {
          plan = JSON.parse(planRaw);
        } catch {
          // try to extract JSON block
          const m = planRaw.match(/\{[\s\S]*\}/);
          plan = m ? JSON.parse(m[0]) : null;
        }
        if (!plan?.title || !Array.isArray(plan?.chapters)) {
          throw new Error('خطة الرواية غير صالحة');
        }

        // 2) create story row
        const { data: story, error: storyErr } = await supabase
          .from('user_stories')
          .insert({
            author_id: bot.profile_id,
            title: String(plan.title).slice(0, 200),
            description: plan.description ? String(plan.description).slice(0, 1000) : null,
            category: plan.category ? String(plan.category).slice(0, 100) : null,
            language: lang,
            status: 'published',
            is_public: true,
          })
          .select('id')
          .single();
        if (storyErr) throw storyErr;
        createdStories++;

        // 3) generate each chapter content
        for (let i = 0; i < Math.min(chaptersPerStory, plan.chapters.length); i++) {
          const ch = plan.chapters[i];
          const chNumber = ch?.number || i + 1;
          const chTitle = (ch?.title || `الفصل ${chNumber}`).toString().slice(0, 200);
          const chSummary = ch?.summary ? String(ch.summary) : '';

          try {
            const content = await mistralJson(
              MISTRAL_API_KEY,
              model,
              [
                {
                  role: 'system',
                  content:
                    'أنت كاتب روائي محترف يكتب فصولًا متماسكة بأسلوب أدبي راقي. اكتب نصًا سرديًا فقط دون عناوين أو ترقيم.',
                },
                {
                  role: 'user',
                  content: `اكتب الفصل رقم ${chNumber} بعنوان "${chTitle}" من رواية "${plan.title}".
موضوع الرواية: ${topic}
ملخص الفصل: ${chSummary}
المطلوب:
- على الأقل ${minWords} كلمة.
- نص أدبي سردي متدفق باللغة ${lang === 'ar' ? 'العربية الفصحى' : lang}.
- بدون عنوان أو ترقيم في البداية، النص فقط.
- اربط الأحداث بطريقة طبيعية مع الفصول السابقة.`,
                },
              ],
              'text',
            );
            const cleaned = content.trim();
            await supabase.from('story_chapters').insert({
              story_id: story.id,
              chapter_number: chNumber,
              title: chTitle,
              content: cleaned,
              is_published: true,
              published_at: new Date().toISOString(),
              word_count: wordCount(cleaned),
            });
            createdChapters++;
          } catch (e) {
            errors.push(`فصل ${chNumber}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }

    await supabase
      .from('auto_story_config')
      .update({
        total_generated: (cfg.total_generated || 0) + createdStories,
        last_run_at: new Date().toISOString(),
        last_status: `أُنشئت ${createdStories} قصة (${createdChapters} فصل)`,
        last_error: errors.length ? errors.join(' | ').slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return new Response(
      JSON.stringify({
        ok: true,
        stories: createdStories,
        chapters: createdChapters,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    await supabase
      .from('auto_story_config')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'فشل',
        last_error: (e as Error).message.slice(0, 500),
      })
      .eq('id', 1);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
