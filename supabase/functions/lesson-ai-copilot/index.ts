// supabase/functions/lesson-ai-copilot/index.ts
// Tutor-only AI co-pilot during a live lesson. Loads booking context + recent transcript/engagement,
// asks Lovable AI for a short tutor-facing answer, persists tutor question + assistant reply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are a calm, practical AI co-pilot for a 1:1 tutor during a live lesson on the Kogni platform.
You ONLY help the tutor — never address the student directly.
You NEVER produce psychological or medical diagnoses about the student.
You NEVER reveal raw engagement signals to the student.
Keep answers short (3-5 sentences max). Prefer concrete next moves.

Always return STRICT JSON of the shape:
{"answer":"<short tutor-facing answer>","suggested_question":"<one short check question OR empty>","suggested_micro_exercise":"<one tiny exercise OR empty>","evidence_refs":[]}
If you do not have enough information, say so in "answer" and propose what to ask the student next.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing auth" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => null) as { booking_id?: string; question?: string } | null;
    const bookingId = body?.booking_id;
    const question = (body?.question || "").trim();
    if (!bookingId || !question) return json(400, { error: "booking_id and question required" });
    if (question.length > 2000) return json(400, { error: "question too long" });

    // Verify tutor or admin
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tutor_id, student_id, child_id, skill_area_label, competency_id, learning_plan_item_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return json(404, { error: "booking not found" });

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if ((booking as any).tutor_id !== user.id && !isAdmin) return json(403, { error: "not tutor" });

    // Context
    const [{ data: transcript }, { data: signals }, { data: notes }, { data: planItem }] = await Promise.all([
      supabase.from("lesson_transcripts").select("speaker_role,text,created_at")
        .eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(40),
      supabase.from("lesson_engagement_signals").select("signal_type,label,confidence,created_at")
        .eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(20),
      supabase.from("session_notes").select("notes,covered_skill_areas,recommended_next_step")
        .eq("booking_id", bookingId).maybeSingle(),
      (booking as any).learning_plan_item_id
        ? supabase.from("learning_plan_items").select("title,skill_area").eq("id", (booking as any).learning_plan_item_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const transcriptSnippet = (transcript || []).slice().reverse()
      .map((t: any) => `[${t.speaker_role}] ${t.text}`).join("\n").slice(-3000);
    const signalSummary = (signals || []).slice(0, 10)
      .map((s: any) => `${s.signal_type}${s.label ? `(${s.label})` : ""}`).join(", ");

    const contextStr = [
      `Skill area: ${(booking as any).skill_area_label || "—"}`,
      (planItem as any)?.title ? `Plan item: ${(planItem as any).title}` : "",
      (notes as any)?.recommended_next_step ? `Tutor note next step: ${(notes as any).recommended_next_step}` : "",
      signalSummary ? `Recent engagement signals: ${signalSummary}` : "",
      transcriptSnippet ? `Recent transcript:\n${transcriptSnippet}` : "",
    ].filter(Boolean).join("\n");

    // Persist tutor question
    await supabase.from("lesson_ai_copilot_messages").insert({
      booking_id: bookingId, user_id: user.id, role: "tutor", content: question,
    } as never);

    const key = Deno.env.get("LOVABLE_API_KEY");
    let parsed: any = null;
    let model = "google/gemini-2.5-flash";
    if (key) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `Lesson context:\n${contextStr}\n\nTutor question: ${question}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (aiRes.status === 429) return json(429, { error: "rate_limited" });
        if (aiRes.status === 402) return json(402, { error: "ai_credits" });
        if (aiRes.ok) {
          const data = await aiRes.json();
          const txt = data?.choices?.[0]?.message?.content;
          if (txt) parsed = JSON.parse(txt);
        }
      } catch (_e) { /* fall through to fallback */ }
    }

    if (!parsed || typeof parsed.answer !== "string") {
      parsed = {
        answer: "Brak wystarczającego kontekstu lekcji. Zaproponuj uczniowi jedno krótkie pytanie sprawdzające, aby zlokalizować lukę w zrozumieniu.",
        suggested_question: "Czy możesz wyjaśnić ten krok własnymi słowami?",
        suggested_micro_exercise: "",
        evidence_refs: [],
      };
    }

    await supabase.from("lesson_ai_copilot_messages").insert({
      booking_id: bookingId, user_id: user.id, role: "assistant",
      content: parsed.answer || "",
      evidence_refs: Array.isArray(parsed.evidence_refs) ? parsed.evidence_refs : [],
      model, prompt_version: "lesson_copilot_v1",
    } as never);

    // Smart evidence (no PII)
    try {
      await supabase.from("smart_evidence_events").insert([
        { event_type: "lesson_copilot_question_asked", owner_type: "user", user_id: user.id,
          algorithm_version: "lesson_copilot_v1", input_summary: { booking_id: bookingId, q_len: question.length },
          output_summary: {}, metrics: {}, created_by: user.id },
        { event_type: "lesson_copilot_answer_generated", owner_type: "user", user_id: user.id,
          algorithm_version: "lesson_copilot_v1", input_summary: { booking_id: bookingId, model },
          output_summary: { has_question: !!parsed.suggested_question, has_exercise: !!parsed.suggested_micro_exercise },
          metrics: {}, created_by: user.id },
      ] as never);
    } catch (_e) { /* non-blocking */ }

    return json(200, {
      answer: parsed.answer || "",
      suggested_question: parsed.suggested_question || "",
      suggested_micro_exercise: parsed.suggested_micro_exercise || "",
      evidence_refs: Array.isArray(parsed.evidence_refs) ? parsed.evidence_refs : [],
    });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
