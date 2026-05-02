import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AdminSubNav } from "@/components/admin/AdminSubNav";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, ClipboardList, ClipboardCheck, Sparkles, Cpu, Download, TrendingUp,
  Layers, Telescope, BadgeCheck, Percent, Link2, Unlink, GraduationCap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PilotReadinessSection } from "@/components/pilot/PilotReadinessSection";
import { FirstSuccessFunnelSection } from "@/components/journey/FirstSuccessFunnelSection";

type AlgoVersion = { version: string; source: string; count: number; latest: string | null };

const ResearchDashboardInner = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [
        diagAll, diagCompleted, diagWithTax, plans, planItemsDone, cps, cpsCompleted,
        masteryAll, expertReviewsAll, expertReviewsSubmitted, expertItems, smartEvents,
        diagAttemptsRows, learningPlansRows, checkpointsRows, expertRows, eventsRows,
        recentEvents, domainsAgg, levelsAgg, masteryUnmapped,
      ] = await Promise.all([
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).not("learning_domain_id", "is", null),
        supabase.from("learning_plans").select("id", { count: "exact", head: true }),
        supabase.from("learning_plan_items").select("id", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("learning_checkpoints").select("id", { count: "exact", head: true }),
        supabase.from("learning_checkpoints").select("baseline_score, checkpoint_score, score_delta, mastery_delta, summary").eq("status", "completed"),
        supabase.from("child_kc_mastery").select("competency_id, skill_area_label, learning_domain_id, mastery_prob"),
        supabase.from("expert_reviews").select("id", { count: "exact", head: true }),
        supabase.from("expert_reviews").select("id, review_type, agreement_score, submitted_at, status").eq("status", "submitted").order("submitted_at", { ascending: false }),
        supabase.from("expert_review_items").select("verdict"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_attempts").select("algorithm_version, prompt_version, created_at"),
        supabase.from("learning_plans").select("algorithm_version, prompt_version, created_at"),
        supabase.from("learning_checkpoints").select("algorithm_version, created_at"),
        supabase.from("expert_reviews").select("algorithm_version, created_at"),
        supabase.from("smart_evidence_events").select("algorithm_version, event_type, created_at"),
        supabase.from("smart_evidence_events").select("id, event_type, algorithm_version, owner_type, created_at, metrics").order("created_at", { ascending: false }).limit(20),
        supabase.from("diagnostic_attempts").select("learning_domain_id").not("learning_domain_id", "is", null),
        supabase.from("diagnostic_attempts").select("education_level_id").not("education_level_id", "is", null),
        supabase.from("user_competency_mastery").select("competency_id, skill_area_label, mastery_prob"),
      ]);

      // Domains/levels lookup
      const [domains, levels] = await Promise.all([
        supabase.from("learning_domains").select("id, name_pl, name_en, name_es"),
        supabase.from("education_levels").select("id, name_pl, name_en, name_es"),
      ]);
      const domainName = new Map((domains.data || []).map((d: any) => [d.id, d]));
      const levelName = new Map((levels.data || []).map((l: any) => [l.id, l]));
      const loc = (row: any) => row ? (lang === "en" ? row.name_en : lang === "es" ? row.name_es : row.name_pl) || row.name_pl : "";

      // Mastery mapping rate
      const allMastery = [...(masteryAll.data || []), ...(masteryUnmapped.data || [])] as any[];
      const mapped = allMastery.filter((m) => m.competency_id).length;
      const unmapped = allMastery.length - mapped;
      const matchRate = allMastery.length ? mapped / allMastery.length : 0;

      // Top skill area labels (unmapped)
      const skillCounts = new Map<string, number>();
      for (const m of allMastery) {
        if (m.skill_area_label) skillCounts.set(m.skill_area_label, (skillCounts.get(m.skill_area_label) || 0) + 1);
      }
      const topSkills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

      // Top weak competencies
      const weakComp = new Map<string, { count: number; sum: number }>();
      for (const m of allMastery) {
        if (m.competency_id && m.mastery_prob != null && Number(m.mastery_prob) < 0.5) {
          const cur = weakComp.get(m.competency_id) || { count: 0, sum: 0 };
          cur.count++; cur.sum += Number(m.mastery_prob);
          weakComp.set(m.competency_id, cur);
        }
      }
      const topWeak = [...weakComp.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);

      // Top domains/levels
      const domCount = new Map<string, number>();
      for (const r of (domainsAgg.data || []) as any[]) domCount.set(r.learning_domain_id, (domCount.get(r.learning_domain_id) || 0) + 1);
      const topDomains = [...domCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const lvlCount = new Map<string, number>();
      for (const r of (levelsAgg.data || []) as any[]) lvlCount.set(r.education_level_id, (lvlCount.get(r.education_level_id) || 0) + 1);
      const topLevels = [...lvlCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

      // Outcome metrics
      const cpRows = (cpsCompleted.data || []) as any[];
      const baselines = cpRows.map((r) => Number(r.baseline_score)).filter((n) => !isNaN(n));
      const checkpoints = cpRows.map((r) => Number(r.checkpoint_score)).filter((n) => !isNaN(n));
      const deltas = cpRows.map((r) => Number(r.score_delta)).filter((n) => !isNaN(n));
      const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
      let improved = 0, unchanged = 0, regressed = 0;
      for (const d of deltas) {
        if (d >= 0.05) improved++; else if (d <= -0.05) regressed++; else unchanged++;
      }
      const planCompletionRatios = cpRows
        .map((r) => r.summary?.plan_completion_ratio)
        .filter((n) => typeof n === "number");

      // Mastery deltas (from JSONB arrays)
      const masteryDeltaVals: number[] = [];
      for (const r of cpRows) {
        const arr = Array.isArray(r.mastery_delta) ? r.mastery_delta : [];
        for (const m of arr) if (typeof m?.delta === "number") masteryDeltaVals.push(m.delta);
      }

      // Expert validation
      const verdictCounts: Record<string, number> = { agree: 0, partially_agree: 0, disagree: 0, unsure: 0, pending: 0 };
      for (const it of (expertItems.data || []) as any[]) {
        const v = it.verdict || "pending";
        verdictCounts[v] = (verdictCounts[v] || 0) + 1;
      }
      const expertSubRows = (expertReviewsSubmitted.data || []) as any[];
      const agreementScores = expertSubRows.map((r) => Number(r.agreement_score)).filter((n) => !isNaN(n));
      const reviewsByType: Record<string, number> = {};
      for (const r of expertSubRows) reviewsByType[r.review_type] = (reviewsByType[r.review_type] || 0) + 1;
      const totalGraded = verdictCounts.agree + verdictCounts.partially_agree + verdictCounts.disagree + verdictCounts.unsure;
      const correctionRate = totalGraded ? (verdictCounts.partially_agree + verdictCounts.disagree) / totalGraded : 0;

      // Algorithm versions registry
      const algoMap = new Map<string, AlgoVersion>();
      const addAlgo = (version: string | null, source: string, created_at: string | null) => {
        if (!version) return;
        const key = `${source}::${version}`;
        const cur = algoMap.get(key) || { version, source, count: 0, latest: null };
        cur.count++;
        if (created_at && (!cur.latest || created_at > cur.latest)) cur.latest = created_at;
        algoMap.set(key, cur);
      };
      for (const r of (diagAttemptsRows.data || []) as any[]) {
        addAlgo(r.algorithm_version, "diagnostic_attempts.algorithm_version", r.created_at);
        addAlgo(r.prompt_version, "diagnostic_attempts.prompt_version", r.created_at);
      }
      for (const r of (learningPlansRows.data || []) as any[]) {
        addAlgo(r.algorithm_version, "learning_plans.algorithm_version", r.created_at);
        addAlgo(r.prompt_version, "learning_plans.prompt_version", r.created_at);
      }
      for (const r of (checkpointsRows.data || []) as any[]) addAlgo(r.algorithm_version, "learning_checkpoints.algorithm_version", r.created_at);
      for (const r of (expertRows.data || []) as any[]) addAlgo(r.algorithm_version, "expert_reviews.algorithm_version", r.created_at);
      for (const r of (eventsRows.data || []) as any[]) addAlgo(r.algorithm_version, "smart_evidence_events.algorithm_version", r.created_at);
      const algoList = [...algoMap.values()].sort((a, b) => b.count - a.count);

      // Funnel
      const funnel = {
        diagnosis_completed: diagCompleted.count ?? 0,
        plan_generated: plans.count ?? 0,
        plan_item_completed: planItemsDone.count ?? 0,
        checkpoint_completed: cpsCompleted.data?.length ?? 0,
        expert_review_submitted: expertSubRows.length,
      };

      // Readiness score
      let readiness = 0;
      if ((diagCompleted.count ?? 0) > 0) readiness += 15;
      if ((plans.count ?? 0) > 0) readiness += 15;
      if (funnel.checkpoint_completed > 0) readiness += 20;
      if (expertSubRows.length > 0) readiness += 20;
      if ((smartEvents.count ?? 0) > 0) readiness += 15;
      if (algoList.length > 0) readiness += 10;
      if (matchRate > 0.5) readiness += 5;

      setData({
        counts: {
          totalDiagnostics: diagAll.count ?? 0,
          diagWithTaxonomy: diagWithTax.count ?? 0,
          mappedMastery: mapped,
          unmappedSkillAreas: unmapped,
          plansGenerated: plans.count ?? 0,
          planItemsDone: planItemsDone.count ?? 0,
          checkpointsCompleted: funnel.checkpoint_completed,
          expertReviewsSubmitted: expertSubRows.length,
          smartEventsCount: smartEvents.count ?? 0,
          algoVersionsCount: algoList.length,
        },
        outcome: {
          avgBaseline: avg(baselines),
          avgCheckpoint: avg(checkpoints),
          avgScoreDelta: avg(deltas),
          avgMasteryDelta: avg(masteryDeltaVals),
          improvedPct: deltas.length ? improved / deltas.length : 0,
          unchangedPct: deltas.length ? unchanged / deltas.length : 0,
          regressedPct: deltas.length ? regressed / deltas.length : 0,
          avgPlanCompletionRatio: avg(planCompletionRatios),
        },
        expert: {
          avgAgreement: avg(agreementScores),
          verdictCounts,
          correctionRate,
          reviewsByType,
          recent: expertSubRows.slice(0, 10).map((r) => ({
            id: r.id, review_type: r.review_type, agreement_score: r.agreement_score, submitted_at: r.submitted_at,
          })),
        },
        traceability: {
          mapped, unmapped, matchRate,
          topDomains: topDomains.map(([id, count]) => ({ id, label: loc(domainName.get(id)), count })),
          topLevels: topLevels.map(([id, count]) => ({ id, label: loc(levelName.get(id)), count })),
          topSkillLabels: topSkills.map(([label, count]) => ({ label, count })),
          topWeakCompetencies: topWeak.map(([id, v]) => ({ competency_id: id, count: v.count, avg_mastery: v.sum / v.count })),
        },
        funnel,
        algoList,
        recentEvents: (recentEvents.data || []).map((e: any) => ({
          id: e.id, event_type: e.event_type, algorithm_version: e.algorithm_version,
          owner_type: e.owner_type, created_at: e.created_at, metrics: e.metrics,
        })),
        readiness,
      });
      setLoading(false);
    })();
  }, [lang]);

  const fmt = (n: number | null | undefined, digits = 2) =>
    n == null || isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);
  const pct = (n: number | null | undefined) => n == null ? "—" : `${(Number(n) * 100).toFixed(0)}%`;

  const handleExport = () => {
    if (!data) return;
    const report = {
      generated_at: new Date().toISOString(),
      product: "Kogni",
      report_type: "SMART_EVIDENCE_V1",
      summary: {
        total_diagnostics: data.counts.totalDiagnostics,
        learning_plans_generated: data.counts.plansGenerated,
        checkpoints_completed: data.counts.checkpointsCompleted,
        average_score_delta: data.outcome.avgScoreDelta,
        average_ai_expert_agreement: data.expert.avgAgreement,
        smart_evidence_events_count: data.counts.smartEventsCount,
      },
      validation_funnel: data.funnel,
      outcome_metrics: data.outcome,
      expert_validation: {
        avg_agreement: data.expert.avgAgreement,
        verdict_counts: data.expert.verdictCounts,
        correction_rate: data.expert.correctionRate,
        reviews_by_type: data.expert.reviewsByType,
      },
      competency_traceability: {
        mapped: data.traceability.mapped,
        unmapped: data.traceability.unmapped,
        match_rate: data.traceability.matchRate,
        top_domains: data.traceability.topDomains.map((d: any) => ({ id: d.id, count: d.count })),
        top_levels: data.traceability.topLevels.map((l: any) => ({ id: l.id, count: l.count })),
        top_skill_labels: data.traceability.topSkillLabels,
        top_weak_competencies: data.traceability.topWeakCompetencies,
      },
      algorithm_versions: data.algoList,
      recent_evidence_events: data.recentEvents.map((e: any) => ({
        id: e.id, event_type: e.event_type, algorithm_version: e.algorithm_version,
        owner_type: e.owner_type, created_at: e.created_at, metrics: e.metrics,
      })),
      readiness_score: data.readiness,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kogni-smart-evidence-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <DashboardShell>
        <AdminSubNav />
          <DashboardHeader
          title={t("research.title")}
          subtitle={t("research.subtitle")}
          actions={
            <div className="flex gap-2 flex-wrap">
              <Button asChild variant="outline">
                <a href="/admin/operations">
                  <Activity className="h-4 w-4 mr-2" />
                  {t("operations.title")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/admin/grant-pack">
                  <BadgeCheck className="h-4 w-4 mr-2" />
                  {t("grantPack.title")}
                </a>
              </Button>
              <Button onClick={handleExport} disabled={!data}>
                <Download className="h-4 w-4 mr-2" />
                {t("export.smartReport")}
              </Button>
            </div>
          }
        />

        {loading || !data ? (
          <Surface className="p-6 text-sm text-muted-foreground">{t("common.loadingPanel")}</Surface>
        ) : (
          <div className="space-y-6">
            {/* Readiness */}
            <Surface variant="ai" className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">{t("research.readiness.title")}</p>
                  <p className="text-4xl font-semibold tabular-nums mt-1">{data.readiness}/100</p>
                  <p className="text-xs text-muted-foreground mt-2 max-w-xl">{t("research.readiness.disclaimer")}</p>
                </div>
                <div className="h-3 w-full max-w-md bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all" style={{ width: `${data.readiness}%` }} />
                </div>
              </div>
            </Surface>

            {/* Demo checklist */}
            <Surface className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <h2 className="text-lg font-semibold">{t("research.demo.title")}</h2>
                  <p className="text-sm text-muted-foreground max-w-xl">{t("research.demo.subtitle")}</p>
                </div>
              </div>
              <ol className="grid gap-2 sm:grid-cols-2 text-sm">
                {[
                  "diagnosis", "plan", "items", "checkpoint", "report", "expert", "research", "export",
                ].map((k, i) => (
                  <li key={k} className="flex items-center gap-3 rounded-lg border bg-card-soft px-3 py-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent text-xs font-semibold tabular-nums">{i + 1}</span>
                    <span>{t(`research.demo.steps.${k}`)}</span>
                  </li>
                ))}
              </ol>
            </Surface>

            <PilotReadinessSection />

            <FirstSuccessFunnelSection />

            {/* Key metrics */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("research.sections.keyMetrics")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard icon={ClipboardList} label={t("research.metrics.totalDiagnostics")} value={data.counts.totalDiagnostics} />
                <StatCard icon={Layers} label={t("research.metrics.diagWithTaxonomy")} value={data.counts.diagWithTaxonomy} />
                <StatCard icon={Link2} label={t("research.metrics.mappedMastery")} value={data.counts.mappedMastery} />
                <StatCard icon={Unlink} label={t("research.metrics.unmappedSkillAreas")} value={data.counts.unmappedSkillAreas} />
                <StatCard icon={Sparkles} label={t("research.metrics.plansGenerated")} value={data.counts.plansGenerated} />
                <StatCard icon={ClipboardCheck} label={t("research.metrics.planItemsDone")} value={data.counts.planItemsDone} />
                <StatCard icon={TrendingUp} label={t("research.metrics.checkpointsCompleted")} value={data.counts.checkpointsCompleted} />
                <StatCard icon={Activity} label={t("research.metrics.avgScoreDelta")} value={fmt(data.outcome.avgScoreDelta)} />
                <StatCard icon={Activity} label={t("research.metrics.avgMasteryDelta")} value={fmt(data.outcome.avgMasteryDelta)} />
                <StatCard icon={BadgeCheck} label={t("research.metrics.expertReviewsSubmitted")} value={data.counts.expertReviewsSubmitted} />
                <StatCard icon={Percent} label={t("research.metrics.avgAgreement")} value={data.expert.avgAgreement == null ? "—" : pct(data.expert.avgAgreement)} />
                <StatCard icon={Percent} label={t("research.metrics.correctionRate")} value={pct(data.expert.correctionRate)} />
                <StatCard icon={Telescope} label={t("research.metrics.smartEventsCount")} value={data.counts.smartEventsCount} />
                <StatCard icon={Cpu} label={t("research.metrics.algoVersionsCount")} value={data.counts.algoVersionsCount} />
              </div>
            </section>

            {/* Funnel */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("funnel.title")}</h2>
              <Surface className="p-5">
                <ol className="space-y-3">
                  {([
                    ["diagnosis_completed", "funnel.stages.diagnosis_completed"],
                    ["plan_generated", "funnel.stages.plan_generated"],
                    ["plan_item_completed", "funnel.stages.plan_item_completed"],
                    ["checkpoint_completed", "funnel.stages.checkpoint_completed"],
                    ["expert_review_submitted", "funnel.stages.expert_review_submitted"],
                  ] as const).map(([key, label], i, arr) => {
                    const count = data.funnel[key] as number;
                    const prev = i === 0 ? null : (data.funnel[arr[i - 1][0]] as number);
                    const conv = prev && prev > 0 ? count / prev : null;
                    return (
                      <li key={key} className="flex items-center justify-between gap-4 border-b last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                          <span className="font-medium">{t(label)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="tabular-nums font-semibold">{count}</span>
                          {conv != null && (
                            <Badge variant="secondary" className="tabular-nums">{pct(conv)} {t("funnel.conversion")}</Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Surface>
            </section>

            {/* Outcome */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("research.sections.outcome")}</h2>
              {data.counts.checkpointsCompleted === 0 ? (
                <Surface className="p-5 text-sm text-muted-foreground">{t("research.empty.outcome")}</Surface>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label={t("research.outcome.avgBaseline")} value={fmt(data.outcome.avgBaseline)} />
                  <StatCard label={t("research.outcome.avgCheckpoint")} value={fmt(data.outcome.avgCheckpoint)} />
                  <StatCard label={t("research.outcome.avgScoreDelta")} value={fmt(data.outcome.avgScoreDelta)} />
                  <StatCard label={t("research.outcome.avgPlanCompletion")} value={pct(data.outcome.avgPlanCompletionRatio)} />
                  <StatCard label={t("research.outcome.improvedPct")} value={pct(data.outcome.improvedPct)} />
                  <StatCard label={t("research.outcome.unchangedPct")} value={pct(data.outcome.unchangedPct)} />
                  <StatCard label={t("research.outcome.regressedPct")} value={pct(data.outcome.regressedPct)} />
                  <StatCard label={t("research.outcome.avgMasteryDelta")} value={fmt(data.outcome.avgMasteryDelta)} />
                </div>
              )}
            </section>

            {/* Expert */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("research.sections.expert")}</h2>
              {data.counts.expertReviewsSubmitted === 0 ? (
                <Surface className="p-5 text-sm text-muted-foreground">{t("research.empty.expert")}</Surface>
              ) : (
                <div className="grid lg:grid-cols-2 gap-3">
                  <Surface className="p-5">
                    <p className="text-sm text-muted-foreground mb-3">{t("research.expert.verdicts")}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {(["agree", "partially_agree", "disagree", "unsure"] as const).map((v) => (
                        <div key={v} className="flex justify-between border rounded-md px-3 py-2">
                          <span>{t(`verdict.${v}`)}</span>
                          <span className="font-semibold tabular-nums">{data.expert.verdictCounts[v] || 0}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <StatCard label={t("research.metrics.avgAgreement")} value={data.expert.avgAgreement == null ? "—" : pct(data.expert.avgAgreement)} />
                      <StatCard label={t("research.metrics.correctionRate")} value={pct(data.expert.correctionRate)} />
                    </div>
                  </Surface>
                  <Surface className="p-5">
                    <p className="text-sm text-muted-foreground mb-3">{t("research.expert.byType")}</p>
                    <ul className="space-y-2 text-sm">
                      {Object.entries(data.expert.reviewsByType).map(([k, v]) => (
                        <li key={k} className="flex justify-between border-b last:border-0 pb-2">
                          <span>{String(t(`expertReview.type.${k}`, { defaultValue: k }))}</span>
                          <span className="font-semibold tabular-nums">{v as number}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted-foreground mt-4 mb-2">{t("research.expert.recent")}</p>
                    <ul className="space-y-2 text-xs">
                      {data.expert.recent.map((r: any) => (
                        <li key={r.id} className="flex justify-between border rounded-md px-2 py-1.5">
                          <span className="font-mono">{r.id.slice(0, 8)}</span>
                          <span>{String(t(`expertReview.type.${r.review_type}`, { defaultValue: r.review_type }))}</span>
                          <span className="tabular-nums">{r.agreement_score == null ? "—" : pct(Number(r.agreement_score))}</span>
                        </li>
                      ))}
                    </ul>
                  </Surface>
                </div>
              )}
            </section>

            {/* Traceability */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("research.sections.traceability")}</h2>
              <div className="grid lg:grid-cols-2 gap-3">
                <Surface className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{t("research.traceability.mapping")}</p>
                    <Badge variant="secondary">{pct(data.traceability.matchRate)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="border rounded-md px-3 py-2 flex justify-between"><span>{t("research.traceability.mapped")}</span><span className="font-semibold tabular-nums">{data.traceability.mapped}</span></div>
                    <div className="border rounded-md px-3 py-2 flex justify-between"><span>{t("research.traceability.unmapped")}</span><span className="font-semibold tabular-nums">{data.traceability.unmapped}</span></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 mb-2">{t("research.traceability.topDomains")}</p>
                  <ul className="space-y-1 text-sm">
                    {data.traceability.topDomains.map((d: any) => (
                      <li key={d.id} className="flex justify-between border-b last:border-0 py-1"><span>{d.label}</span><span className="tabular-nums">{d.count}</span></li>
                    ))}
                    {data.traceability.topDomains.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
                  </ul>
                </Surface>
                <Surface className="p-5">
                  <p className="text-sm text-muted-foreground mb-2">{t("research.traceability.topLevels")}</p>
                  <ul className="space-y-1 text-sm mb-4">
                    {data.traceability.topLevels.map((l: any) => (
                      <li key={l.id} className="flex justify-between border-b last:border-0 py-1"><span>{l.label}</span><span className="tabular-nums">{l.count}</span></li>
                    ))}
                    {data.traceability.topLevels.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
                  </ul>
                  <p className="text-sm text-muted-foreground mb-2">{t("research.traceability.topSkillLabels")}</p>
                  <ul className="space-y-1 text-sm mb-4">
                    {data.traceability.topSkillLabels.map((s: any, i: number) => (
                      <li key={i} className="flex justify-between border-b last:border-0 py-1"><span className="truncate">{s.label}</span><span className="tabular-nums">{s.count}</span></li>
                    ))}
                    {data.traceability.topSkillLabels.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
                  </ul>
                  <p className="text-sm text-muted-foreground mb-2">{t("research.traceability.topWeak")}</p>
                  <ul className="space-y-1 text-xs">
                    {data.traceability.topWeakCompetencies.map((w: any) => (
                      <li key={w.competency_id} className="flex justify-between border-b last:border-0 py-1">
                        <span className="font-mono">{w.competency_id.slice(0, 8)}</span>
                        <span className="tabular-nums">n={w.count} · μ={fmt(w.avg_mastery)}</span>
                      </li>
                    ))}
                    {data.traceability.topWeakCompetencies.length === 0 && <li className="text-muted-foreground">—</li>}
                  </ul>
                </Surface>
              </div>
            </section>

            {/* Algorithms */}
            <section>
              <h2 className="text-lg font-semibold mb-3">{t("algorithm.registry")}</h2>
              <Surface className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">{t("algorithm.version")}</th>
                      <th className="text-left px-4 py-2">{t("algorithm.source")}</th>
                      <th className="text-right px-4 py-2">{t("algorithm.count")}</th>
                      <th className="text-right px-4 py-2">{t("algorithm.latest")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.algoList.map((a: AlgoVersion, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs">{a.version}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{a.source}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{a.count}</td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">{a.latest ? new Date(a.latest).toISOString().slice(0, 10) : "—"}</td>
                      </tr>
                    ))}
                    {data.algoList.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">—</td></tr>
                    )}
                  </tbody>
                </table>
              </Surface>
            </section>

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Link to="/dashboard/admin" className="underline">{t("common.back")}</Link>
            </div>
          </div>
        )}
      </DashboardShell>
    </AppShell>
  );
};

const ResearchDashboard = () => (
  <RoleGate allow={["admin"]}>
    <ResearchDashboardInner />
  </RoleGate>
);

export default ResearchDashboard;
