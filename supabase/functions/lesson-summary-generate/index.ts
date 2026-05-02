// supabase/functions/lesson-summary-generate/index.ts
// Generates draft tutor / student / (parent) summaries for a booking.
// Fail-safe: validates ALL required outputs BEFORE any insert.
// On AI/validation failure: no rows inserted, structured error returned,
// and a smart_evidence_events row with type 'lesson_summary_generation_failed'
// is logged (best effort, no raw content).

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
- Student summary: warm and encouraging. NEVER mention raw emotion analysis, engagement timeline, signal counts, or tutor private notes. Focus on what was learned and what to practice.
- Parent summary: neutral progress description, one supportive next step. NEVER include raw emotion timeline, engagement signal counts, or tutor private notes.
- Never give psychological/medical diagnosis. Keep each markdown under ~180 words.`;

// Forbidden tokens for student/parent audiences (case-insensitive substring match).
const FORBIDDEN_LEARNER_TOKENS = [
  "engagement signal",
  "signal count",
  "emotion timeline",
  "raw emotion",
  "tutor note",
  "tutor-only",
  "private note",
  "confused:", "frustrated:", "engaged:", "bored:", // raw signal_type:count form
];

function looksPlaceholder(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return true;
  if (t.length < 30) return true;
  return /\b(tutor draft|placeholder|todo|tbd|lorem ipsum)\b/.test(t);
}

function violatesAudienceSeparation(audience: "student" | "parent", markdown: string): string | null {
  const low = markdown.toLowerCase();
  for (const tok of FORBIDDEN_LEARNER_TOKENS) {
    if (low.includes(tok)) return tok;
  }
  return null;
}

type AudienceKey = "tutor" | "student" | "parent";

function validateSummary(audience: AudienceKey, payload: unknown): { ok: true; markdown: string } | { ok: false; reason: string } {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "missing_payload" };
  const md = (payload as { markdown?: unknown }).markdown;
  if (typeof md !== "string") return { ok: false, reason: "missing_markdown" };
  const trimmed = md.trim();
  if (!trimmed) return { ok: false, reason: "empty_markdown" };
  if (looksPlaceholder(trimmed)) return { ok: false, reason: "placeholder_content" };
  if (audience === "student" || audience === "parent") {
    const bad = violatesAudienceSeparation(audience, trimmed);
    if (bad) return { ok: false, reason: `forbidden_token:${bad}` };
  }
  return { ok: true, markdown: trimmed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  let userId: string | null = null;
  let bookingId: string | null = null;
  let modelUsed = "google/gemini-2.5-flash";
  const promptVersion = "lesson_summary_v1";

  // Helper: log failure as a smart event (best effort, NO raw content).
  const logFailure = async (
    supabase: ReturnType<typeof createClient>,
    reasonCategory: string,
  ) => {
    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "lesson_summary_generation_failed",
        owner_type: "user",
        user_id: userId,
        algorithm_version: promptVersion,
        input_summary: { booking_id: bookingId, reason: reasonCategory },
        output_summary: { model: modelUsed, prompt_version: promptVersion },
        metrics: {},
        created_by: userId,
      } as never);
    } catch (_e) { /* non-blocking */ }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing_auth", message: "Missing Authorization header" });

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: "unauthorized", message: "Not authenticated" });
    userId = user.id;

    const body = await req.json().catch(() => null) as { booking_id?: string } | null;
    bookingId = body?.booking_id ?? null;
    if (!bookingId) return json(400, { error: "invalid_input", message: "booking_id required" });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tutor_id, student_id, parent_user_id, child_id, skill_area_label, learning_plan_item_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return json(404, { error: "not_found", message: "Booking not found" });

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if ((booking as { tutor_id?: string }).tutor_id !== user.id && !isAdmin) {
      return json(403, { error: "forbidden", message: "Only the tutor can generate this summary" });
    }

    const [{ data: transcript }, { data: signals }, { data: notes }, { data: liveSession }] = await Promise.all([
      supabase.from("lesson_transcripts").select("speaker_role,text,created_at")
        .eq("booking_id", bookingId).order("created_at").limit(300),
      supabase.from("lesson_engagement_signals").select("signal_type,label,confidence")
        .eq("booking_id", bookingId).order("created_at"),
      supabase.from("session_notes").select("notes,covered_skill_areas,recommended_next_step")
        .eq("booking_id", bookingId).maybeSingle(),
      supabase.from("live_sessions").select("id").eq("booking_id", bookingId).maybeSingle(),
    ]);

    const liveSessionId = (liveSession as { id?: string } | null)?.id ?? null;
    const transcriptStr = (transcript || []).map((t: { speaker_role: string; text: string }) => `[${t.speaker_role}] ${t.text}`).join("\n").slice(0, 8000);

    const counts: Record<string, number> = {};
    for (const s of (signals as { signal_type: string }[]) || []) counts[s.signal_type] = (counts[s.signal_type] || 0) + 1;
    const signalSummary = Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(", ");

    const ctx = [
      `Skill area: ${(booking as { skill_area_label?: string }).skill_area_label || "—"}`,
      (notes as { notes?: string } | null)?.notes ? `Tutor notes: ${(notes as { notes?: string }).notes}` : "",
      (notes as { recommended_next_step?: string } | null)?.recommended_next_step ? `Next step: ${(notes as { recommended_next_step?: string }).recommended_next_step}` : "",
      signalSummary ? `Engagement signal counts (tutor context only, never echo to learner/parent): ${signalSummary}` : "",
      transcriptStr ? `Transcript (truncated):\n${transcriptStr}` : "",
    ].filter(Boolean).join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      await logFailure(supabase, "missing_ai_key");
      return json(500, { error: "summary_generation_failed", message: "AI provider not configured" });
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelUsed,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Lesson context:\n${ctx}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (aiRes.status === 429) {
        await logFailure(supabase, "rate_limited");
        return json(429, { error: "rate_limited", message: "AI rate limit exceeded" });
      }
      if (aiRes.status === 402) {
        await logFailure(supabase, "ai_credits");
        return json(402, { error: "ai_credits", message: "AI credits exhausted" });
      }
      if (!aiRes.ok) {
        await logFailure(supabase, `ai_http_${aiRes.status}`);
        return json(502, { error: "summary_generation_failed", message: `AI provider error (${aiRes.status})` });
      }
      const data = await aiRes.json();
      const txt = data?.choices?.[0]?.message?.content;
      if (!txt || typeof txt !== "string") {
        await logFailure(supabase, "empty_ai_response");
        return json(502, { error: "summary_generation_failed", message: "Empty AI response" });
      }
      try {
        parsed = JSON.parse(txt);
      } catch {
        await logFailure(supabase, "invalid_json");
        return json(502, { error: "summary_generation_failed", message: "AI returned invalid JSON" });
      }
    } catch (e) {
      await logFailure(supabase, "ai_network_error");
      return json(502, { error: "summary_generation_failed", message: `AI request failed: ${(e as Error).message}` });
    }

    if (!parsed || typeof parsed !== "object") {
      await logFailure(supabase, "invalid_shape");
      return json(502, { error: "summary_generation_failed", message: "AI output had wrong shape" });
    }

    // Required audiences
    const hasParentAudience = !!((booking as { parent_user_id?: string; child_id?: string }).parent_user_id || (booking as { child_id?: string }).child_id);
    const requiredAudiences: AudienceKey[] = ["tutor", "student"];
    if (hasParentAudience) requiredAudiences.push("parent");

    // Validate ALL required audiences BEFORE any insert.
    const validated: Array<{ audience: AudienceKey; markdown: string; raw: Record<string, unknown> }> = [];
    for (const aud of requiredAudiences) {
      const payload = (parsed as Record<string, unknown>)[aud];
      const result = validateSummary(aud, payload);
      if (!result.ok) {
        await logFailure(supabase, `validation_${aud}_${result.reason}`);
        return json(422, {
          error: "summary_generation_failed",
          message: `Validation failed for ${aud} summary (${result.reason})`,
        });
      }
      validated.push({ audience: aud, markdown: result.markdown, raw: payload as Record<string, unknown> });
    }

    // All validations passed — now insert.
    const rows = validated.map(({ audience, markdown, raw }) => ({
      booking_id: bookingId!,
      live_session_id: liveSessionId,
      audience,
      status: "draft",
      summary: raw,
      markdown,
      generated_by: promptVersion,
      model: modelUsed,
      prompt_version: promptVersion,
    }));

    const { data: inserted, error: iErr } = await supabase
      .from("lesson_summaries").insert(rows as never).select("id, audience");
    if (iErr) {
      await logFailure(supabase, `insert_error:${iErr.message.slice(0, 80)}`);
      return json(500, { error: "summary_generation_failed", message: iErr.message });
    }

    // Notify tutor (best effort)
    try {
      await supabase.from("notifications").insert({
        user_id: (booking as { tutor_id: string }).tutor_id,
        type: "lesson_summary_ready",
        payload: { booking_id: bookingId },
      } as never);
    } catch (_e) { /* non-blocking */ }

    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "lesson_summary_generated",
        owner_type: "user",
        user_id: user.id,
        algorithm_version: promptVersion,
        input_summary: { booking_id: bookingId, audiences: requiredAudiences },
        output_summary: { count: (inserted as unknown[])?.length ?? 0, model: modelUsed },
        metrics: {},
        created_by: user.id,
      } as never);
    } catch (_e) { /* non-blocking */ }

    return json(200, { ok: true, summaries: inserted });
  } catch (e) {
    return json(500, { error: "summary_generation_failed", message: (e as Error).message });
  }
});
