// Generate a quiz from a book's extracted text using Mistral Large.
// Supports three quiz types: qcm (MCQ), true_false, open.
// Caches results in book_quizzes (keyed by book_id + difficulty + count + type).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUIZ_PRICE = 30;


const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";

type Difficulty = "easy" | "medium" | "hard";
type QuizType = "qcm" | "true_false" | "open";

interface Question {
  type: QuizType;
  question: string;
  options?: string[];           // qcm: 4 options ; true_false: ["صح","خطأ"]
  correct_index?: number;       // qcm / true_false
  expected_answer?: string;     // open
  key_points?: string[];        // open (for self-grading)
  explanation?: string;
}

function sample(text: string, totalChars = 14000): string {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= totalChars) return cleaned;
  const chunks = 4;
  const size = Math.floor(totalChars / chunks);
  const step = Math.floor(cleaned.length / (chunks + 1));
  const parts: string[] = [];
  for (let i = 1; i <= chunks; i++) {
    const start = step * i;
    parts.push(cleaned.slice(start, start + size));
  }
  return parts.join("\n---\n");
}

function buildPrompt(quizType: QuizType, difficulty: Difficulty, count: number, bookTitle: string, bookAuthor: string, text: string) {
  const difficultyAr =
    difficulty === "easy" ? "سهل (أسئلة مباشرة)" :
    difficulty === "hard" ? "صعب (يتطلب فهم عميق وربط بين الأفكار)" :
    "متوسط (فهم جيد للأفكار الرئيسية)";

  const header = `كتاب: "${bookTitle}" — المؤلف: ${bookAuthor}\nالمستوى: ${difficultyAr}\nعدد الأسئلة: ${count}\nاللغة: العربية الفصحى البسيطة.\nاعتمد حصراً على النص أدناه ولا تختلق معلومات.\nممنوع تكرار الأسئلة.`;

  let task = "";
  let schema = "";

  if (quizType === "qcm") {
    task = `أنشئ ${count} سؤال اختيار من متعدد. كل سؤال له 4 خيارات نصية مختلفة وواضحة، وخيار واحد فقط صحيح. أضف تفسيراً قصيراً (جملة واحدة).`;
    schema = `{"questions":[{"type":"qcm","question":"...","options":["أ","ب","ج","د"],"correct_index":0,"explanation":"..."}]}`;
  } else if (quizType === "true_false") {
    task = `أنشئ ${count} عبارة من نوع "صح أو خطأ". لكل عبارة correct_index=0 إذا صحيحة و1 إذا خاطئة. أضف تفسيراً قصيراً.`;
    schema = `{"questions":[{"type":"true_false","question":"العبارة...","options":["صح","خطأ"],"correct_index":0,"explanation":"..."}]}`;
  } else {
    task = `أنشئ ${count} سؤالاً مفتوحاً يستدعي إجابة مكتوبة من القارئ. لكل سؤال: expected_answer (إجابة نموذجية موجزة 1-3 جمل) و key_points (3 نقاط رئيسية يجب ذكرها) وتفسير قصير.`;
    schema = `{"questions":[{"type":"open","question":"...","expected_answer":"...","key_points":["...","...","..."],"explanation":"..."}]}`;
  }

  return `${header}\n\n${task}\n\nأعد JSON صالحاً بهذه الصيغة فقط:\n${schema}\n\nالنص:\n${sample(text)}`;
}

function validate(qs: any[], quizType: QuizType, count: number): Question[] {
  const filtered = (qs || []).filter((q) => {
    if (!q || typeof q.question !== "string") return false;
    if (quizType === "qcm") {
      return Array.isArray(q.options) && q.options.length === 4 &&
        Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3;
    }
    if (quizType === "true_false") {
      return Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 1;
    }
    return typeof q.expected_answer === "string" && q.expected_answer.length > 0;
  });
  return filtered.slice(0, count).map((q) => ({
    ...q,
    type: quizType,
    options: quizType === "true_false" ? ["صح", "خطأ"] : q.options,
  }));
}

