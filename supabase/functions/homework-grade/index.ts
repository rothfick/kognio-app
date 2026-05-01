// supabase/functions/homework-grade/index.ts
// Grades a submission for an assignment. Auto-grades multiple_choice and true_false.
// Short-answer items are flagged as needs_review. Updates mastery for the relevant scope.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GradeBody {
  assignment_id: string;
  answers: Record<string, unknown>; // item_id -> answer
}

function normalize(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as GradeBody;
    if (!body?.assignment_id || typeof body.answers !== "object") {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load assignment + items
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("id, owner_type, user_id, child_id, booking_id, learning_domain_id, education_level_id, competency_id, skill_area_label, source_type")
      .eq("id", body.assignment_id)
      .maybeSingle();
    if (aErr || !assignment) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: itemsData } = await supabase
      .from("assignment_items")
      .select("id, item_type, correct_answer, points, skill_area_label, competency_id")
      .eq("assignment_id", body.assignment_id)
      .order("order_index");
    const items = (itemsData || []) as Array<{
      id: string; item_type: string; correct_answer: unknown;
      points: number | null; skill_area_label: string | null; competency_id: string | null;
    }>;
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "no items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let score = 0;
    let max = 0;
    let needsReview = false;
    const feedback: Record<string, { correct: boolean | null; expected?: unknown; given: unknown }> = {};

    for (const item of items) {
      const pts = Number(item.points ?? 1);
      max += pts;
      const given = body.answers?.[item.id];
      if (item.item_type === "multiple_choice" || item.item_type === "true_false") {
        const correct = normalize(given) === normalize(item.correct_answer);
        if (correct) score += pts;
        feedback[item.id] = { correct, expected: item.correct_answer, given };
      } else {
        // short_answer — needs tutor review
        needsReview = true;
        feedback[item.id] = { correct: null, given };
      }
    }

    const percentage = max > 0 ? Math.round((score / max) * 100) : 0;
    const status = needsReview ? "needs_review" : "auto_graded";
    const nowIso = new Date().toISOString();

    // Insert submission
    const { data: sub, error: sErr } = await supabase
      .from("assignment_submissions")
      .insert({
        assignment_id: body.assignment_id,
        submitted_by: user.id,
        answers: body.answers as never,
        score, max_score: max, percentage,
        status, feedback: feedback as never,
        graded_at: nowIso,
      } as never)
      .select("id")
      .single();
    if (sErr || !sub) {
      return new Response(JSON.stringify({ error: sErr?.message || "submission failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update assignment status
    await supabase
      .from("assignments")
      .update({ status: needsReview ? "submitted" : "graded" })
      .eq("id", body.assignment_id);

    // SMART events
    const ownerUser = assignment.user_id as string | null;
    const ownerChild = assignment.child_id as string | null;
    const evtBase = {
      owner_type: assignment.owner_type as string,
      user_id: ownerUser, child_id: ownerChild,
      algorithm_version: "homework_v1",
      input_summary: {
        assignment_id: body.assignment_id,
        source: assignment.source_type,
        skill_area_label: assignment.skill_area_label,
        competency_id: assignment.competency_id,
        booking_id: assignment.booking_id,
      },
      metrics: {},
      created_by: user.id,
    };
    try {
      await supabase.from("smart_evidence_events").insert([
        { ...evtBase, event_type: "homework_submitted", output_summary: { item_count: items.length } },
        { ...evtBase, event_type: needsReview ? "homework_submitted" : "homework_auto_graded", output_summary: { score, max, percentage } },
      ] as never);
    } catch (_e) { /* non-blocking */ }

    // Update mastery if we have a skill_area_label and the assignment was auto-graded
    let masteryDelta: number | null = null;
    if (!needsReview && assignment.skill_area_label) {
      const newProb = Math.max(0, Math.min(1, percentage / 100));
      const conf = Math.min(1, items.length / 10);
      try {
        if (ownerChild) {
          // Check existing mastery
          const { data: existing } = await supabase
            .from("child_kc_mastery")
            .select("id, mastery_prob, kc_id")
            .eq("child_id", ownerChild)
            .eq("skill_area_label", assignment.skill_area_label)
            .maybeSingle();
          if (existing) {
            const prev = Number((existing as any).mastery_prob || 0);
            const blended = prev * 0.6 + newProb * 0.4;
            masteryDelta = blended - prev;
            await supabase
              .from("child_kc_mastery")
              .update({
                mastery_prob: blended,
                confidence: conf,
                source: "homework",
                last_updated: nowIso,
                evidence: { source: "homework_grade", assignment_id: body.assignment_id, percentage } as never,
              })
              .eq("id", (existing as any).id);
          }
        } else if (ownerUser) {
          const { data: existing } = await supabase
            .from("user_competency_mastery")
            .select("id, mastery_prob")
            .eq("user_id", ownerUser)
            .eq("skill_area_label", assignment.skill_area_label)
            .maybeSingle();
          if (existing) {
            const prev = Number((existing as any).mastery_prob || 0);
            const blended = prev * 0.6 + newProb * 0.4;
            masteryDelta = blended - prev;
            await supabase
              .from("user_competency_mastery")
              .update({
                mastery_prob: blended,
                confidence: conf,
                source: "homework",
                last_updated: nowIso,
                evidence: { source: "homework_grade", assignment_id: body.assignment_id, percentage } as never,
              })
              .eq("id", (existing as any).id);
          }
        }
        if (masteryDelta !== null) {
          await supabase.from("smart_evidence_events").insert({
            ...evtBase,
            event_type: "mastery_updated_from_homework",
            output_summary: { delta: masteryDelta, percentage },
          } as never);
        }
      } catch (_e) { /* non-blocking */ }
    }

    return new Response(
      JSON.stringify({
        submission_id: (sub as { id: string }).id,
        score, max, percentage,
        status, needs_review: needsReview, mastery_delta: masteryDelta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
