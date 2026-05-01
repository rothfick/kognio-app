import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/EmptyState";
import { ShieldCheck, AlertTriangle, Sparkles, Activity, ClipboardList, GraduationCap, Network, BookOpen, ListChecks, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [subjectsCount, setSubjectsCount] = useState<number | null>(null);
  const [kcCount, setKcCount] = useState<number | null>(null);
  const [edgeCount, setEdgeCount] = useState<number | null>(null);
  const [diagItems, setDiagItems] = useState<number | null>(null);
  const [diagAttempts, setDiagAttempts] = useState<number | null>(null);
  const [diagAvgScore, setDiagAvgScore] = useState<number | null>(null);
  const [plansCount, setPlansCount] = useState<number | null>(null);
  const [evidenceCount, setEvidenceCount] = useState<number | null>(null);
  const [planItemsDone, setPlanItemsDone] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [s, k, e, di, da, scoresRes] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("knowledge_components").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("kc_prerequisites").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("approved_by_admin", true),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("diagnostic_attempts").select("score").eq("status", "completed"),
      ]);
      setSubjectsCount(s.count ?? 0);
      setKcCount(k.count ?? 0);
      setEdgeCount(e.count ?? 0);
      setDiagItems(di.count ?? 0);
      setDiagAttempts(da.count ?? 0);
      const scores = ((scoresRes.data || []) as { score: number | null }[]).map((r) => Number(r.score ?? 0));
      setDiagAvgScore(scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null);
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
