import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MISTRAL_API = "https://api.mistral.ai/v1";

async function fetchFileAsBase64(fileId: string, apiKey: string): Promise<string | null> {
  const r = await fetch(`${MISTRAL_API}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    console.error("file fetch failed", r.status, await r.text());
    return null;
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("MISTRAL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "MISTRAL_API_KEY غير متوفر" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, title, bookType, author } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(JSON.stringify({ error: "الرجاء كتابة وصف للغلاف" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Design a professional, high-quality vertical book cover background (2:3 portrait ratio), print-ready.
Artistic description: ${description}.
Book theme/category for visual mood only: ${bookType || "general"}.

CRITICAL: Do NOT write any text, letters, words, typography, symbols, fake Arabic, logo, watermark, signature, label, title, author name, or category on the image.
Leave clean visual space in the upper/central area and lower area so the app can add real Arabic text later.

Additional: polished artistic design, professional lighting, balanced composition, colors harmonious with the book's theme.`;

    const resp = await fetch(`${MISTRAL_API}/conversations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        inputs: prompt,
        tools: [{ type: "image_generation" }],
        store: false,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Mistral error:", resp.status, text);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 401) {
        return new Response(JSON.stringify({ error: "مفتاح Mistral غير صالح" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "فشل توليد الصورة", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    console.log("Mistral response:", JSON.stringify(data).slice(0, 2000));

    // Conversations API returns { outputs: [...] } with message.output entries containing content chunks
    let b64: string | null = null;
    const outputs = Array.isArray(data?.outputs) ? data.outputs : [];

    const collectChunks = (entry: any): any[] => {
      const c = entry?.content;
      if (Array.isArray(c)) return c;
      if (c && typeof c === "object") return [c];
      return [];
    };

    for (const out of outputs) {
      const chunks = collectChunks(out);
      for (const chunk of chunks) {
        if (chunk?.type === "tool_file" && chunk?.file_id) {
          b64 = await fetchFileAsBase64(chunk.file_id, apiKey);
          if (b64) break;
        }
        if (chunk?.type === "image_url" && (chunk?.image_url?.url || typeof chunk?.image_url === "string")) {
          const url = typeof chunk.image_url === "string" ? chunk.image_url : chunk.image_url.url;
          const r = await fetch(url);
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            let binary = "";
            for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
            b64 = btoa(binary);
            break;
          }
        }
      }
      if (b64) break;
    }

    if (!b64) {
      console.error("No image found in Mistral response");
      return new Response(JSON.stringify({ error: "لم يتم إنشاء صورة", raw: JSON.stringify(data).slice(0, 800) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = `data:image/png;base64,${b64}`;
    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cover-image error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? "خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
