// supabase/functions/lesson-summary-generate/index.ts
// Generates draft tutor / student / (parent) summaries for a booking.
// Persists into lesson_summaries with status='draft', notifies tutor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You write three short post-lesson summaries for the Kogni 1:1 tutoring platform.
Output STRICT JSON of shape:
{
 "tutor": {"markdown":"...","weak_areas":[],"misconceptions":[],"engagement_overview":"","next_focus":"","suggested_homework":""},
 "student": {"markdown":"...","key_points":[],"to_practice":[],"flashcard_hints":[],"next_steps":""},
 "parent": {"markdown":"...","progress":"","next_support":""}
}
Rules:
- Tutor summary: clinical, concrete, lists weak areas + misconceptions, suggests next focus and homework.
- Student summary: warm and encouraging. NEVER mention raw emotion analysis. Focus on what was learned and what to practice.
- Parent summary: neutral progress description, one supportive next step. NEVER include raw emotion timeline.
- Never give psychological/medical diagnosis. Keep each markdown under ~180 words.`;

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

    const body = await req.json().catch(() => null) as { booking_id?: string } | null;
    const bookingId = body?.booking_id;
    if (!bookingId) return json(400, { error: "booking_id required" });

    const { data: booking } = await supabase
      .from("bookings").select("id, tutor_id, student_id, parent_user_id, child_id, skill_area_label, learning_plan_item_id")
      .eq("id", bookingId).maybeSingle();
    if (!booking) return json(404, { error: "booking not found" });

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if ((booking as any).tutor_id !== user.id && !isAdmin) return json(403, { error: "not tutor" });

    const [{ data: transcript }, { data: signals }, { data: notes }, { data: liveSession }] = await Promise.all([
      supabase.from("lesson_transcripts").select("speaker_role,text,created_at")
        .eq("booking_id", bookingId).order("created_at").limit(300),
      supabase.from("lesson_engagement_signals").select("signal_type,label,confidence")
        .eq("booking_id", bookingId).order("created_at"),
      supabase.from("session_notes").select("notes,covered_skill_areas,recommended_next_step")
        .eq("booking_id", bookingId).maybeSingle(),
      supabase.from("live_sessions").select("id").eq("booking_id", bookingId).maybeSingle(),
    ]);

    const liveSessionId = (liveSession as any)?.id ?? null;
    const transcriptStr = (transcript || []).map((t: any) => `[${t.speaker_role}] ${t.text}`).join("\n").slice(0, 8000);

    // Aggregate signals
    const counts: Record<string, number> = {};
    for (const s of (signals as any[]) || []) counts[s.signal_type] = (counts[s.signal_type] || 0) + 1;
    const signalSummary = Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ");

    const ctx = [
      `Skill area: ${(booking as any).skill_area_label || "—"}`,
      (notes as any)?.notes ? `Tutor notes: ${(notes as any).notes}` : "",
      (notes as any)?.recommended_next_step ? `Next step: ${(notes as any).recommended_next_step}` : "",
      signalSummary ? `Engagement signal counts: ${signalSummary}` : "",
      transcriptStr ? `Transcript (truncated):\n${transcriptStr}` : "",
    ].filter(Boolean).join("\n");

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
              { role: "user", content: `Lesson context:\n${ctx}` },
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
      } catch (_e) {/* fallback */}
    }

    if (!parsed) {
      const area = (booking as any).skill_area_label || "ten temat";
      parsed = {
        tutor: { markdown: `Tutor draft: omówiono ${area}. Uzupełnij obserwacje i kolejne kroki.`, weak_areas: [], misconceptions: [], engagement_overview: "", next_focus: "", suggested_homework: "" },
        student: { markdown: `Świetna lekcja! Powtórz materiał z obszaru: ${area}.`, key_points: [], to_practice: [area], flashcard_hints: [], next_steps: "" },
        parent: { markdown: `Lekcja zakończona. Tematyka: ${area}.`, progress: "", next_support: "" },
      };
    }

    const audiences: Array<"tutor" | "student" | "parent"> = ["tutor", "student"];
    if ((booking as any).parent_user_id || (booking as any).child_id) audiences.push("parent");

    const rows = audiences.map((aud) => ({
      booking_id: bookingId,
      live_session_id: liveSessionId,
      audience: aud,
      status: "draft",
      summary: parsed[aud] || {},
      markdown: parsed[aud]?.markdown || "",
      generated_by: "lesson_summary_v1",
      model,
      prompt_version: "lesson_summary_v1",
    }));

    const { data: inserted, error: iErr } = await supabase
      .from("lesson_summaries").insert(rows as never).select("id, audience");
    if (iErr) return json(400, { error: iErr.message });

    // Notify tutor (best effort)
    try {
      await supabase.from("notifications").insert({
        user_id: (booking as any).tutor_id,
        type: "lesson_summary_ready",
        payload: { booking_id: bookingId },
      } as never);
    } catch (_e) {/*non-blocking*/}

    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "lesson_summary_generated",
        owner_type: "user", user_id: user.id,
        algorithm_version: "lesson_summary_v1",
        input_summary: { booking_id: bookingId, audiences },
        output_summary: { count: (inserted as any[])?.length ?? 0 },
        metrics: {}, created_by: user.id,
      } as never);
    } catch (_e) {/*non-blocking*/}

    return json(200, { ok: true, summaries: inserted });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
