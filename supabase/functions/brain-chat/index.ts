// Drugi Mózg - AI z kontekstem własnych transkryptów ucznia (prosty RAG bez embeddingów na start)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    // RLS ogranicza widoczność do sesji użytkownika
    const [{ data: tr }, { data: reports }] = await Promise.all([
      supabase.from("session_transcripts").select("text").order("created_at", { ascending: false }).limit(200),
      supabase.from("session_reports").select("summary, strengths, weaknesses").order("created_at", { ascending: false }).limit(20),
    ]);

    const context = [
      ...(reports || []).map((r) => `[Raport] ${r.summary || ""} | mocne: ${r.strengths || ""} | słabe: ${r.weaknesses || ""}`),
      ...(tr || []).map((t) => t.text),
    ].join("\n").slice(0, 14000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: `Jesteś osobistym asystentem nauki ucznia ("Drugi Mózg"). Odpowiadaj po polsku, używając WYŁĄCZNIE wiedzy z poniższych transkryptów i raportów sesji. Jeśli odpowiedź nie wynika z kontekstu, powiedz że nie znalazłeś tego w sesjach. Bądź zwięzły i konkretny.\n\nKONTEKST Z SESJI:\n${context || "(brak danych z sesji)"}` },
          { role: "user", content: question },
        ],
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Limit zapytań." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 402) return new Response(JSON.stringify({ error: "Brak środków AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) throw new Error(`AI ${response.status}`);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("brain-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
