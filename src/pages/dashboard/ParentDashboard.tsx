import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LineChart, FileText, Plus, BookOpen, ShieldCheck, Brain } from "lucide-react";
import { AddChildDialog } from "@/components/parent/AddChildDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ChildRow = {
  id: string;
  display_name: string;
  grade_level: string | null;
  primary_subject: string | null;
  consent_signed_at: string | null;
  consent_version: string | null;
  status: string;
};

const ParentDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("parent_children")
      .select("id, display_name, grade_level, primary_subject, consent_signed_at, consent_version, status")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setChildren((data || []) as ChildRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <RoleGate allow={["parent", "admin"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("dashboard.parentTitle")}
            subtitle={t("dashboard.parentSubtitle")}
            actions={children.length > 0 ? <AddChildDialog onCreated={load} /> : undefined}
          />

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard icon={Users} label={t("parent.stats.children")} value={String(children.length)} hint={t("parent.stats.childrenHint")} />
            <StatCard icon={LineChart} label={t("parent.stats.avgProgress")} value="—" hint={t("parent.stats.avgProgressHint")} />
            <StatCard icon={FileText} label={t("parent.stats.latestReport")} value="—" hint={t("parent.stats.latestReportHint")} />
          </div>

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title={t("parent.infoTitle")} className="md:col-span-2">
              <p>
                {t("parent.infoBody")}
              </p>
            </AIInsightCard>
            <Surface className="p-5">
              <h3 className="font-semibold mb-1 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> Bezpieczeństwo
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("parent.safetyBody")}
              </p>
            </Surface>
          </div>

          <Surface className="p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" /> {t("parent.yourChildren")}
            </h2>

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : children.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icon={Plus}
                  title={t("parent.noChildrenTitle")}
                  description={t("parent.noChildrenDesc")}
                />
                <div className="flex justify-center">
                  <AddChildDialog onCreated={load} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {children.map((c) => <ChildCard key={c.id} child={c} />)}
              </div>
            )}
          </Surface>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            {t("parent.footerNote")}
          </p>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

const ChildCard = ({ child }: { child: ChildRow }) => {
  const [trackedKcs, setTrackedKcs] = useState<number | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [hasDiagnostic, setHasDiagnostic] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: m }, { data: la }] = await Promise.all([
        supabase.from("child_kc_mastery").select("mastery_prob").eq("child_id", child.id),
        supabase.from("diagnostic_attempts")
          .select("score")
          .eq("child_id", child.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = (m || []) as { mastery_prob: number }[];
      setTrackedKcs(rows.length);
      setAvg(rows.length ? rows.reduce((a, r) => a + Number(r.mastery_prob), 0) / rows.length : null);
      setHasDiagnostic(!!la);
      setLatestScore(la ? Number((la as any).score ?? 0) : null);
    })();
    return () => { cancelled = true; };
  }, [child.id]);

  return (
    <Surface className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">{child.display_name}</h3>
          <p className="text-xs text-muted-foreground">
            {child.grade_level || "—"} · {child.primary_subject || t("parent.child.noSubject")}
          </p>
        </div>
        {child.consent_signed_at ? (
          <Badge variant="secondary" className="text-[10px]">{t("parent.child.consent", { version: child.consent_version || "v1" })}</Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px]">{t("parent.child.noConsent")}</Badge>
        )}
      </div>

      <div className="rounded-md border bg-card-soft p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Brain className="h-3.5 w-3.5 text-accent" /> {t("parent.child.knowledgeMap")}
        </div>
        {trackedKcs === null ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : !hasDiagnostic ? (
          <p className="text-xs text-muted-foreground">{t("parent.child.noDiagnosis")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("parent.child.diagSummary", { score: Math.round((latestScore || 0) * 100), kc: trackedKcs, avg: Math.round((avg || 0) * 100) })} <span className="font-medium text-foreground">{Math.round((latestScore || 0) * 100)}%</span> · KC: <span className="font-medium text-foreground">{trackedKcs}</span> · Średni: <span className="font-medium text-foreground">{Math.round((avg || 0) * 100)}%</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        {!hasDiagnostic ? (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/diagnose`}>{t("parent.child.doDiagnosis")}</Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/knowledge`}>{t("parent.child.viewMap")}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={`/parent/children/${child.id}/knowledge`}>{t("parent.child.knowledgeMap")}</Link>
        </Button>
      </div>
    </Surface>
  );
};

export default ParentDashboard;
