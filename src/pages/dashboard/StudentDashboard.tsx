import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { MasteryBadge } from "@/components/ui/mastery-badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { NextBestActionCard } from "@/components/journey/NextBestActionCard";
import { useNextBestAction } from "@/hooks/useJourneyState";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Calendar as CalIcon, ClipboardList, Sparkles, BookOpen, ArrowRight, Search, TrendingUp,
} from "lucide-react";
import { isFeatureEnabled } from "@/config/features";
import { UpcomingBookingCard } from "@/components/booking/UpcomingBookingCard";
import { useUpcomingBookings } from "@/hooks/useUpcomingBookings";
import { HomeworkWidget } from "@/components/homework/HomeworkWidget";
import { generateHomework, langCode } from "@/lib/homeworkClient";
import { toast } from "sonner";

type KcRow = { kc_label: string; mastery_pct: number; status: string };
type LatestPlan = { id: string; status: string; title: string };
type LatestCheckpoint = { id: string; score_delta: number | null; completed_at: string | null };

const StudentDashboard = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const { user } = useAuth();
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [latestAttemptId, setLatestAttemptId] = useState<string | null>(null);
  const [kcAreas, setKcAreas] = useState<KcRow[]>([]);
  const [plan, setPlan] = useState<LatestPlan | null>(null);
  const [planProgress, setPlanProgress] = useState<{ done: number; total: number; nextTitle: string | null }>({ done: 0, total: 0, nextTitle: null });
  const [checkpoint, setCheckpoint] = useState<LatestCheckpoint | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("diagnostic_attempts")
        .select("id, score, summary")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestScore(data?.score === null || data?.score === undefined ? null : Number(data.score));
      setLatestAttemptId((data as { id?: string } | null)?.id ?? null);

      // Prefer structured user_competency_mastery if available
      const { data: ucm } = await supabase
        .from("user_competency_mastery")
        .select("skill_area_label, mastery_prob")
        .eq("user_id", user.id)
        .order("last_updated", { ascending: false });
      const ucmRows = (ucm || []) as { skill_area_label: string | null; mastery_prob: number }[];
      if (ucmRows.length > 0) {
        setKcAreas(ucmRows.filter((r) => r.skill_area_label).map((r) => ({
          kc_label: r.skill_area_label!,
          mastery_pct: Math.round(Number(r.mastery_prob || 0) * 100),
          status: "",
        })));
      } else {
        const summary = (data as { summary?: { kc_breakdown?: KcRow[] } } | null)?.summary;
        setKcAreas(Array.isArray(summary?.kc_breakdown) ? (summary!.kc_breakdown as KcRow[]) : []);
      }

      const { data: p } = await supabase
        .from("learning_plans")
        .select("id, status, title")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((p as LatestPlan | null) || null);
      if (p?.id) {
        const { data: items } = await supabase
          .from("learning_plan_items")
          .select("status, title, order_index")
          .eq("plan_id", p.id)
          .order("order_index");
        const list = (items || []) as { status: string; title: string; order_index: number }[];
        const done = list.filter((i) => i.status === "done").length;
        const next = list.find((i) => i.status === "pending" || i.status === "in_progress");
        setPlanProgress({ done, total: list.length, nextTitle: next?.title ?? null });
      }

      const { data: cp } = await supabase
        .from("learning_checkpoints")
        .select("id, score_delta, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCheckpoint((cp as LatestCheckpoint | null) || null);
    })();
  }, [user]);

  const masteryLevel = useMemo(() => {
    if (latestScore === null) return "unknown" as const;
    if (latestScore < 0.25) return "novice" as const;
    if (latestScore < 0.5) return "developing" as const;
    if (latestScore < 0.8) return "proficient" as const;
    return "mastered" as const;
  }, [latestScore]);
  return (
    <RoleGate allow={["student"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("dashboard.studentTitle")}
            subtitle={t("dashboard.studentSubtitle")}
            primaryAction={{ label: t("dashboard.diagnoseCta"), to: "/diagnose" }}
          />

          <NextBestStepBlock />

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard icon={Brain} label={t("student.avgMastery")} value={latestScore === null ? "—" : `${Math.round(latestScore * 100)}%`} hint={latestScore === null ? t("student.avgMasteryHint") : t("student.latestDiagnosisHint")} />
            <StatCard icon={Sparkles} label={t("student.planProgressLabel")} value={planProgress.total ? `${planProgress.done}/${planProgress.total}` : "—"} hint={planProgress.total ? t("student.planProgressHint") : t("student.planProgressEmpty")} />
            <StatCard icon={TrendingUp} label={t("student.checkpointLabel")} value={checkpoint?.score_delta == null ? "—" : `${(checkpoint.score_delta * 100) >= 0 ? "+" : ""}${Math.round(checkpoint.score_delta * 100)}%`} hint={checkpoint ? t("student.checkpointHint") : t("student.checkpointEmpty")} />
          </div>

          <div className="grid gap-5 md:grid-cols-1 mb-6">
            <Surface className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{t("student.yourMastery")}</p>
                {latestScore === null && <Badge variant="secondary" className="text-[10px]">{t("dashboard.soonBadge")}</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MasteryBadge level={masteryLevel} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{latestScore === null ? t("student.mapAfterDiag") : t("student.mapBuiltAfterDiag")}</p>
            </Surface>
          </div>

          {(plan || latestAttemptId) && (
            <Surface className="p-5 mb-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="font-semibold flex items-center gap-2 text-base mb-1">
                    <Sparkles className="h-4 w-4 text-accent" /> {plan ? plan.title : t("plan.title")}
                  </h2>
                  {plan ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] mr-1.5">{t(`plan.status.${plan.status}`)}</Badge>
                        {t("plan.progress", { done: planProgress.done, total: planProgress.total })}
                      </p>
                      {planProgress.nextTitle && (
                        <p className="text-xs mt-2"><span className="text-muted-foreground">{t("plan.nextStep")}: </span>{planProgress.nextTitle}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground max-w-xl">{t("plan.generateHelper")}</p>
                  )}
                </div>
                {plan ? (
                  <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                    <Link to={`/plans/${plan.id}`}>{t("plan.continueCta")}</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                    <Link to="/diagnose">{t("plan.generateCta")}</Link>
                  </Button>
                )}
              </div>
            </Surface>
          )}

          {checkpoint && (
            <Surface className="p-5 mb-6 border-accent/30">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="font-semibold flex items-center gap-2 text-base mb-1">
                    <TrendingUp className="h-4 w-4 text-accent" /> {t("checkpoint.latestTitle")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t("checkpoint.latestSubtitle", { delta: checkpoint.score_delta == null ? "—" : `${(checkpoint.score_delta * 100) >= 0 ? "+" : ""}${Math.round(checkpoint.score_delta * 100)}%` })}
                  </p>
                  {checkpoint.completed_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">{t("checkpoint.completedAt", { date: new Date(checkpoint.completed_at).toLocaleDateString(lang) })}</p>
                  )}
                </div>
                <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                  <Link to={`/checkpoints/${checkpoint.id}`}>{t("checkpoint.viewReport")}</Link>
                </Button>
              </div>
            </Surface>
          )}
          {kcAreas.length > 0 && (
            <Surface className="p-5 mb-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-accent" /> {t("knowledge.aiDiagnosisAreas")}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {kcAreas.map((row, i) => {
                  const pct = Math.max(0, Math.min(100, Math.round(Number(row.mastery_pct || 0))));
                  const lvl = pct < 25 ? "novice" : pct < 50 ? "developing" : pct < 80 ? "proficient" : "mastered";
                  return (
                    <li key={`${row.kc_label}-${i}`} className="flex items-center justify-between gap-3 rounded-md border bg-card-soft px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.kc_label}</p>
                        <p className="text-[11px] text-muted-foreground">{pct}%</p>
                      </div>
                      <MasteryBadge level={lvl as "novice" | "developing" | "proficient" | "mastered"} />
                    </li>
                  );
                })}
              </ul>
            </Surface>
          )}

          {(isFeatureEnabled("booking") || isFeatureEnabled("homework")) && (
            <div className="grid gap-5 md:grid-cols-2">
              {isFeatureEnabled("booking") && (
                <StudentUpcomingBookings hasWeakAreas={kcAreas.some((k) => Number(k.mastery_pct || 0) < 50)} />
              )}
              {isFeatureEnabled("homework") && (
                <StudentHomeworkBlock
                  hasWeakAreas={kcAreas.some((k) => Number(k.mastery_pct || 0) < 50)}
                  diagnosticAttemptId={latestAttemptId}
                />
              )}
            </div>
          )}
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

const NextBestStepBlock = () => {
  const nb = useNextBestAction();
  if (nb.loading || nb.mode !== "self") return null;
  return <div className="mb-6"><NextBestActionCard action={nb.action} /></div>;
};

const StudentUpcomingBookings = ({ hasWeakAreas }: { hasWeakAreas: boolean }) => {
  const { t } = useTranslation();
  const { items, loading } = useUpcomingBookings("student_self");
  return (
    <UpcomingBookingCard
      loading={loading}
      items={items}
      emptyShowFindTutor={isFeatureEnabled("tutorMarketplace")}
      emptyHint={items.length === 0 && hasWeakAreas ? t("dashboardBooking.weakAreasHint") : undefined}
    />
  );
};

const StudentHomeworkBlock = ({ hasWeakAreas, diagnosticAttemptId }: { hasWeakAreas: boolean; diagnosticAttemptId: string | null }) => {
  const { t, i18n } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const onGenerate = async () => {
    if (!diagnosticAttemptId) {
      toast.error(t("homeworkToast.noContext"));
      return;
    }
    setGenerating(true);
    const res = await generateHomework({
      source_type: "diagnosis",
      source_id: diagnosticAttemptId,
      owner_type: "user",
      diagnostic_attempt_id: diagnosticAttemptId,
      language: langCode(i18n.language),
    });
    setGenerating(false);
    if (res.ok) toast.success(t("homeworkToast.generated"));
    else toast.error(t("homeworkToast.generateFailed"));
  };
  return (
    <HomeworkWidget
      showGenerate
      onGenerate={onGenerate}
      generating={generating}
      emptyHint={hasWeakAreas ? t("dashboardHomework.weakAreasHint") : t("dashboardHomework.emptyDesc")}
    />
  );
};

export default StudentDashboard;
