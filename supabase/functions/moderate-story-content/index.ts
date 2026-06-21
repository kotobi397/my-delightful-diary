import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * فحص محتوى القصص (صورة أو إطار من فيديو) باستخدام Mistral Pixtral (vision)
 * - يرفض المحتوى المخل بالحياء
 * - يرفض المحتوى غير المتعلق بالكتب / القراءة / الأدب
 *
 * المدخلات:
 *   image_data_url: data:image/jpeg;base64,...
 *   caption?: string
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!mistralApiKey) {
      // لا نوقف النشر إذا لم يُضبط المفتاح — نسمح ونسجل تنبيهاً
      console.warn("MISTRAL_API_KEY غير مضبوط — سيتم تخطي فحص القصة");
      return new Response(
        JSON.stringify({ allowed: true, skipped: true, reason: "moderation_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { image_data_url, caption } = await req.json();

    if (!image_data_url || typeof image_data_url !== "string" || !image_data_url.startsWith("data:image/")) {
      return new Response(
        JSON.stringify({ allowed: false, reason: "image_required", message: "صورة المعاينة مطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeCaption = (caption || "").toString().slice(0, 500);

    const prompt = `أنت مشرف محتوى لمنصة كتب عربية اسمها "kotobi". مهمتك تحليل صورة قصة (Story) قبل نشرها.

يجب رفض الصورة في الحالات التالية:
1) أي محتوى مخل بالحياء: عُري كامل أو جزئي، إيحاءات جنسية، ملابس فاضحة، مشاهد حميمية.
2) عنف صريح أو دموي، تخويف، أو محتوى صادم.
3) رموز كراهية، إساءة دينية، أو محتوى مسيء.
4) دعاية أو إعلانات لمنتجات غير متعلقة بالكتب.
5) محتوى لا علاقة له إطلاقاً بالكتب أو القراءة أو الأدب أو الكتّاب أو الاقتباسات أو المكتبات (مثل: سيلفي شخصي، طعام، سيارات، رياضة، حيوانات أليفة، مشاهد عشوائية).

اقبل الصورة فقط إذا كانت تتعلق بالكتب: صور كتب، أغلفة، اقتباسات مكتوبة، رفوف مكتبة، قارئ يقرأ كتاباً، خط عربي/أدبي، صور تخص الكتّاب، أو محتوى أدبي/ثقافي واضح.

التعليق المرفق مع القصة (للسياق فقط، لا يكفي وحده):
"""${safeCaption}"""

أجب بتنسيق JSON فقط بهذا الشكل:
{
  "allowed": true|false,
  "is_book_related": true|false,
  "is_inappropriate": true|false,
  "severity": "low|medium|high|critical",
  "reason_code": "ok|not_book_related|inappropriate|violence|hate|spam|other",
  "message": "رسالة قصيرة للمستخدم بالعربية تشرح سبب الرفض، أو 'مقبول' عند القبول"
}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mistralApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "pixtral-large-latest",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: image_data_url },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mistral Pixtral error:", response.status, errText);
      // في حالة فشل الـAI نسمح بالنشر حتى لا نوقف الخدمة
      return new Response(
        JSON.stringify({ allowed: true, skipped: true, reason: "ai_unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { allowed: true, skipped: true, reason: "parse_failed" };
    }

    const allowed = parsed.allowed === true && parsed.is_inappropriate !== true;

    return new Response(
      JSON.stringify({
        allowed,
        is_book_related: !!parsed.is_book_related,
        is_inappropriate: !!parsed.is_inappropriate,
        severity: parsed.severity || "low",
        reason_code: parsed.reason_code || (allowed ? "ok" : "other"),
        message: parsed.message || (allowed ? "مقبول" : "تم رفض القصة"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("moderate-story-content error:", error);
    // في حالة الخطأ نسمح حتى لا نوقف الخدمة
    return new Response(
      JSON.stringify({ allowed: true, skipped: true, reason: "error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});