// Generuje raport sesji (mocne strony, słabe strony, fiszki, zadania domowe) z transkryptu
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    const auth = req.headers.get("Authorization") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    // Pobierz transkrypt + chat + emocje sesji (RLS sam przefiltruje do uczestników)
    const [{ data: tr }, { data: chat }, { data: emo }] = await Promise.all([
      supabase.from("session_transcripts").select("speaker_label, text, created_at").eq("session_id", sessionId).order("created_at"),
      supabase.from("session_chat").select("role, content, created_at").eq("session_id", sessionId).order("created_at"),
      supabase.from("session_emotions").select("engagement, confusion, joy, boredom, recorded_at").eq("session_id", sessionId).order("recorded_at"),
    ]);

    const hasAny = (tr && tr.length > 0) || (chat && chat.length > 0) || (emo && emo.length > 0);
    if (!hasAny) {
      return new Response(JSON.stringify({ error: "Brak danych z sesji do podsumowania." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avg = (k: "engagement" | "confusion" | "joy" | "boredom") => {
      if (!emo || emo.length === 0) return 0;
      const vals = emo.map((e: any) => Number(e[k]) || 0);
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000;
    };
    const emoSummary = emo && emo.length > 0
      ? `Próbki emocji: ${emo.length}. Średnie: zaangażowanie=${avg("engagement")}, dezorientacja=${avg("confusion")}, radość=${avg("joy")}, znudzenie=${avg("boredom")}.`
      : "Brak danych emocjonalnych.";

    const transcriptParts = [
      ...(tr || []).map((t) => `[${t.speaker_label || "?"}] ${t.text}`),
      ...(chat || []).map((c) => `[${c.role === "ai" ? "AI" : "wiadomość"}] ${c.content}`),
    ];
    const transcript = transcriptParts.length > 0
      ? transcriptParts.join("\n")
      : `(Brak transkryptu i czatu — wygeneruj raport wyłącznie na podstawie poniższych metryk emocji.)\n${emoSummary}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Jesteś asystentem edukacyjnym. Analizujesz transkrypt sesji korepetycji i generujesz strukturalne podsumowanie po polsku. Zwróć WYŁĄCZNIE poprawny JSON, bez ```." },
          { role: "user", content: `Na podstawie tego transkryptu stwórz JSON: {"summary": "2-3 zdania", "strengths": "co uczeń opanował", "weaknesses": "co wymaga pracy", "homework": [{"title":"...","description":"..."}], "flashcards": [{"front":"pytanie","back":"odpowiedź"}]}\n\nTRANSKRYPT:\n${transcript.slice(0, 12000)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("session-summary AI error", aiRes.status, t);
      throw new Error("AI gateway error");
    }
    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content }; }

    // Zapisz raport
    const { data: report, error: rErr } = await supabase.from("session_reports").insert({
      session_id: sessionId,
      summary: parsed.summary || null,
      strengths: parsed.strengths || null,
      weaknesses: parsed.weaknesses || null,
      homework: parsed.homework || [],
      flashcards: parsed.flashcards || [],
      engagement_timeline: emo || [],
    }).select().single();
    if (rErr) throw rErr;

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("session-summary error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
