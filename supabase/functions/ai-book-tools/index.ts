// AI book tools — pay-per-use AI features for books
// Charges coins via gam_spend_coins RPC before calling Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "summary" | "chapter_summary" | "quotes" | "similar" | "ask" | "coach" | "reading_time" | "characters";

const PRICES: Record<Action, number> = {
  summary: 30,
  chapter_summary: 15,
  quotes: 20,
  similar: 10,
  ask: 5,
  coach: 25,
  reading_time: 10,
  characters: 40,
};


function sampleText(text: string, maxChars = 18000): string {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  // Take 4 spread-out chunks to cover beginning, middle, end
  const chunks = 4;
  const size = Math.floor(maxChars / chunks);
  const step = Math.floor(cleaned.length / (chunks + 1));
  const parts: string[] = [];
  for (let i = 1; i <= chunks; i++) {
    parts.push(cleaned.slice(step * i, step * i + size));
  }
  return parts.join("\n[...]\n");
}

function buildPrompt(action: Action, book: any, bookText: string, extra: { chapter?: string; question?: string; goals?: string }) {
  const pageInfo = book.page_count ? `\nعدد الصفحات: ${book.page_count}` : "";
  const langInfo = book.language ? `\nاللغة: ${book.language}` : "";
  const meta = `الكتاب: "${book.title}"\nالمؤلف: ${book.author ?? "غير معروف"}\nالتصنيف: ${book.category ?? "—"}${langInfo}${pageInfo}`;
  const textBlock = bookText
    ? `\n\n--- نص الكتاب (مقتطفات من المحتوى الفعلي) ---\n${sampleText(bookText)}\n--- نهاية النص ---`
    : `\n\n(ملاحظة: نص الكتاب غير متوفر، اعتمد على البيانات الوصفية)\nالوصف: ${book.description ?? "—"}`;

  switch (action) {
    case "summary":
      return `${meta}${textBlock}\n\nاكتب ملخصاً شاملاً وواضحاً للكتاب بالعربية الفصحى في حدود 400 كلمة، يشمل الفكرة الرئيسية والمحاور والخلاصة. اعتمد حصراً على النص أعلاه ولا تخترع معلومات.`;
    case "chapter_summary":
      return `${meta}${textBlock}\n\nالفصل المطلوب تلخيصه: ${extra.chapter || "غير محدد"}\n\nابحث في النص أعلاه عن هذا الفصل وقدّم ملخصاً مركّزاً له بالعربية في حدود 300 كلمة. إن لم تجده بوضوح فاذكر ذلك صراحةً وقدّم ملخصاً للأقرب موضوعياً من النص.`;
    case "quotes":
      return `${meta}${textBlock}\n\nاستخرج 5 إلى 8 من أبلغ وأهم الاقتباسات من النص أعلاه فقط، حرفياً كما وردت، بالعربية، مرقّمة وبدون شرح إضافي. لا تخترع اقتباسات.`;
    case "similar":
      return `${meta}${textBlock}\n\nبناءً على محتوى النص أعلاه، اقترح 5 كتب مشابهة في الموضوع أو الأسلوب أو الفكرة، مع جملة قصيرة عن كل كتاب توضح سبب التشابه. الصيغة: قائمة مرقّمة بالعنوان والمؤلف ثم الجملة.`;
    case "ask":
      return `${meta}${textBlock}\n\nسؤال المستخدم: ${extra.question}\n\nأجب بدقة وباختصار بالعربية الفصحى مستنداً حصراً إلى النص أعلاه. إن لم تجد الإجابة في النص فاذكر ذلك صراحةً.`;
    case "coach":
      return `${meta}${textBlock}\n\nأهداف المستخدم ومستواه ووقته المتاح:\n${extra.goals}\n\nأنت مدرب قراءة شخصي. ضع خطة قراءة عملية ومخصّصة لهذا الكتاب تناسب أهداف المستخدم ومستواه ووقته اليومي. اعتمد على بنية النص أعلاه (الفصول/المحاور الفعلية) لتقسيم الخطة. قدّم:\n1) نظرة عامة موجزة عن الكتاب وملاءمته لأهداف المستخدم.\n2) جدول قراءة يومي/أسبوعي مع عدد الصفحات أو الأقسام لكل جلسة ومدة كل جلسة.\n3) أهداف تعلّم محددة لكل مرحلة (ماذا يفهم أو يطبّق بعدها).\n4) أسئلة تأمّل قصيرة بعد كل مرحلة لتثبيت الفهم.\n5) نصائح للتركيز وتجاوز الفصول الصعبة في هذا الكتاب تحديداً.\n6) ملخص ختامي ومؤشرات نجاح الخطة.\n\nاكتب بالعربية الفصحى بصياغة منظمة بعناوين ونقاط، وكن واقعياً ومحدّداً بأرقام ومدد.`;
    case "characters":
      return `${meta}${textBlock}\n\nأنت ناقد أدبي خبير. قدّم تحليلاً معمّقاً لشخصيات هذا العمل بالعربية الفصحى، اعتماداً حصراً على النص أعلاه ولا تخترع شخصيات. نظّم الإجابة بهذه الأقسام بعناوين واضحة (##):\n\n## 👥 الشخصيات الرئيسية\nلكل شخصية: الاسم، الدور في العمل، السمات النفسية والاجتماعية، الدوافع، نقاط القوة والضعف (في حدود فقرة لكل شخصية).\n\n## 🔗 العلاقات بين الشخصيات\nاشرح طبيعة العلاقات (صداقة، عداء، حب، صراع، سلطة...) وكيف تتقاطع وتؤثر في مجرى الأحداث. اذكر كل علاقة بصيغة: "س ↔ ص: ..." .\n\n## 🌱 تطور كل شخصية\nلكل شخصية رئيسية: كيف بدأت في العمل، نقاط التحوّل الأساسية، وكيف انتهت. ركّز على التطور النفسي والأخلاقي.\n\n## 🧠 خلاصة تحليلية\nفقرة قصيرة عن الرسالة التي يحملها بناء الشخصيات في هذا العمل.\n\nإن لم يكن العمل رواية أو لم تتوفر شخصيات واضحة في النص، اذكر ذلك صراحةً واقترح على القارئ تجربة ميزات أخرى.`;
    case "reading_time":

      return `${meta}${textBlock}\n\nمهمتك: تقدير مدة القراءة المتوقعة لهذا الكتاب بدقّة عالية بالعربية.

اعتمد منهجية واضحة:
1) قدّر إجمالي عدد الكلمات في الكتاب:
   - إن توفّر نص فعلي أعلاه، استخدمه لقياس متوسط عدد الكلمات في الصفحة (عبر العيّنات) ثم اضربه في عدد الصفحات.
   - إن لم يتوفّر نص، استخدم متوسطات قياسية حسب اللغة والتصنيف (مثلاً للعربية الفصحى ~250 كلمة/صفحة، للروايات ~300، للكتب الأكاديمية ~350) وعدد الصفحات المعطى.
2) احسب الوقت لثلاث سرعات قراءة بالعربية:
   - قارئ بطيء: ~150 كلمة/دقيقة
   - قارئ متوسط: ~220 كلمة/دقيقة
   - قارئ سريع: ~300 كلمة/دقيقة
   عدّل هذه السرعات حسب صعوبة المحتوى (علمي/فلسفي = أبطأ، روائي = أسرع).
3) قدّم النتيجة منظّمة:
   - تقدير إجمالي الكلمات (مع الطريقة المستخدمة).
   - جدول: السرعة → الوقت الإجمالي (ساعات ودقائق).
   - خطة عملية مقترحة: مثلاً "30 دقيقة يومياً" → عدد الأيام لإنهائه، "ساعة يومياً" → عدد الأيام.
   - ملاحظة قصيرة عن صعوبة الكتاب وكيف تؤثر على التقدير.

كن دقيقاً ومحدّداً بالأرقام، واذكر الفرضيات بوضوح. اكتب بالعربية الفصحى بصياغة منظّمة بعناوين ونقاط.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { action, bookId, chapter, question, goals } = await req.json() as {
      action: Action; bookId: string; chapter?: string; question?: string; goals?: string;
    };

    if (!action || !(action in PRICES)) {
      return new Response(JSON.stringify({ error: "invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "ask" && !question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "chapter_summary" && !chapter?.trim()) {
      return new Response(JSON.stringify({ error: "chapter required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "coach" && !goals?.trim()) {
      return new Response(JSON.stringify({ error: "goals required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch book details
    const { data: book, error: bookErr } = await supabase
      .from("approved_books")
      .select("id,title,author,category,description,page_count,language")
      .eq("id", bookId)
      .maybeSingle();
    if (bookErr || !book) {
      return new Response(JSON.stringify({ error: "book not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch extracted book text (may be unavailable for some books)
    const { data: textRow } = await supabase
      .from("book_extracted_text")
      .select("extracted_text, extraction_status")
      .eq("book_id", bookId)
      .maybeSingle();
    const bookText =
      textRow?.extraction_status === "completed" && textRow.extracted_text && textRow.extracted_text.length > 200
        ? textRow.extracted_text
        : "";

    // Charge coins (only after we know book exists)
    const { data: spendData, error: spendErr } = await supabase.rpc("gam_spend_coins", {
      _amount: PRICES[action],
      _reason: `ai_${action}:${bookId}`,
    });
    if (spendErr) {
      return new Response(JSON.stringify({ error: spendErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const spent = spendData as { success: boolean; reason?: string; balance?: number; required?: number; new_balance?: number };
    if (!spent?.success) {
      const status = spent?.reason === "insufficient_coins" ? 402 : 400;
      return new Response(JSON.stringify({ error: spent?.reason ?? "spend_failed", balance: spent?.balance, required: spent?.required }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(action, book, bookText, { chapter, question, goals });

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    const useMistral = action === "reading_time" && !!MISTRAL_API_KEY;

    const aiResp = useMistral
      ? await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "mistral-large-latest",
            messages: [
              { role: "system", content: "أنت مساعد ذكي متخصص في الكتب العربية. أجب بالعربية الفصحى بأسلوب واضح ومنظم ودقيق بالأرقام." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
          }),
        })
      : await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "أنت مساعد ذكي متخصص في الكتب العربية. أجب بالعربية الفصحى بأسلوب واضح ومنظم." },
              { role: "user", content: prompt },
            ],
          }),
        });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "تم تجاوز حد الطلبات، حاول لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "ai_credits", message: "نفدت أرصدة الذكاء الاصطناعي، تواصل مع الإدارة" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "ai_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({
      content,
      coins_spent: PRICES[action],
      new_balance: spent.new_balance,
      used_book_text: !!bookText,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-book-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
