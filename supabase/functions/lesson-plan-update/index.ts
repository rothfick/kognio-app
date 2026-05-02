// supabase/functions/lesson-plan-update/index.ts
// Adds 3-5 new pending learning_plan_items derived from a lesson summary / weak areas.
// If no active plan exists for the learner, creates a draft one.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You suggest the next 3-5 learning plan steps after a tutoring lesson on the Kogni platform.
Output STRICT JSON: {"items":[{"title":"...","kind":"practice|review|quiz|lesson","skill_area":"...","description":"","rationale":"","estimated_minutes":30,"difficulty_level":2}]}.
Rules:
- Items must be small and actionable for the next 1-2 weeks.
- Use the learner's recent weak areas first.
- kind must be one of: review, practice, lesson, quiz.
- difficulty_level 1..5.`;

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
      .from("bookings").select("id,tutor_id,student_id,parent_user_id,child_id,competency_id,skill_area_label,learning_domain_id,education_level_id")
      .eq("id", bookingId).maybeSingle();
    if (!booking) return json(404, { error: "booking not found" });

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    const isTutor = (booking as any).tutor_id === user.id;
    const isStudent = (booking as any).student_id === user.id;
    const isParent = (booking as any).parent_user_id === user.id;
    if (!isAdmin && !isTutor && !isStudent && !isParent) return json(403, { error: "not allowed" });

    // Load lesson summary (prefer student/approved; fall back to tutor)
    const { data: summaries } = await supabase
      .from("lesson_summaries").select("id,audience,status,markdown,summary")
      .eq("booking_id", bookingId).order("created_at", { ascending: false });
    const sourceSummary = (summaries as any[] || []).find((s) => s.audience === "student" && s.status === "approved")
      || (summaries as any[] || []).find((s) => s.audience === "tutor")
      || null;
    const summaryText = sourceSummary?.markdown || "";
    const weakAreas: string[] = Array.isArray(sourceSummary?.summary?.weak_areas)
      ? sourceSummary.summary.weak_areas
      : (Array.isArray(sourceSummary?.summary?.to_practice) ? sourceSummary.summary.to_practice : []);

    // Determine target plan owner = learner (child or student)
    const ownerType: "user" | "child" = (booking as any).child_id ? "child" : "user";
    const ownerUserId = ownerType === "user" ? (booking as any).student_id : null;
    const ownerChildId = ownerType === "child" ? (booking as any).child_id : null;
    if (ownerType === "user" && !ownerUserId) return json(400, { error: "no student" });

    // Find an active or draft plan for this owner
    let { data: planRow } = await supabase
      .from("learning_plans").select("id,status")
      .match(ownerType === "user"
        ? { owner_type: "user", user_id: ownerUserId, status: "active" }
        : { owner_type: "child", child_id: ownerChildId, status: "active" })
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!planRow) {
      const { data: draft } = await supabase
        .from("learning_plans").select("id,status")
        .match(ownerType === "user"
          ? { owner_type: "user", user_id: ownerUserId, status: "draft" }
          : { owner_type: "child", child_id: ownerChildId, status: "draft" })
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      planRow = draft || null;
    }

    let planId: string | null = (planRow as any)?.id ?? null;
    if (!planId) {
      const { data: createdPlan, error: pErr } = await supabase.from("learning_plans").insert({
        owner_type: ownerType,
        user_id: ownerUserId, child_id: ownerChildId,
        title: "Plan po lekcji",
        description: "Plan utworzony na podstawie lekcji.",
        status: "draft",
        generated_by: "lesson_plan_update_v1",
        algorithm_version: "lesson_plan_update_v1",
        prompt_version: "lesson_plan_update_v1",
        evidence: { booking_id: bookingId, summary_id: sourceSummary?.id || null },
        learning_domain_id: (booking as any).learning_domain_id || null,
        education_level_id: (booking as any).education_level_id || null,
        created_by: user.id,
      } as never).select("id").single();
      if (pErr) return json(400, { error: pErr.message });
      planId = (createdPlan as any).id;
    }

    // Generate items
    const key = Deno.env.get("LOVABLE_API_KEY");
    let parsed: any = null;
    if (key) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `Skill area: ${(booking as any).skill_area_label || "—"}\nWeak areas: ${weakAreas.join(", ") || "—"}\nLesson summary:\n${summaryText.slice(0, 4000)}` },
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
      } catch (_e) {/*fallback*/}
    }

    let items = Array.isArray(parsed?.items) ? parsed.items : null;
    if (!items || items.length === 0) {
      const area = (booking as any).skill_area_label || "ten temat";
      items = [
        { title: `Powtórka: ${area}`, kind: "review", skill_area: area, description: "Krótka powtórka po lekcji.", rationale: "Konsolidacja świeżego materiału.", estimated_minutes: 20, difficulty_level: 2 },
        { title: `Praktyka: ${area}`, kind: "practice", skill_area: area, description: "Ćwiczenia utrwalające.", rationale: "Wzmocnienie umiejętności.", estimated_minutes: 30, difficulty_level: 2 },
        { title: `Krótki quiz: ${area}`, kind: "quiz", skill_area: area, description: "Sprawdź się.", rationale: "Diagnoza postępu.", estimated_minutes: 15, difficulty_level: 2 },
      ];
    }
    items = items.slice(0, 5);

    // Determine next order_index
    const { data: existing } = await supabase
      .from("learning_plan_items").select("order_index").eq("plan_id", planId).order("order_index", { ascending: false }).limit(1).maybeSingle();
    let nextIdx = ((existing as any)?.order_index ?? -1) + 1;

    const VALID_KINDS = new Set(["review","practice","lesson","quiz","project"]);
    const rows = items.map((it: any) => {
      const kind = VALID_KINDS.has(it?.kind) ? it.kind : "practice";
      return {
        plan_id: planId,
        order_index: nextIdx++,
        kind,
        skill_area: it?.skill_area || (booking as any).skill_area_label || null,
        title: String(it?.title || "Nowy krok").slice(0, 200),
        description: it?.description ? String(it.description).slice(0, 1000) : null,
        rationale: it?.rationale ? String(it.rationale).slice(0, 1000) : null,
        evidence_ref: { booking_id: bookingId, summary_id: sourceSummary?.id || null, source: "lesson_plan_update_v1" },
        estimated_minutes: Number.isFinite(it?.estimated_minutes) ? it.estimated_minutes : 30,
        difficulty_level: Math.min(5, Math.max(1, Number(it?.difficulty_level) || 2)),
        status: "pending",
        competency_id: (booking as any).competency_id || null,
        learning_domain_id: (booking as any).learning_domain_id || null,
        education_level_id: (booking as any).education_level_id || null,
        algorithm_version: "lesson_plan_update_v1",
      };
    });

    const { data: inserted, error: iErr } = await supabase
      .from("learning_plan_items").insert(rows as never).select("id");
    if (iErr) return json(400, { error: iErr.message });

    // Notify learner (or parent of child)
    try {
      const recipient = ownerChildId ? (booking as any).parent_user_id : ownerUserId;
      if (recipient) {
        await supabase.from("notifications").insert({
          user_id: recipient, type: "learning_plan_updated",
          payload: { booking_id: bookingId, plan_id: planId, count: rows.length },
        } as never);
      }
    } catch (_e) {/*non-blocking*/}

    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "learning_plan_updated_from_lesson",
        owner_type: ownerType, user_id: ownerUserId, child_id: ownerChildId,
        algorithm_version: "lesson_plan_update_v1",
        input_summary: { booking_id: bookingId, plan_id: planId, summary_id: sourceSummary?.id || null },
        output_summary: { added: (inserted as any[])?.length ?? rows.length },
        metrics: {}, created_by: user.id,
      } as never);
    } catch (_e) {/*non-blocking*/}

    return json(200, { ok: true, plan_id: planId, added: (inserted as any[])?.length ?? rows.length });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
