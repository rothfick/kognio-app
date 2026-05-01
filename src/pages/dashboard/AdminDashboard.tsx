import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/EmptyState";
import { ShieldCheck, AlertTriangle, Sparkles, Activity, ClipboardList, GraduationCap, Network, BookOpen, ListChecks, ClipboardCheck, Globe2, Layers, Library, BadgeCheck, Telescope, Link2, Unlink, Percent, User, Users, Cpu, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DomainRow = { id: string; name_pl: string; name_en: string | null; name_es: string | null };
type LevelRow = { id: string; name_pl: string; name_en: string | null; name_es: string | null; order_index: number };

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const localized = (row: { name_pl: string; name_en: string | null; name_es: string | null }) =>
    (lang === "en" ? row.name_en : lang === "es" ? row.name_es : row.name_pl) || row.name_pl;
  const [subjectsCount, setSubjectsCount] = useState<number | null>(null);
  const [kcCount, setKcCount] = useState<number | null>(null);
  const [edgeCount, setEdgeCount] = useState<number | null>(null);
  const [diagItems, setDiagItems] = useState<number | null>(null);
  const [diagAttempts, setDiagAttempts] = useState<number | null>(null);
  const [diagAvgScore, setDiagAvgScore] = useState<number | null>(null);
  const [plansCount, setPlansCount] = useState<number | null>(null);
  const [evidenceCount, setEvidenceCount] = useState<number | null>(null);
  const [planItemsDone, setPlanItemsDone] = useState<number | null>(null);

  // Universal curriculum graph stats
  const [curr, setCurr] = useState<{
    systems: number; levels: number; domains: number; competencies: number;
    edges: number; sources: number; approved: number; draft: number;
  } | null>(null);
  const [domainCounts, setDomainCounts] = useState<Array<{ domain: DomainRow; count: number }>>([]);
  const [levelCounts, setLevelCounts] = useState<Array<{ level: LevelRow; count: number }>>([]);

  // Traceability stats
  type TraceStats = {
    withTaxonomy: number;
    withCustomDomain: number;
    mappedMastery: number;
    unmappedMastery: number;
    matchRate: number | null;
    selfMastery: number;
    parentChildMastery: number;
    withAlgorithm: number;
  };
  const [trace, setTrace] = useState<TraceStats | null>(null);
  type RecentRow = {
    id: string;
    created_at: string;
    owner_type: "self" | "child";
    domain: string | null;
    level: string | null;
    score: number | null;
    mapped: number;
    unmapped: number;
    algorithm_version: string | null;
    prompt_version: string | null;
    source: string | null;
  };
  const [recent, setRecent] = useState<RecentRow[] | null>(null);
  const [cpStats, setCpStats] = useState<{ created: number; completed: number; avgDelta: number | null; avgPlanCompletion: number | null; avgMasteryDelta: number | null; evidenceEvents: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [s, k, e, di, da, scoresRes, lp, see, lpiDone] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("knowledge_components").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("kc_prerequisites").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approved_by_admin", true),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("diagnostic_attempts").select("score").eq("status", "completed"),
        supabase.from("learning_plans").select("id", { count: "exact", head: true }),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }),
        supabase.from("learning_plan_items").select("id", { count: "exact", head: true }).eq("status", "done"),
      ]);
      setSubjectsCount(s.count ?? 0);
      setKcCount(k.count ?? 0);
      setEdgeCount(e.count ?? 0);
      setDiagItems(di.count ?? 0);
      setDiagAttempts(da.count ?? 0);
      const scores = ((scoresRes.data || []) as { score: number | null }[]).map((r) => Number(r.score ?? 0));
      setDiagAvgScore(scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null);
      setPlansCount(lp.count ?? 0);
      setEvidenceCount(see.count ?? 0);
      setPlanItemsDone(lpiDone.count ?? 0);

      // Curriculum graph
      const [es, el, ld, comps, edges, src, approved, draft, allComps, allDomains, allLevels] = await Promise.all([
        supabase.from("education_systems").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("education_levels").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("learning_domains").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("competency_prerequisites").select("id", { count: "exact", head: true }),
        supabase.from("curriculum_sources").select("id", { count: "exact", head: true }),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true).in("review_status", ["approved", "expert_reviewed"]),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true).in("review_status", ["draft", "ai_generated"]),
        supabase.from("competencies").select("domain_id, education_level_id").eq("is_active", true),
        supabase.from("learning_domains").select("id, name_pl, name_en, name_es").eq("is_active", true),
        supabase.from("education_levels").select("id, name_pl, name_en, name_es, order_index").eq("is_active", true).order("order_index"),
      ]);
      setCurr({
        systems: es.count ?? 0, levels: el.count ?? 0, domains: ld.count ?? 0,
        competencies: comps.count ?? 0, edges: edges.count ?? 0, sources: src.count ?? 0,
        approved: approved.count ?? 0, draft: draft.count ?? 0,
      });
      const compRows = (allComps.data || []) as Array<{ domain_id: string; education_level_id: string | null }>;
      const domainsArr = (allDomains.data || []) as DomainRow[];
      const levelsArr = (allLevels.data || []) as LevelRow[];
      const domainMap = new Map<string, number>();
      const levelMap = new Map<string, number>();
      for (const c of compRows) {
        domainMap.set(c.domain_id, (domainMap.get(c.domain_id) || 0) + 1);
        if (c.education_level_id) levelMap.set(c.education_level_id, (levelMap.get(c.education_level_id) || 0) + 1);
      }
      setDomainCounts(domainsArr.map((d) => ({ domain: d, count: domainMap.get(d.id) || 0 })).sort((a, b) => b.count - a.count));
      setLevelCounts(levelsArr.map((l) => ({ level: l, count: levelMap.get(l.id) || 0 })).sort((a, b) => b.count - a.count));

      // Traceability stats
      const [withTax, withCustom, mappedCkc, unmappedCkc, mappedUcm, unmappedUcm, ucmAll, ckcAll, withAlgo, recentAttempts] = await Promise.all([
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).not("learning_domain_id", "is", null),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).is("learning_domain_id", null).not("domain", "is", null),
        supabase.from("child_kc_mastery").select("id", { count: "exact", head: true }).not("competency_id", "is", null),
        supabase.from("child_kc_mastery").select("id", { count: "exact", head: true }).is("competency_id", null),
        supabase.from("user_competency_mastery").select("id", { count: "exact", head: true }).not("competency_id", "is", null),
        supabase.from("user_competency_mastery").select("id", { count: "exact", head: true }).is("competency_id", null),
        supabase.from("user_competency_mastery").select("id", { count: "exact", head: true }),
        supabase.from("child_kc_mastery").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).not("algorithm_version", "is", null),
        supabase.from("diagnostic_attempts")
          .select("id, created_at, user_id, child_id, domain, level, score, algorithm_version, prompt_version, mode, summary")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const mappedTotal = (mappedCkc.count ?? 0) + (mappedUcm.count ?? 0);
      const unmappedTotal = (unmappedCkc.count ?? 0) + (unmappedUcm.count ?? 0);
      const denom = mappedTotal + unmappedTotal;
      setTrace({
        withTaxonomy: withTax.count ?? 0,
        withCustomDomain: withCustom.count ?? 0,
        mappedMastery: mappedTotal,
        unmappedMastery: unmappedTotal,
        matchRate: denom === 0 ? null : mappedTotal / denom,
        selfMastery: ucmAll.count ?? 0,
        parentChildMastery: ckcAll.count ?? 0,
        withAlgorithm: withAlgo.count ?? 0,
      });

      const rows: RecentRow[] = ((recentAttempts.data || []) as Array<{
        id: string; created_at: string; user_id: string | null; child_id: string | null;
        domain: string | null; level: string | null; score: number | null;
        algorithm_version: string | null; prompt_version: string | null; mode: string | null;
        summary: { kc_breakdown?: Array<{ competency_id?: string | null }> } | null;
      }>).map((a) => {
        const breakdown = a.summary?.kc_breakdown ?? [];
        const mapped = breakdown.filter((b) => !!b.competency_id).length;
        const unmapped = breakdown.filter((b) => !b.competency_id).length;
        return {
          id: a.id,
          created_at: a.created_at,
          owner_type: a.child_id ? "child" : "self",
          domain: a.domain,
          level: a.level,
          score: a.score,
          mapped,
          unmapped,
          algorithm_version: a.algorithm_version,
          prompt_version: a.prompt_version,
          source: a.mode,
        };
      });
      setRecent(rows);

      // Checkpoint stats
      const [cpCreated, cpCompletedCount, cpCompletedRows, cpEvidence] = await Promise.all([
        supabase.from("learning_checkpoints").select("id", { count: "exact", head: true }),
        supabase.from("learning_checkpoints").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("learning_checkpoints").select("score_delta, summary, mastery_delta").eq("status", "completed"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }).in("event_type", ["checkpoint_created", "checkpoint_completed"]),
      ]);
      const cpRows = (cpCompletedRows.data || []) as Array<{ score_delta: number | null; summary: { completed_plan_items?: number; total_plan_items?: number } | null; mastery_delta: Array<{ delta: number | null }> | null }>;
      const deltas = cpRows.map((r) => r.score_delta).filter((d): d is number => typeof d === "number");
      const planRatios = cpRows.map((r) => {
        const t = r.summary?.total_plan_items ?? 0; const d = r.summary?.completed_plan_items ?? 0;
        return t ? d / t : null;
      }).filter((d): d is number => typeof d === "number");
      const masteryDeltas: number[] = [];
      cpRows.forEach((r) => { (Array.isArray(r.mastery_delta) ? r.mastery_delta : []).forEach((m) => { if (typeof m?.delta === "number") masteryDeltas.push(m.delta); }); });
      const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
      setCpStats({
        created: cpCreated.count ?? 0,
        completed: cpCompletedCount.count ?? 0,
        avgDelta: avg(deltas),
        avgPlanCompletion: avg(planRatios),
        avgMasteryDelta: avg(masteryDeltas),
        evidenceEvents: cpEvidence.count ?? 0,
      });
    })();
  }, []);

  return (
    <RoleGate allow={["admin"]} fallback="/dashboard">
      <AppShell>
        <DashboardShell>
          <DashboardHeader title={t("dashboard.adminTitle")} subtitle={t("dashboard.adminSubtitle")} />

          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <StatCard icon={ShieldCheck} label={t("admin.verifications")} value="0" hint={t("admin.verificationsHint")} />
            <StatCard icon={AlertTriangle} label={t("admin.disputes")} value="0" />
            <StatCard icon={Sparkles} label={t("admin.aiFlags")} value="0" hint={t("admin.aiFlagsHint")} />
            <StatCard icon={Activity} label={t("admin.health")} value={t("admin.ok")} hint={t("admin.healthHint")} />
          </div>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-accent" /> {t("admin.ontology")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <StatCard icon={BookOpen} label={t("admin.activeSubjects")} value={subjectsCount === null ? "…" : String(subjectsCount)} />
              <StatCard icon={GraduationCap} label={t("admin.activeKc")} value={kcCount === null ? "…" : String(kcCount)} />
              <StatCard icon={Network} label={t("admin.prereqs")} value={edgeCount === null ? "…" : String(edgeCount)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={ListChecks} label={t("admin.diagItems")} value={diagItems === null ? "…" : String(diagItems)} hint={t("admin.diagItemsHint")} />
              <StatCard icon={ClipboardCheck} label={t("admin.diagAttempts")} value={diagAttempts === null ? "…" : String(diagAttempts)} />
              <StatCard icon={Sparkles} label={t("admin.diagAvg")} value={diagAvgScore === null ? "—" : `${Math.round(diagAvgScore * 100)}%`} hint={t("admin.diagAvgHint")} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("admin.ontologyNote")}
            </p>
          </Surface>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> {t("smart.section")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard icon={ListChecks} label={t("smart.plansGenerated")} value={plansCount === null ? "…" : String(plansCount)} />
              <StatCard icon={ClipboardCheck} label={t("smart.itemsCompleted")} value={planItemsDone === null ? "…" : String(planItemsDone)} />
              <StatCard icon={Activity} label={t("smart.evidenceEvents")} value={evidenceCount === null ? "…" : String(evidenceCount)} />
              <StatCard icon={Sparkles} label={t("smart.avgDiagScore")} value={diagAvgScore === null ? "—" : `${Math.round(diagAvgScore * 100)}%`} />
            </div>
          </Surface>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" /> {t("checkpoint.admin.section")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 mb-3">
              <StatCard icon={ListChecks} label={t("checkpoint.admin.created")} value={cpStats === null ? "…" : String(cpStats.created)} />
              <StatCard icon={ClipboardCheck} label={t("checkpoint.admin.completed")} value={cpStats === null ? "…" : String(cpStats.completed)} />
              <StatCard icon={Activity} label={t("checkpoint.admin.evidenceEvents")} value={cpStats === null ? "…" : String(cpStats.evidenceEvents)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={TrendingUp} label={t("checkpoint.admin.avgScoreDelta")} value={cpStats === null || cpStats.avgDelta === null ? "—" : `${cpStats.avgDelta >= 0 ? "+" : ""}${Math.round(cpStats.avgDelta * 100)}%`} />
              <StatCard icon={Percent} label={t("checkpoint.admin.avgPlanCompletion")} value={cpStats === null || cpStats.avgPlanCompletion === null ? "—" : `${Math.round(cpStats.avgPlanCompletion * 100)}%`} />
              <StatCard icon={Sparkles} label={t("checkpoint.admin.avgMasteryDelta")} value={cpStats === null || cpStats.avgMasteryDelta === null ? "—" : `${cpStats.avgMasteryDelta >= 0 ? "+" : ""}${Math.round(cpStats.avgMasteryDelta * 100)}%`} />
            </div>
          </Surface>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-accent" /> {t("curriculum.section")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <StatCard icon={Globe2} label={t("curriculum.systems")} value={curr === null ? "…" : String(curr.systems)} />
              <StatCard icon={Layers} label={t("curriculum.levels")} value={curr === null ? "…" : String(curr.levels)} />
              <StatCard icon={BookOpen} label={t("curriculum.domains")} value={curr === null ? "…" : String(curr.domains)} />
              <StatCard icon={GraduationCap} label={t("curriculum.competencies")} value={curr === null ? "…" : String(curr.competencies)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <StatCard icon={Network} label={t("curriculum.edges")} value={curr === null ? "…" : String(curr.edges)} />
              <StatCard icon={Library} label={t("curriculum.sources")} value={curr === null ? "…" : String(curr.sources)} />
              <StatCard icon={BadgeCheck} label={t("curriculum.approved")} value={curr === null ? "…" : String(curr.approved)} />
              <StatCard icon={ClipboardList} label={t("curriculum.draft")} value={curr === null ? "…" : String(curr.draft)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("curriculum.domainsByCount")}</p>
                {domainCounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("curriculum.noData")}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {domainCounts.map((d) => (
                      <li key={d.domain.id} className="flex justify-between">
                        <span>{localized(d.domain)}</span>
                        <span className="text-muted-foreground tabular-nums">{d.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("curriculum.levelsByCount")}</p>
                {levelCounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("curriculum.noData")}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {levelCounts.filter((l) => l.count > 0).map((l) => (
                      <li key={l.level.id} className="flex justify-between">
                        <span>{localized(l.level)}</span>
                        <span className="text-muted-foreground tabular-nums">{l.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{t("curriculum.note")}</p>
          </Surface>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Telescope className="h-4 w-4 text-accent" /> {t("traceability.panelTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <StatCard icon={Layers} label={t("traceability.withTaxonomy")} value={trace === null ? "…" : String(trace.withTaxonomy)} />
              <StatCard icon={BookOpen} label={t("traceability.withCustomDomain")} value={trace === null ? "…" : String(trace.withCustomDomain)} />
              <StatCard icon={Link2} label={t("traceability.mappedMastery")} value={trace === null ? "…" : String(trace.mappedMastery)} />
              <StatCard icon={Unlink} label={t("traceability.unmappedMastery")} value={trace === null ? "…" : String(trace.unmappedMastery)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <StatCard icon={Percent} label={t("traceability.matchRate")} value={trace === null || trace.matchRate === null ? "—" : `${Math.round(trace.matchRate * 100)}%`} />
              <StatCard icon={User} label={t("traceability.selfMastery")} value={trace === null ? "…" : String(trace.selfMastery)} />
              <StatCard icon={Users} label={t("traceability.parentChildMastery")} value={trace === null ? "…" : String(trace.parentChildMastery)} />
              <StatCard icon={Cpu} label={t("traceability.withAlgorithm")} value={trace === null ? "…" : String(trace.withAlgorithm)} />
            </div>

            <div className="rounded-md border border-border/60 p-3 mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("traceability.recentTitle")}</p>
              {recent === null ? (
                <p className="text-xs text-muted-foreground">…</p>
              ) : recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("traceability.noDiagnostics")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">{t("traceability.colCreated")}</th>
                        <th className="py-1 pr-3 font-medium">{t("traceability.colOwner")}</th>
                        <th className="py-1 pr-3 font-medium">{t("traceability.colDomain")}</th>
                        <th className="py-1 pr-3 font-medium">{t("traceability.colLevel")}</th>
                        <th className="py-1 pr-3 font-medium tabular-nums">{t("traceability.colScore")}</th>
                        <th className="py-1 pr-3 font-medium tabular-nums">{t("traceability.colMapped")}</th>
                        <th className="py-1 pr-3 font-medium tabular-nums">{t("traceability.colUnmapped")}</th>
                        <th className="py-1 pr-3 font-medium">{t("traceability.colAlgorithm")}</th>
                        <th className="py-1 pr-3 font-medium">{t("traceability.colPromptVersion")}</th>
                        <th className="py-1 font-medium">{t("traceability.colSource")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="border-t border-border/40">
                          <td className="py-1 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString(lang)}</td>
                          <td className="py-1 pr-3">{r.owner_type === "child" ? t("traceability.ownerChild") : t("traceability.ownerSelf")}</td>
                          <td className="py-1 pr-3">{r.domain || t("traceability.anonymous")}</td>
                          <td className="py-1 pr-3">{r.level || t("traceability.anonymous")}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.score === null ? "—" : `${Math.round(Number(r.score) * 100)}%`}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.mapped}</td>
                          <td className="py-1 pr-3 tabular-nums">{r.unmapped}</td>
                          <td className="py-1 pr-3">{r.algorithm_version || t("traceability.anonymous")}</td>
                          <td className="py-1 pr-3">{r.prompt_version || t("traceability.anonymous")}</td>
                          <td className="py-1">{r.source || t("traceability.anonymous")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Surface>

          <Surface className="p-5 mb-6 border-accent/40">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> {t("traceability.infoTitle")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("traceability.infoBody")}</p>
          </Surface>

          <Surface className="p-5 mb-6 border-accent/40">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> {t("smartReadiness.title")}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("smartReadiness.body")}</p>
          </Surface>

          <div className="grid gap-5 md:grid-cols-2">
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" />{t("admin.verifications")}</h2>
              <EmptyState icon={ShieldCheck} title={t("admin.verifNoneTitle")} description={t("admin.verifNoneDesc")} />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" />{t("admin.disputes")}</h2>
              <EmptyState icon={AlertTriangle} title={t("admin.dispNoneTitle")} description={t("admin.dispNoneDesc")} />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" />{t("admin.aiFlags")}</h2>
              <EmptyState icon={Sparkles} title={t("admin.flagNoneTitle")} description={t("admin.flagNoneDesc")} />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-accent" />{t("admin.auditTitle")}</h2>
              <EmptyState icon={ClipboardList} title={t("admin.auditNoneTitle")} description={t("admin.auditNoneDesc")} />
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default AdminDashboard;
