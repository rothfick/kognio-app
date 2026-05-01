import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Brain, FileText, LineChart, Sparkles, Calendar, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; display_name: string | null; full_name: string | null };
type Attempt = { id: string; score: number | null; status: string; completed_at: string | null; domain: string | null; level: string | null; summary: { gaps?: string[]; strengths?: string[]; recommendations?: string[] } | null };
type Plan = { id: string; title: string; status: string; created_at: string };
type Booking = { id: string; starts_at: string; ends_at: string; status: string };

export default function LinkedStudentDashboard() {
  const { t, i18n } = useTranslation();
  const { studentId } = useParams<{ studentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const lang = (i18n.language || "pl").split("-")[0];

  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [latestSummary, setLatestSummary] = useState<Attempt["summary"]>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!user || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // RLS will already restrict — but verify link exists first for clearer UX
      const { data: link } = await supabase
        .from("student_parent_links")
        .select("id")
        .eq("student_id", studentId)
        .eq("parent_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (cancelled) return;
      if (!link) {
        setDenied(true);
        setLoading(false);
        return;
      }

      const [{ data: prof }, { data: attempts }, { data: plans }, { data: bks }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, full_name").eq("id", studentId).maybeSingle(),
        supabase
          .from("diagnostic_attempts")
          .select("id, score, status, completed_at, domain, level, summary")
          .eq("user_id", studentId)
          .order("completed_at", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from("learning_plans")
          .select("id, title, status, created_at")
          .eq("user_id", studentId)
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("bookings")
          .select("id, starts_at, ends_at, status")
          .eq("student_id", studentId)
          .order("starts_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      setProfile((prof as Profile | null) ?? null);
      const atts = (attempts || []) as unknown as Attempt[];
      setAttempts(atts);
      const completed = atts.find((a) => a.status === "completed");
      setLatestSummary((completed?.summary as Attempt["summary"]) ?? null);
      setPlans((plans || []) as Plan[]);
      setBookings((bks || []) as Booking[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, studentId]);

  if (authLoading) {
    return <AppShell><DashboardShell><p className="text-sm text-muted-foreground py-8">{t("common.loading")}</p></DashboardShell></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) {
    return (
      <AppShell>
        <DashboardShell>
          <DashboardHeader title={t("linkedView.deniedTitle")} subtitle={t("linkedView.deniedSubtitle")} />
          <Button asChild variant="outline"><Link to="/dashboard/parent"><ArrowLeft className="h-4 w-4 mr-1" />{t("linkedView.backToParent")}</Link></Button>
        </DashboardShell>
      </AppShell>
    );
  }

  const completedAttempts = attempts.filter((a) => a.status === "completed");
  const latest = completedAttempts[0];
  const avgScore = completedAttempts.length
    ? Math.round((completedAttempts.reduce((acc, a) => acc + Number(a.score || 0), 0) / completedAttempts.length) * 100)
    : null;

  const studentName = profile?.display_name || profile?.full_name || t("linkedView.student");

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("linkedView.title", { name: studentName })}
          subtitle={t("linkedView.subtitle")}
          primaryAction={{ label: t("linkedView.backToParent"), to: "/dashboard/parent" }}
        />

        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          {t("linkedView.readonlyBadge")}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <StatCard
                icon={LineChart}
                label={t("linkedView.stats.diagnoses")}
                value={String(completedAttempts.length)}
                hint={t("linkedView.stats.diagnosesHint")}
              />
              <StatCard
                icon={Sparkles}
                label={t("linkedView.stats.avgScore")}
                value={avgScore !== null ? `${avgScore}%` : "—"}
                hint={t("linkedView.stats.avgScoreHint")}
              />
              <StatCard
                icon={FileText}
                label={t("linkedView.stats.activePlans")}
                value={String(plans.filter((p) => p.status !== "completed").length)}
                hint={t("linkedView.stats.activePlansHint")}
              />
            </div>

            {/* Latest diagnosis summary */}
            <Surface className="p-5 mb-5">
              <h2 className="font-semibold mb-2 flex items-center gap-2"><Brain className="h-4 w-4 text-accent" />{t("linkedView.latestDiagnosisTitle")}</h2>
              {!latest ? (
                <p className="text-sm text-muted-foreground">{t("linkedView.noDiagnosis")}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-medium">{latest.domain || "—"}</span>
                      <span className="text-muted-foreground"> · {latest.level || "—"}</span>
                    </div>
                    <Badge variant="default">{Math.round(Number(latest.score || 0) * 100)}%</Badge>
                  </div>
                  <Progress value={Math.round(Number(latest.score || 0) * 100)} className="h-2" />
                  {latestSummary?.strengths && latestSummary.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("linkedView.strengths")}</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        {latestSummary.strengths.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {latestSummary?.gaps && latestSummary.gaps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("linkedView.gaps")}</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        {latestSummary.gaps.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {latestSummary?.recommendations && latestSummary.recommendations.length > 0 && (
                    <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
                      <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">{t("linkedView.recommendations")}</p>
                      <ul className="text-sm space-y-1 list-disc pl-5">
                        {latestSummary.recommendations.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Surface>

            {/* Plans */}
            <Surface className="p-5 mb-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-accent" />{t("linkedView.plansTitle")}</h2>
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("linkedView.noPlans")}</p>
              ) : (
                <ul className="space-y-2">
                  {plans.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString(lang)}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{t(`plan.status.${p.status}`, p.status)}</Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/plans/${p.id}`}>{t("plan.viewCta")} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            {/* Sessions */}
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" />{t("linkedView.sessionsTitle")}</h2>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("linkedView.noSessions")}</p>
              ) : (
                <ul className="space-y-2">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                      <span>{new Date(b.starts_at).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" })}</span>
                      <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
