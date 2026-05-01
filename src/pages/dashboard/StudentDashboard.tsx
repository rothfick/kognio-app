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
import { Badge } from "@/components/ui/badge";
import {
  Brain, Calendar as CalIcon, ClipboardList, Sparkles, BookOpen, ArrowRight, Search,
} from "lucide-react";

type KcRow = { kc_label: string; mastery_pct: number; status: string };
type LatestPlan = { id: string; status: string; title: string };

const StudentDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [latestAttemptId, setLatestAttemptId] = useState<string | null>(null);
  const [kcAreas, setKcAreas] = useState<KcRow[]>([]);
  const [plan, setPlan] = useState<LatestPlan | null>(null);
  const [planProgress, setPlanProgress] = useState<{ done: number; total: number; nextTitle: string | null }>({ done: 0, total: 0, nextTitle: null });

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
      const summary = (data as { summary?: { kc_breakdown?: KcRow[] } } | null)?.summary;
      setKcAreas(Array.isArray(summary?.kc_breakdown) ? (summary!.kc_breakdown as KcRow[]) : []);

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

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard icon={Brain} label={t("student.avgMastery")} value={latestScore === null ? "—" : `${Math.round(latestScore * 100)}%`} hint={latestScore === null ? t("student.avgMasteryHint") : t("student.latestDiagnosisHint")} />
            <StatCard icon={CalIcon} label={t("student.nextLesson")} value="—" hint={t("student.noScheduled")} />
            <StatCard icon={ClipboardList} label={t("student.homework")} value="0" hint={t("student.homeworkHint")} />
          </div>

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title={t("dashboard.nextStep")} className="md:col-span-2">
              <p>
                {t("student.nextStepBody")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                  <Link to="/diagnose">
                    {t("dashboard.diagnoseCta")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/discover">
                    {t("student.findTutor")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </AIInsightCard>
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

          <div className="grid gap-5 md:grid-cols-2">
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CalIcon className="h-4 w-4 text-accent" /> {t("student.upcomingLessons")}</h2>
              <EmptyState
                icon={Search}
                title={t("student.noLessonsTitle")}
                description={t("student.noLessonsDesc")}
                ctaLabel={t("student.findTutorCta")}
                ctaTo="/discover"
              />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> {t("student.homeworkSection")}</h2>
              <EmptyState
                icon={Sparkles}
                title={t("student.noTasksTitle")}
                description={t("student.noTasksDesc")}
              />
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default StudentDashboard;
