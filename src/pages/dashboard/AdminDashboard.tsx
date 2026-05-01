import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/EmptyState";
import { ShieldCheck, AlertTriangle, Sparkles, Activity, ClipboardList, GraduationCap, Network, BookOpen, ListChecks, ClipboardCheck, Globe2, Layers, Library, BadgeCheck } from "lucide-react";
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
