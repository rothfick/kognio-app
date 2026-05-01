// AI Co-pilot — Lovable AI Gateway streaming proxy. Authenticated only.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Unauthorized" });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const jwt = authHeader.replace("Bearer ", "");
  const { data: claims, error: cerr } = await supabase.auth.getClaims(jwt);
  if (cerr || !claims?.claims?.sub) {
    return json(401, { error: "Unauthorized" });
  }

  try {
    const body = await req.json().catch(() => null);
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    const mode = body?.mode === "student" ? "student" : "tutor";
    if (!messages || messages.length === 0) {
      return json(400, { error: "messages required" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("ai-copilot: LOVABLE_API_KEY missing");
      return json(500, { error: "AI service unavailable" });
    }

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

    if (response.status === 429) return json(429, { error: "Limit zapytań osiągnięty. Spróbuj za chwilę." });
    if (response.status === 402) return json(402, { error: "Brak środków AI." });
    if (!response.ok) {
      const t = await response.text();
      console.error("ai-copilot gateway error", response.status, t);
      return json(502, { error: "AI service error" });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("ai-copilot error", e);
    return json(500, { error: "Internal error" });
  }
});
