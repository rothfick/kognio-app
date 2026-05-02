// Student AI Assistant — separate from tutor co-pilot.
// Strict separation: tutor cannot call this; tutor private notes never exposed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT_PL = `Jesteś bezpiecznym asystentem nauki dla ucznia podczas lekcji online z korepetytorem na platformie Kogni.

Zasady:
- Mów spokojnie, prosto, po polsku.
- Pomóż uczniowi zrozumieć temat, dopytuj naprowadzająco, podawaj proste przykłady.
- NIE udawaj korepetytora ani człowieka.
- NIE oceniaj psychiki/emocji ucznia, nie stawiaj diagnoz medycznych.
- NIE wyjawiaj prywatnych notatek korepetytora ani sygnałów zaangażowania.
- Jeśli pytanie wykracza poza naukę (np. zdrowie, kryzys), zaproponuj rozmowę z dorosłym/korepetytorem.
- Krótkie odpowiedzi: 2–6 zdań, chyba że uczeń poprosi o więcej.`;

const SYSTEM_PROMPT_EN = `You are a safe study assistant for a student during a live online lesson with a tutor on the Kogni platform.

Rules:
- Speak calmly, simply, in English.
- Help the student understand the topic; ask guiding questions, give simple examples.
- Do NOT pretend to be a human tutor.
- Do NOT diagnose emotions or make medical claims.
- Do NOT reveal the tutor's private notes or engagement signals.
- If the question is outside learning (health, crisis), suggest talking to an adult/tutor.
- Short answers: 2–6 sentences unless asked for more.`;

const SYSTEM_PROMPT_ES = `Eres un asistente de estudio seguro para un estudiante durante una clase en línea con un tutor en la plataforma Kogni.

Reglas:
- Habla con calma, simple, en español.
- Ayuda al estudiante a entender el tema; haz preguntas guía, da ejemplos simples.
- No finjas ser un tutor humano.
- No diagnostiques emociones ni hagas afirmaciones médicas.
- No reveles notas privadas del tutor ni señales de participación.
- Si la pregunta está fuera del aprendizaje (salud, crisis), sugiere hablar con un adulto/tutor.
- Respuestas cortas: 2–6 frases salvo que pidan más.`;

function pickSystem(lang?: string) {
  const l = (lang || "pl").slice(0, 2);
  if (l === "en") return SYSTEM_PROMPT_EN;
  if (l === "es") return SYSTEM_PROMPT_ES;
  return SYSTEM_PROMPT_PL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supa = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: auth } } });

    const token = auth.replace("Bearer ", "");
    const { data: claims } = await supa.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body.booking_id || "");
    const question = String(body.question || "").trim();
    const lang = String(body.lang || "pl");
    if (!bookingId || !question || question.length > 2000) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller is student or parent of this booking. Tutor is FORBIDDEN.
    const { data: booking, error: bErr } = await supa
      .from("bookings")
      .select("id, student_id, parent_user_id, tutor_id, skill_area_label")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (booking.tutor_id === userId) {
      return new Response(JSON.stringify({ error: "tutor_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const isStudent = booking.student_id === userId;
    const isParent = booking.parent_user_id === userId;
    if (!isStudent && !isParent) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load short conversation context (last 10).
    const { data: hist } = await supa
      .from("lesson_student_ai_messages")
      .select("role, content")
      .eq("booking_id", bookingId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const history = (hist || []).reverse();

    // Persist student question.
    await supa.from("lesson_student_ai_messages").insert({
      booking_id: bookingId, user_id: userId, role: "student", content: question,
    });

    // Call Lovable AI Gateway.
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ai_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages = [
      { role: "system", content: pickSystem(lang) + (booking.skill_area_label ? `\nTemat lekcji: ${booking.skill_area_label}` : "") },
      ...history.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) })),
      { role: "user", content: question },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 400 }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "no_credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "ai_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const answer: string = aiJson?.choices?.[0]?.message?.content?.trim() || "";

    if (answer) {
      await supa.from("lesson_student_ai_messages").insert({
        booking_id: bookingId, user_id: userId, role: "assistant", content: answer,
      });
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lesson-student-ai", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
