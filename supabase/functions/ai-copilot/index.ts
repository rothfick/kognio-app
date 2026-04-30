// AI Co-pilot dla pokoju sesji - streaming odpowiedzi z Lovable AI Gateway
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode = "tutor" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const systemPrompt = mode === "student"
      ? "Jesteś cierpliwym asystentem ucznia podczas korepetycji. Odpowiadaj zwięźle po polsku (chyba że zapytano po angielsku). Tłumacz krok po kroku, podawaj wskazówki zamiast gotowych odpowiedzi, gdy to możliwe. Używaj LaTeX dla matematyki ($...$)."
      : "Jesteś co-pilotem korepetytora w trakcie sesji. Pomagasz prowadzić lekcję: proponuj kolejne pytania, wykrywaj nieporozumienia ucznia, sugeruj przykłady i analogie. Odpowiadaj bardzo zwięźle (max 3-4 zdania), po polsku.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limit zapytań osiągnięty. Spróbuj za chwilę." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Brak środków AI. Doładuj w ustawieniach Lovable Cloud." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI gateway: ${response.status} ${t}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("ai-copilot error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
