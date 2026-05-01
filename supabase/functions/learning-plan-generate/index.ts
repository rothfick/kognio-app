// Generates a Learning Plan v1 from a completed diagnostic attempt.
// Input: { attempt_id }  (optional: { language })
// Auth: requires JWT. Owner is derived from attempt (user_id or child_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALG_VERSION = "learning_plan_rules_ai_v1";
const GENERATED_BY = "diagnosis_to_plan_v1";

type KcRow = { kc_label: string; mastery_pct: number; status: string };
type DiagSummary = {
  overall_level?: string;
  score_pct?: number;
  strengths?: string[];
  gaps?: string[];
  kc_breakdown?: KcRow[];
  recommendations?: string[];
};

type PlanItemOut = {
  order_index: number;
  kind: "review" | "practice" | "lesson" | "quiz" | "project";
  skill_area: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  estimated_minutes: number;
  difficulty_level: number;
};

type PlanOut = {
  title: string;
  description: string;
  items: PlanItemOut[];
};

function clampDiff(n: number) { return Math.max(1, Math.min(5, Math.round(n))); }

function langStrings(lang: string) {
  if (lang === "en") return {
    titlePrefix: "Learning plan",
    descTpl: (d: string, l: string) => `Diagnosis-based plan for ${d} (${l}).`,
    review: "Review",
    practice: "Practice",
    quiz: "Quiz",
    masterTitle: (a: string) => `Master ${a}`,
    reviewTitle: (a: string) => `Review fundamentals: ${a}`,
    practiceTitle: (a: string) => `Practice exercises: ${a}`,
    quizTitle: (a: string) => `Quick quiz: ${a}`,
    consolidateTitle: (a: string) => `Consolidate strength: ${a}`,
    rationaleWeak: (a: string, p: number) => `Detected as a weak area (mastery ${p}%) in the diagnosis.`,
    rationaleStrength: (a: string) => `Strong area in the diagnosis – consolidate to keep the level.`,
    rationaleMid: (a: string, p: number) => `Medium mastery (${p}%) – targeted practice recommended.`,
  };
  if (lang === "es") return {
    titlePrefix: "Plan de estudio",
    descTpl: (d: string, l: string) => `Plan basado en el diagnóstico de ${d} (${l}).`,
    review: "Repaso",
    practice: "Práctica",
    quiz: "Quiz",
    masterTitle: (a: string) => `Dominar ${a}`,
    reviewTitle: (a: string) => `Repasar fundamentos: ${a}`,
    practiceTitle: (a: string) => `Ejercicios de práctica: ${a}`,
    quizTitle: (a: string) => `Quiz rápido: ${a}`,
    consolidateTitle: (a: string) => `Consolidar fortaleza: ${a}`,
    rationaleWeak: (a: string, p: number) => `Detectada como área débil (dominio ${p}%) en el diagnóstico.`,
    rationaleStrength: (a: string) => `Área fuerte en el diagnóstico – consolidar para mantener el nivel.`,
    rationaleMid: (a: string, p: number) => `Dominio medio (${p}%) – se recomienda práctica dirigida.`,
  };
  return {
    titlePrefix: "Plan nauki",
    descTpl: (d: string, l: string) => `Plan oparty na diagnozie z ${d} (${l}).`,
    review: "Powtórka",
    practice: "Ćwiczenia",
    quiz: "Quiz",
    masterTitle: (a: string) => `Opanuj: ${a}`,
    reviewTitle: (a: string) => `Powtórka podstaw: ${a}`,
    practiceTitle: (a: string) => `Ćwiczenia praktyczne: ${a}`,
    quizTitle: (a: string) => `Krótki quiz: ${a}`,
    consolidateTitle: (a: string) => `Utrwal mocną stronę: ${a}`,
    rationaleWeak: (a: string, p: number) => `Wykryte jako luka (opanowanie ${p}%) w diagnozie.`,
    rationaleStrength: (a: string) => `Mocna strona w diagnozie – utrwal, by utrzymać poziom.`,
    rationaleMid: (a: string, p: number) => `Średnie opanowanie (${p}%) – polecane ćwiczenia ukierunkowane.`,
  };
}

