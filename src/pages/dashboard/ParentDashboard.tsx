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
import { Users, LineChart, FileText, Plus, BookOpen, ShieldCheck, Brain, TrendingUp, Calendar as CalIcon, ArrowRight } from "lucide-react";
import { AddChildDialog } from "@/components/parent/AddChildDialog";
import { LinkedStudentsSection } from "@/components/parent-link/LinkedStudentsSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NextBestActionCard } from "@/components/journey/NextBestActionCard";
import { useNextBestAction } from "@/hooks/useJourneyState";

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

          <ParentNextBestStepBlock />

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
                <ShieldCheck className="h-4 w-4 text-accent" /> {t("parent.safetyTitle")}
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

          <div className="mt-6">
            <LinkedStudentsSection />
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            {t("parent.footerNote")}
          </p>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

const ChildCard = ({ child }: { child: ChildRow }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [trackedKcs, setTrackedKcs] = useState<number | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [hasDiagnostic, setHasDiagnostic] = useState<boolean>(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<{ id: string; score_delta: number | null; completed_at: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: m }, { data: la }, { data: pl }, { data: cp }] = await Promise.all([
        supabase.from("child_kc_mastery").select("mastery_prob").eq("child_id", child.id),
        supabase.from("diagnostic_attempts")
          .select("score").eq("child_id", child.id).eq("status", "completed")
          .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("learning_plans")
          .select("id, status").eq("child_id", child.id).neq("status", "archived")
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("learning_checkpoints")
          .select("id, score_delta, completed_at").eq("child_id", child.id).eq("status", "completed")
          .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = (m || []) as { mastery_prob: number }[];
      setTrackedKcs(rows.length);
      setAvg(rows.length ? rows.reduce((a, r) => a + Number(r.mastery_prob), 0) / rows.length : null);
      setHasDiagnostic(!!la);
      setLatestScore(la ? Number((la as { score?: number }).score ?? 0) : null);
      setPlanId((pl as { id?: string } | null)?.id ?? null);
      setPlanStatus((pl as { status?: string } | null)?.status ?? null);
      setCheckpoint((cp as { id: string; score_delta: number | null; completed_at: string | null } | null) || null);
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
            {t("parent.child.diagSummary", { score: Math.round((latestScore || 0) * 100), kc: trackedKcs, avg: Math.round((avg || 0) * 100) })}
          </p>
        )}
      </div>

      {checkpoint && (
        <div className="rounded-md border border-accent/30 bg-card-soft p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-accent" /> {t("checkpoint.latestTitle")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("checkpoint.latestSubtitle", { delta: checkpoint.score_delta == null ? "—" : `${(checkpoint.score_delta * 100) >= 0 ? "+" : ""}${Math.round(checkpoint.score_delta * 100)}%` })}
            {checkpoint.completed_at ? ` · ${new Date(checkpoint.completed_at).toLocaleDateString(lang)}` : ""}
          </p>
          <Link to={`/checkpoints/${checkpoint.id}`} className="text-xs text-accent underline-offset-2 hover:underline">
            {t("checkpoint.viewReport")}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-auto">
        {!hasDiagnostic ? (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/diagnose`}>{t("parent.child.doDiagnosis")}</Link>
          </Button>
        ) : planId ? (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/plans/${planId}`}>
              {t("plan.viewCta")}{planStatus ? ` · ${t(`plan.status.${planStatus}`)}` : ""}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/knowledge`}>{t("plan.generateCta")}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={`/parent/children/${child.id}/knowledge`}>{t("parent.child.knowledgeMap")}</Link>
        </Button>
      </div>
    </Surface>
  );
};

const ParentNextBestStepBlock = () => {
  const nb = useNextBestAction();
  if (nb.loading || nb.mode !== "parent") return null;
  if (nb.addChild) return <div className="mb-6"><NextBestActionCard action={nb.action} /></div>;
  const top = nb.children[0];
  return <div className="mb-6"><NextBestActionCard action={top.action} childName={top.child.displayName} /></div>;
};

export default ParentDashboard;
