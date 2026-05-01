// Create a learning checkpoint tied to a learning plan + baseline diagnostic.
// Input: { learning_plan_id: uuid, trigger_reason?: 'manual'|'plan_progress'|'plan_completed'|'admin_test' }
// Output: { checkpoint_id: uuid, child_id: uuid|null, baseline_attempt_id: uuid|null }
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
  const planId = String(body?.learning_plan_id ?? "").trim();
  const validReasons = ["manual", "plan_progress", "plan_completed", "admin_test"];
  const triggerReason = validReasons.includes(body?.trigger_reason) ? body.trigger_reason : "manual";
  if (!planId) return json({ error: "learning_plan_id required" }, 400);

  try {
    // Load plan via user RLS (enforces ownership)
    const { data: plan, error: planErr } = await userClient
      .from("learning_plans")
      .select("id, owner_type, user_id, child_id, diagnostic_attempt_id, domain, level")
      .eq("id", planId)
      .maybeSingle();
    if (planErr || !plan) return json({ error: "Plan not found or access denied" }, 404);

    // Eligibility: at least 3 done items OR plan completed
    const { count: doneCount } = await admin
      .from("learning_plan_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
      .eq("status", "done");
    const { data: planFull } = await admin.from("learning_plans").select("status").eq("id", planId).maybeSingle();
    const completed = planFull?.status === "completed";
    if ((doneCount ?? 0) < 3 && !completed) {
      return json({ error: "not_eligible", message: "Complete at least 3 plan steps." }, 400);
    }

    // Baseline score from diagnostic
    let baselineScore: number | null = null;
    if (plan.diagnostic_attempt_id) {
      const { data: bd } = await admin
        .from("diagnostic_attempts")
        .select("score")
        .eq("id", plan.diagnostic_attempt_id)
        .maybeSingle();
      baselineScore = bd?.score != null ? Number(bd.score) : null;
    }

    // Reuse an existing pending checkpoint if one exists for this plan to avoid duplicates
    const { data: existing } = await admin
      .from("learning_checkpoints")
      .select("id, status")
      .eq("learning_plan_id", planId)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return json({ checkpoint_id: existing.id, child_id: plan.child_id, baseline_attempt_id: plan.diagnostic_attempt_id, reused: true });
    }

    const insertPayload: Record<string, unknown> = {
      owner_type: plan.owner_type,
      user_id: plan.user_id,
      child_id: plan.child_id,
      learning_plan_id: planId,
      baseline_diagnostic_attempt_id: plan.diagnostic_attempt_id,
      status: "pending",
      trigger_reason: triggerReason,
      baseline_score: baselineScore,
      algorithm_version: "checkpoint_compare_v1",
      created_by: user.id,
    };

    const { data: cp, error: cpErr } = await admin
      .from("learning_checkpoints")
      .insert(insertPayload)
      .select("id")
      .single();
    if (cpErr) throw cpErr;

    // SMART evidence event
    await admin.from("smart_evidence_events").insert({
      event_type: "checkpoint_created",
      owner_type: plan.owner_type,
      user_id: plan.user_id,
      child_id: plan.child_id,
      diagnostic_attempt_id: plan.diagnostic_attempt_id,
      learning_plan_id: planId,
      algorithm_version: "checkpoint_compare_v1",
      input_summary: { learning_plan_id: planId, baseline_attempt_id: plan.diagnostic_attempt_id, trigger_reason: triggerReason },
      output_summary: { checkpoint_id: cp.id, baseline_score: baselineScore },
      metrics: { plan_done_items: doneCount ?? 0 },
      created_by: user.id,
    });

    return json({ checkpoint_id: cp.id, child_id: plan.child_id, baseline_attempt_id: plan.diagnostic_attempt_id, reused: false });
  } catch (e: any) {
    console.error("checkpoint-create error:", e?.message || e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
