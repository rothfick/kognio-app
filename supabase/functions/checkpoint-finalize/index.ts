// Finalize a learning checkpoint: link the completed checkpoint diagnostic attempt,
// compute baseline vs after deltas, store summary + mastery_delta, write SMART evidence.
// Input: { checkpoint_id: uuid, checkpoint_attempt_id: uuid }
// Output: { ok: true, checkpoint_id, score_delta, improved, regressed }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type KcRow = { kc_label: string; mastery_pct: number; status?: string };

function norm(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const user = userData.user;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const checkpointId = String(body?.checkpoint_id ?? "").trim();
  const attemptId = String(body?.checkpoint_attempt_id ?? "").trim();
  if (!checkpointId || !attemptId) return json({ error: "checkpoint_id and checkpoint_attempt_id required" }, 400);

  try {
    // Load checkpoint via user RLS (enforces ownership)
    const { data: cp, error: cpErr } = await userClient
      .from("learning_checkpoints")
      .select("id, owner_type, user_id, child_id, learning_plan_id, baseline_diagnostic_attempt_id, baseline_score, status")
      .eq("id", checkpointId)
      .maybeSingle();
    if (cpErr || !cp) return json({ error: "Checkpoint not found or access denied" }, 404);
    if (cp.status === "completed") {
      return json({ ok: true, checkpoint_id: cp.id, already_completed: true });
    }

    // Load the new (checkpoint) diagnostic attempt — also via RLS
    const { data: cpAttempt, error: aErr } = await userClient
      .from("diagnostic_attempts")
      .select("id, status, score, summary, user_id, child_id")
      .eq("id", attemptId)
      .maybeSingle();
    if (aErr || !cpAttempt) return json({ error: "Checkpoint attempt not found" }, 404);
    if (cpAttempt.status !== "completed") return json({ error: "Checkpoint attempt not completed" }, 400);

    // Sanity: same owner
    if ((cp.user_id && cpAttempt.user_id !== cp.user_id) ||
        (cp.child_id && cpAttempt.child_id !== cp.child_id)) {
      return json({ error: "Owner mismatch between checkpoint and attempt" }, 400);
    }

    // Load baseline attempt
    let baseline: { score: number | null; summary: any } | null = null;
    if (cp.baseline_diagnostic_attempt_id) {
      const { data: bd } = await admin
        .from("diagnostic_attempts")
        .select("score, summary")
        .eq("id", cp.baseline_diagnostic_attempt_id)
        .maybeSingle();
      if (bd) baseline = { score: bd.score != null ? Number(bd.score) : null, summary: bd.summary };
    }

    const baselineScore = baseline?.score ?? cp.baseline_score ?? null;
    const checkpointScore = cpAttempt.score != null ? Number(cpAttempt.score) : null;
    const scoreDelta = (baselineScore != null && checkpointScore != null)
      ? Number((checkpointScore - baselineScore).toFixed(4)) : null;

    // Mastery delta computation
    const baseKc: KcRow[] = Array.isArray(baseline?.summary?.kc_breakdown) ? baseline!.summary.kc_breakdown : [];
    const cpKc: KcRow[] = Array.isArray(cpAttempt.summary?.kc_breakdown) ? cpAttempt.summary.kc_breakdown : [];
    const baseMap = new Map<string, KcRow>();
    baseKc.forEach((r) => { if (r?.kc_label) baseMap.set(norm(r.kc_label), r); });

    const masteryDelta: Array<Record<string, unknown>> = [];
    const improved: string[] = [];
    const unchanged: string[] = [];
    const regressed: string[] = [];
    const seen = new Set<string>();

    for (const after of cpKc) {
      if (!after?.kc_label) continue;
      const key = norm(after.kc_label);
      seen.add(key);
      const before = baseMap.get(key);
      const beforeProb = before ? Math.max(0, Math.min(1, (before.mastery_pct ?? 0) / 100)) : null;
      const afterProb = Math.max(0, Math.min(1, (after.mastery_pct ?? 0) / 100));
      const delta = beforeProb != null ? Number((afterProb - beforeProb).toFixed(4)) : null;
      masteryDelta.push({
        skill_area_label: after.kc_label,
        before: beforeProb,
        after: afterProb,
        delta,
        status_before: before?.status ?? null,
        status_after: after.status ?? null,
      });
      if (delta != null) {
        if (delta >= 0.05) improved.push(after.kc_label);
        else if (delta <= -0.05) regressed.push(after.kc_label);
        else unchanged.push(after.kc_label);
      }
    }
    // Areas only in baseline
    for (const before of baseKc) {
      if (!before?.kc_label) continue;
      const key = norm(before.kc_label);
      if (seen.has(key)) continue;
      const beforeProb = Math.max(0, Math.min(1, (before.mastery_pct ?? 0) / 100));
      masteryDelta.push({
        skill_area_label: before.kc_label,
        before: beforeProb,
        after: null,
        delta: null,
        status_before: before.status ?? null,
        status_after: null,
      });
    }

    // Plan completion stats
    let totalItems = 0, doneItems = 0;
    if (cp.learning_plan_id) {
      const { count: tot } = await admin.from("learning_plan_items").select("id", { count: "exact", head: true }).eq("plan_id", cp.learning_plan_id);
      const { count: done } = await admin.from("learning_plan_items").select("id", { count: "exact", head: true }).eq("plan_id", cp.learning_plan_id).eq("status", "done");
      totalItems = tot ?? 0;
      doneItems = done ?? 0;
    }

    const avgDelta = (() => {
      const ds = masteryDelta.map((m) => m.delta as number | null).filter((d): d is number => typeof d === "number");
      if (!ds.length) return null;
      return Number((ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(4));
    })();

    const interpretation = (() => {
      if (scoreDelta == null) return "neutral_no_baseline";
      if (scoreDelta >= 0.10) return "strong_improvement";
      if (scoreDelta >= 0.03) return "modest_improvement";
      if (scoreDelta <= -0.10) return "regression";
      if (scoreDelta <= -0.03) return "slight_regression";
      return "stable";
    })();

    const summary = {
      improved_areas: improved,
      unchanged_areas: unchanged,
      regressed_areas: regressed,
      overall_interpretation: interpretation,
      completed_plan_items: doneItems,
      total_plan_items: totalItems,
    };

    // Update checkpoint row
    const { error: upErr } = await admin
      .from("learning_checkpoints")
      .update({
        checkpoint_diagnostic_attempt_id: attemptId,
        baseline_score: baselineScore,
        checkpoint_score: checkpointScore,
        score_delta: scoreDelta,
        mastery_delta: masteryDelta,
        summary,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkpointId);
    if (upErr) throw upErr;

    // SMART evidence event
    await admin.from("smart_evidence_events").insert({
      event_type: "checkpoint_completed",
      owner_type: cp.owner_type,
      user_id: cp.user_id,
      child_id: cp.child_id,
      diagnostic_attempt_id: attemptId,
      learning_plan_id: cp.learning_plan_id,
      algorithm_version: "checkpoint_compare_v1",
      input_summary: {
        baseline_diagnostic_attempt_id: cp.baseline_diagnostic_attempt_id,
        checkpoint_diagnostic_attempt_id: attemptId,
        learning_plan_id: cp.learning_plan_id,
        completed_plan_items: doneItems,
        total_plan_items: totalItems,
      },
      output_summary: {
        baseline_score: baselineScore,
        checkpoint_score: checkpointScore,
        score_delta: scoreDelta,
        improved_area_count: improved.length,
        regressed_area_count: regressed.length,
        unchanged_area_count: unchanged.length,
        overall_interpretation: interpretation,
      },
      metrics: {
        plan_completion_ratio: totalItems ? Number((doneItems / totalItems).toFixed(4)) : null,
        score_delta: scoreDelta,
        average_mastery_delta: avgDelta,
        algorithm_version: "checkpoint_compare_v1",
      },
      created_by: user.id,
    });

    return json({
      ok: true,
      checkpoint_id: checkpointId,
      score_delta: scoreDelta,
      improved: improved.length,
      regressed: regressed.length,
      unchanged: unchanged.length,
    });
  } catch (e: any) {
    console.error("checkpoint-finalize error:", e?.message || e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
