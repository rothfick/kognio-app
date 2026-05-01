import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Activity, ListChecks, Telescope, BookOpen } from "lucide-react";

type MasteryDeltaRow = {
  skill_area_label: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  status_before?: string | null;
  status_after?: string | null;
};

type Checkpoint = {
  id: string;
  owner_type: "user" | "child" | string;
  user_id: string | null;
  child_id: string | null;
  learning_plan_id: string | null;
  baseline_diagnostic_attempt_id: string | null;
  checkpoint_diagnostic_attempt_id: string | null;
  baseline_score: number | null;
  checkpoint_score: number | null;
  score_delta: number | null;
  status: "pending" | "in_progress" | "completed" | "cancelled" | string;
  algorithm_version: string;
  created_at: string;
  completed_at: string | null;
  mastery_delta: MasteryDeltaRow[] | unknown;
  summary: {
    overall_interpretation?: string;
    completed_plan_items?: number;
    total_plan_items?: number;
    improved_areas?: string[];
    regressed_areas?: string[];
    unchanged_areas?: string[];
  } | null;
};

function shortId(id: string | null | undefined) {
  if (!id) return "—";
  return id.slice(0, 8);
}

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Math.round(Number(v) * 100)}%`;
}

function deltaPct(v: number | null | undefined) {
  if (v == null) return "—";
  const n = Math.round(Number(v) * 100);
  return `${n > 0 ? "+" : ""}${n}%`;
}

export default function Checkpoint() {
  const { t, i18n } = useTranslation();
  const { checkpointId } = useParams<{ checkpointId: string }>();
  const { user, loading: authLoading } = useAuth();
  const lang = (i18n.language || "pl").split("-")[0];
  const [cp, setCp] = useState<Checkpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user || !checkpointId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("learning_checkpoints")
      .select("id, owner_type, user_id, child_id, learning_plan_id, baseline_diagnostic_attempt_id, checkpoint_diagnostic_attempt_id, baseline_score, checkpoint_score, score_delta, status, algorithm_version, created_at, completed_at, mastery_delta, summary")
      .eq("id", checkpointId)
      .maybeSingle();
    if (error || !data) { setDenied(true); setLoading(false); return; }
    setCp(data as unknown as Checkpoint);
    setLoading(false);
  }, [user, checkpointId]);

  useEffect(() => { load(); }, [load]);

  const masteryRows: MasteryDeltaRow[] = useMemo(() => {
    if (!cp) return [];
    const arr = Array.isArray(cp.mastery_delta) ? (cp.mastery_delta as MasteryDeltaRow[]) : [];
    return arr.slice().sort((a, b) => Math.abs(Number(b.delta ?? 0)) - Math.abs(Number(a.delta ?? 0)));
  }, [cp]);

  const avgDelta = useMemo(() => {
    const ds = masteryRows.map((m) => m.delta).filter((d): d is number => typeof d === "number");
    if (!ds.length) return null;
    return ds.reduce((a, b) => a + b, 0) / ds.length;
  }, [masteryRows]);

  if (authLoading) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return (
    <AppShell><DashboardShell>
      <div className="py-12 text-sm text-muted-foreground">{t("checkpoint.denied")}</div>
    </DashboardShell></AppShell>
  );
  if (loading || !cp) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("checkpoint.loading")}</div></AppShell>;

  const interp = cp.summary?.overall_interpretation as keyof typeof interpKeys | undefined;
  const interpKeys = {
    strong_improvement: "checkpoint.interpretation.strong_improvement",
    modest_improvement: "checkpoint.interpretation.modest_improvement",
    stable: "checkpoint.interpretation.stable",
    slight_regression: "checkpoint.interpretation.slight_regression",
    regression: "checkpoint.interpretation.regression",
    neutral_no_baseline: "checkpoint.interpretation.neutral_no_baseline",
  } as const;
  const interpKey = interp && interpKeys[interp] ? interpKeys[interp] : "checkpoint.interpretation.neutral_no_baseline";

  const planLink = cp.learning_plan_id ? `/plans/${cp.learning_plan_id}` : null;
  const dashboardLink = cp.child_id ? `/parent/children/${cp.child_id}/knowledge` : "/dashboard";
  const continueLink = planLink ?? dashboardLink;

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={planLink ?? dashboardLink}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("checkpoint.actions.back")}
            </Link>
          </Button>
        </div>

        <DashboardHeader
          title={t("checkpoint.reportTitle")}
          subtitle={t("checkpoint.reportSubtitle")}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary" className="text-[10px]">{t(`checkpoint.status.${cp.status}`, { defaultValue: cp.status })}</Badge>
              <span className="text-[10px] text-muted-foreground">{cp.algorithm_version}</span>
            </div>
          }
        />

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4 flex-wrap">
          <span>{t("checkpoint.createdAt", { date: new Date(cp.created_at).toLocaleString(lang) })}</span>
          {cp.completed_at && <span>· {t("checkpoint.completedAt", { date: new Date(cp.completed_at).toLocaleString(lang) })}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-5 mb-6">
          <StatCard icon={BookOpen} label={t("checkpoint.baselineScore")} value={pct(cp.baseline_score)} />
          <StatCard icon={Sparkles} label={t("checkpoint.checkpointScore")} value={pct(cp.checkpoint_score)} />
          <StatCard
            icon={(cp.score_delta ?? 0) >= 0 ? TrendingUp : TrendingDown}
            label={t("checkpoint.scoreDelta")}
            value={deltaPct(cp.score_delta)}
          />
          <StatCard icon={ListChecks} label={t("checkpoint.completedItems")} value={`${cp.summary?.completed_plan_items ?? 0}/${cp.summary?.total_plan_items ?? 0}`} />
          <StatCard icon={Activity} label={t("checkpoint.averageDelta")} value={deltaPct(avgDelta)} />
        </div>

        <Surface className="p-5 mb-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("checkpoint.interpretationTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t(interpKey)}</p>
        </Surface>

        <Surface className="p-5 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Telescope className="h-4 w-4 text-accent" /> {t("checkpoint.areasTable")}</h2>
          {masteryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("checkpoint.noAreas")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground text-xs">
                    <th className="py-1.5 pr-3 font-medium">{t("checkpoint.colArea")}</th>
                    <th className="py-1.5 pr-3 font-medium tabular-nums">{t("checkpoint.colBefore")}</th>
                    <th className="py-1.5 pr-3 font-medium tabular-nums">{t("checkpoint.colAfter")}</th>
                    <th className="py-1.5 pr-3 font-medium tabular-nums">{t("checkpoint.colDelta")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("checkpoint.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {masteryRows.map((r, i) => {
                    const d = r.delta;
                    const cls = d == null ? "text-muted-foreground" : d >= 0.05 ? "text-green-600" : d <= -0.05 ? "text-destructive" : "text-muted-foreground";
                    return (
                      <tr key={`${r.skill_area_label}-${i}`} className="border-t border-border/40">
                        <td className="py-1.5 pr-3">{r.skill_area_label}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{r.before == null ? t("checkpoint.noBefore") : pct(r.before)}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{r.after == null ? "—" : pct(r.after)}</td>
                        <td className={`py-1.5 pr-3 tabular-nums font-medium ${cls}`}>{deltaPct(d)}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{r.status_after ?? r.status_before ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        <Surface className="p-5 mb-6 border-accent/40">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("checkpoint.evidenceTitle")}</h2>
          <ul className="text-xs text-muted-foreground space-y-1 font-mono">
            <li>{t("checkpoint.evidenceBaseline")}: {shortId(cp.baseline_diagnostic_attempt_id)}</li>
            <li>{t("checkpoint.evidenceCheckpoint")}: {shortId(cp.checkpoint_diagnostic_attempt_id)}</li>
            <li>{t("checkpoint.evidencePlan")}: {shortId(cp.learning_plan_id)}</li>
            <li>{t("checkpoint.evidenceAlgorithm")}: {cp.algorithm_version}</li>
          </ul>
        </Surface>

        <div className="flex flex-wrap gap-2">
          {planLink && (
            <Button asChild size="sm" variant="outline">
              <Link to={planLink}>{t("checkpoint.actions.backToPlan")}</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to={dashboardLink}>{t("checkpoint.actions.back")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={continueLink}>{t("checkpoint.actions.continueLearning")}</Link>
          </Button>
          <Button size="sm" variant="ghost" disabled>{t("checkpoint.actions.generateNextPlan")}</Button>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground text-center">{t("checkpoint.credibility")}</p>
      </DashboardShell>
    </AppShell>
  );
}