async function generateQuiz(
  apiKey: string,
  bookTitle: string,
  bookAuthor: string,
  text: string,
  difficulty: Difficulty,
  count: number,
  quizType: QuizType,
): Promise<Question[]> {
  const prompt = buildPrompt(quizType, difficulty, count, bookTitle, bookAuthor, text);

  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: "system", content: "أنت مولِّد اختبارات تعليمية دقيق. تعيد JSON فقط دون أي شرح خارجي." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mistral ${res.status}: ${t}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return validate(Array.isArray(parsed.questions) ? parsed.questions : [], quizType, count);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bookId, difficulty = "medium", questionCount = 10, quizType = "qcm", forceRefresh = false } =
      await req.json() as { bookId: string; difficulty?: Difficulty; questionCount?: number; quizType?: QuizType; forceRefresh?: boolean };

    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      return new Response(JSON.stringify({ error: "MISTRAL_API_KEY غير مُهيأ" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "يجب تسجيل الدخول" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const count = Math.min(Math.max(Number(questionCount) || 10, 3), 20);
    const diff: Difficulty = (["easy", "medium", "hard"] as const).includes(difficulty as Difficulty)
      ? difficulty as Difficulty : "medium";
    const qType: QuizType = (["qcm", "true_false", "open"] as const).includes(quizType as QuizType)
      ? quizType as QuizType : "qcm";

    // Cache lookup — cached quizzes are free
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("book_quizzes")
        .select("id, questions")
        .eq("book_id", bookId)
        .eq("difficulty", diff)
        .eq("question_count", count)
        .eq("quiz_type", qType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.questions) {
        return new Response(JSON.stringify({ quizId: cached.id, questions: cached.questions, quizType: qType, cached: true, coins_spent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    // Fetch book + text
    const [{ data: book }, { data: textRow }] = await Promise.all([
      supabase.from("book_submissions").select("title, author").eq("id", bookId).maybeSingle(),
      supabase.from("book_extracted_text").select("extracted_text, extraction_status").eq("book_id", bookId).maybeSingle(),
    ]);

    if (!textRow?.extracted_text || textRow.extraction_status !== "completed" || textRow.extracted_text.length < 500) {
      return new Response(JSON.stringify({ error: "نص الكتاب غير متوفر لتوليد اختبار" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Charge coins for new generation
    const { data: spendData, error: spendErr } = await userClient.rpc("gam_spend_coins", {
      _amount: QUIZ_PRICE,
      _reason: `quiz_${qType}:${bookId}`,
    });
    if (spendErr) {
      return new Response(JSON.stringify({ error: spendErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const spent = spendData as { success: boolean; reason?: string; balance?: number; required?: number; new_balance?: number };
    if (!spent?.success) {
      const status = spent?.reason === "insufficient_coins" ? 402 : 400;
      return new Response(JSON.stringify({
        error: spent?.reason === "insufficient_coins"
          ? `رصيدك ${spent?.balance ?? 0} عملة، تحتاج ${QUIZ_PRICE} عملة لتوليد اختبار جديد`
          : (spent?.reason ?? "spend_failed"),
        balance: spent?.balance, required: spent?.required,
      }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const questions = await generateQuiz(
      MISTRAL_API_KEY,
      book?.title ?? "كتاب",
      book?.author ?? "—",
      textRow.extracted_text,
      diff,
      count,
      qType,
    );

    if (questions.length === 0) {
      return new Response(JSON.stringify({ error: "تعذر توليد أسئلة" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted } = await supabase
      .from("book_quizzes")
      .insert({ book_id: bookId, difficulty: diff, question_count: count, quiz_type: qType, questions })
      .select("id")
      .single();

    return new Response(JSON.stringify({
      quizId: inserted?.id, questions, quizType: qType, cached: false,
      coins_spent: QUIZ_PRICE, new_balance: spent.new_balance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-book-quiz error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