function buildPlanFromSummary(domain: string, level: string, lang: string, summary: DiagSummary): PlanOut {
  const L = langStrings(lang);
  const kc = (summary.kc_breakdown || []).slice().sort((a, b) => Number(a.mastery_pct) - Number(b.mastery_pct));
  const weak = kc.filter((r) => Number(r.mastery_pct) < 50);
  const mid = kc.filter((r) => Number(r.mastery_pct) >= 50 && Number(r.mastery_pct) < 80);
  const strong = kc.filter((r) => Number(r.mastery_pct) >= 80);

  const items: PlanItemOut[] = [];
  let order = 1;

  // 2 review steps from weakest
  for (const r of weak.slice(0, 2)) {
    items.push({
      order_index: order++,
      kind: "review",
      skill_area: r.kc_label,
      title: L.reviewTitle(r.kc_label),
      description: null,
      rationale: L.rationaleWeak(r.kc_label, Math.round(Number(r.mastery_pct))),
      estimated_minutes: 25,
      difficulty_level: clampDiff(2),
    });
  }
  // If weak < 2, fill with mid
  if (weak.length < 2) {
    for (const r of mid.slice(0, 2 - weak.length)) {
      items.push({
        order_index: order++, kind: "review", skill_area: r.kc_label,
        title: L.reviewTitle(r.kc_label), description: null,
        rationale: L.rationaleMid(r.kc_label, Math.round(Number(r.mastery_pct))),
        estimated_minutes: 25, difficulty_level: clampDiff(2),
      });
    }
  }

  // 3+ practice steps from weak/mid
  const practiceSrc = [...weak.slice(2), ...mid].slice(0, 6);
  for (const r of practiceSrc.slice(0, 4)) {
    items.push({
      order_index: order++,
      kind: "practice",
      skill_area: r.kc_label,
      title: L.practiceTitle(r.kc_label),
      description: null,
      rationale: Number(r.mastery_pct) < 50
        ? L.rationaleWeak(r.kc_label, Math.round(Number(r.mastery_pct)))
        : L.rationaleMid(r.kc_label, Math.round(Number(r.mastery_pct))),
      estimated_minutes: 35,
      difficulty_level: clampDiff(Number(r.mastery_pct) < 50 ? 2 : 3),
    });
  }

  // Ensure at least 3 practice
  while (items.filter((i) => i.kind === "practice").length < 3 && (mid.length || weak.length || strong.length)) {
    const src = (mid[0] || weak[0] || strong[0]);
    items.push({
      order_index: order++, kind: "practice", skill_area: src?.kc_label ?? domain,
      title: L.practiceTitle(src?.kc_label ?? domain), description: null,
      rationale: L.rationaleMid(src?.kc_label ?? domain, Math.round(Number(src?.mastery_pct ?? 50))),
      estimated_minutes: 30, difficulty_level: 2,
    });
    if (!src) break;
    // Avoid infinite loop: rotate
    mid.shift() || weak.shift() || strong.shift();
  }

  // 1 strength consolidation if available
  if (strong[0]) {
    items.push({
      order_index: order++,
      kind: "lesson",
      skill_area: strong[0].kc_label,
      title: L.consolidateTitle(strong[0].kc_label),
      description: null,
      rationale: L.rationaleStrength(strong[0].kc_label),
      estimated_minutes: 25,
      difficulty_level: 3,
    });
  }

  // 1 quiz step
  const quizArea = (weak[0]?.kc_label) || (mid[0]?.kc_label) || domain;
  items.push({
    order_index: order++,
    kind: "quiz",
    skill_area: quizArea,
    title: L.quizTitle(quizArea),
    description: null,
    rationale: L.rationaleMid(quizArea, Math.round(Number((weak[0] || mid[0])?.mastery_pct ?? 50))),
    estimated_minutes: 15,
    difficulty_level: 2,
  });

  // Cap at 14, ensure at least 7
  const trimmed = items.slice(0, 14).map((i, idx) => ({ ...i, order_index: idx + 1 }));
  // pad with review of domain if too few
  while (trimmed.length < 7) {
    trimmed.push({
      order_index: trimmed.length + 1,
      kind: "practice",
      skill_area: domain,
      title: L.practiceTitle(domain),
      description: null,
      rationale: L.rationaleMid(domain, 50),
      estimated_minutes: 30,
      difficulty_level: 2,
    });
  }

  return {
    title: `${L.titlePrefix}: ${domain}`,
    description: L.descTpl(domain, level),
    items: trimmed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const attemptId: string | undefined = body?.attempt_id;
    const language: string = (body?.language || "pl").toString().split("-")[0];
    if (!attemptId) return json({ error: "attempt_id required" }, 400);

    // Load attempt (RLS enforced)
    const { data: attempt, error: aErr } = await userClient
      .from("diagnostic_attempts")
      .select("id, user_id, child_id, domain, level, status, score, summary, education_system_id, education_level_id, learning_domain_id, taxonomy_payload")
      .eq("id", attemptId)
      .maybeSingle();
    if (aErr) return json({ error: aErr.message }, 400);
    if (!attempt) return json({ error: "Attempt not found" }, 404);
    if (attempt.status !== "completed") return json({ error: "Attempt not completed" }, 400);

    // Reuse if a plan already exists for this attempt
    const { data: existing } = await userClient
      .from("learning_plans")
      .select("id")
      .eq("diagnostic_attempt_id", attemptId)
      .maybeSingle();
    if (existing?.id) return json({ plan_id: existing.id, reused: true });

    const summary: DiagSummary = (attempt.summary as DiagSummary) || {};
    const domain = attempt.domain || "—";
    const level = attempt.level || "—";

    const plan = buildPlanFromSummary(domain, level, language, summary);

    // Load candidate competencies for matching plan items
    const taxonomyDomainId = (attempt as any).learning_domain_id ?? null;
    const taxonomyLevelId = (attempt as any).education_level_id ?? null;
    let candidates: Array<{ id: string; code: string; name_pl: string; name_en: string | null; name_es: string | null }> = [];
    if (taxonomyDomainId) {
      let q = userClient
        .from("competencies")
        .select("id, code, name_pl, name_en, name_es")
        .eq("is_active", true)
        .in("review_status", ["approved", "expert_reviewed"])
        .eq("domain_id", taxonomyDomainId);
      if (taxonomyLevelId) q = q.eq("education_level_id", taxonomyLevelId);
      const { data } = await q;
      candidates = (data || []) as typeof candidates;
    }
    const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    const matchCompetency = (label: string | null): { id: string | null; confidence: number; reason: string } => {
      if (!label || !candidates.length) return { id: null, confidence: 0, reason: "no_candidates" };
      const nl = norm(label);
      for (const c of candidates) {
        const names = [c.code, c.name_pl, c.name_en, c.name_es].filter(Boolean).map((x) => norm(String(x)));
        if (names.includes(nl)) return { id: c.id, confidence: 0.95, reason: "exact_match" };
      }
      for (const c of candidates) {
        const names = [c.name_pl, c.name_en, c.name_es].filter(Boolean).map((x) => norm(String(x)));
        for (const n of names) {
          if (n && (nl.includes(n) || n.includes(nl))) return { id: c.id, confidence: 0.7, reason: "contains_match" };
        }
      }
      return { id: null, confidence: 0, reason: "no_match" };
    };

    const ownerType: "user" | "child" = attempt.child_id ? "child" : "user";
    const evidence = {
      diagnostic_attempt_id: attempt.id,
      source: "diagnosis_summary",
      score: attempt.score,
      domain,
      level,
      taxonomy: (attempt as any).taxonomy_payload ?? {},
      weak_areas_used: (summary.kc_breakdown || []).filter((r) => Number(r.mastery_pct) < 50).map((r) => r.kc_label),
      strengths_used: summary.strengths || [],
      recommendations_used: summary.recommendations || [],
    };

    const { data: planRow, error: pErr } = await userClient.from("learning_plans").insert({
      owner_type: ownerType,
      user_id: ownerType === "user" ? attempt.user_id : null,
      child_id: ownerType === "child" ? attempt.child_id : null,
      diagnostic_attempt_id: attempt.id,
      title: plan.title,
      description: plan.description,
      domain,
      level,
      status: "draft",
      generated_by: GENERATED_BY,
      algorithm_version: ALG_VERSION,
      evidence,
      created_by: uid,
    }).select("id").single();

    if (pErr || !planRow) return json({ error: pErr?.message || "Failed to create plan" }, 400);

    const itemRows = plan.items.map((it) => {
      const m = matchCompetency(it.skill_area);
      return {
        plan_id: planRow.id,
        order_index: it.order_index,
        kind: it.kind,
        skill_area: it.skill_area,
        title: it.title,
        description: it.description,
        rationale: it.rationale,
        evidence_ref: {
          diagnostic_attempt_id: attempt.id,
          skill_area: it.skill_area,
          competency_id: m.id,
          match_confidence: m.confidence,
          match_reason: m.reason,
        },
        estimated_minutes: it.estimated_minutes,
        difficulty_level: it.difficulty_level,
        status: "pending",
        competency_id: m.id,
        learning_domain_id: taxonomyDomainId,
        education_level_id: taxonomyLevelId,
        algorithm_version: ALG_VERSION,
      };
    });

    const { error: iErr } = await userClient.from("learning_plan_items").insert(itemRows);
    if (iErr) {
      // best-effort cleanup
      await userClient.from("learning_plans").delete().eq("id", planRow.id);
      return json({ error: iErr.message }, 400);
    }

    // SMART evidence event
    await userClient.from("smart_evidence_events").insert({
      event_type: "learning_plan_generated",
      owner_type: ownerType,
      user_id: ownerType === "user" ? attempt.user_id : null,
      child_id: ownerType === "child" ? attempt.child_id : null,
      diagnostic_attempt_id: attempt.id,
      learning_plan_id: planRow.id,
      algorithm_version: ALG_VERSION,
      input_summary: {
        diagnostic_attempt_id: attempt.id,
        score: attempt.score,
        domain,
        level,
        weak_areas_count: (summary.kc_breakdown || []).filter((r) => Number(r.mastery_pct) < 50).length,
        recommendations_count: (summary.recommendations || []).length,
      },
      output_summary: {
        plan_id: planRow.id,
        item_count: itemRows.length,
        estimated_total_minutes: itemRows.reduce((a, b) => a + (b.estimated_minutes || 0), 0),
        skill_areas_covered: Array.from(new Set(itemRows.map((i) => i.skill_area).filter(Boolean))),
      },
      metrics: {
        generation_source: "rules_v1",
        language,
        has_structured_kc_breakdown: Array.isArray(summary.kc_breakdown) && summary.kc_breakdown.length > 0,
      },
      created_by: uid,
    });

    return json({ plan_id: planRow.id, reused: false });
  } catch (e) {
    console.error("learning-plan-generate error:", e);
    return json({ error: (e as Error).message || "Unknown error" }, 500);
  }
});
