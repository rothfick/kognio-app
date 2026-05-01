import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Brain, CheckCircle2, Clock, ListChecks, Sparkles, SkipForward, Archive, Play, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ExpertReviewBadge } from "@/components/expert-review/ExpertReviewBadge";

type Plan = {
  id: string;
  owner_type: "user" | "child";
  user_id: string | null;
  child_id: string | null;
  diagnostic_attempt_id: string | null;
  title: string;
  description: string | null;
  domain: string | null;
  level: string | null;
  status: "draft" | "active" | "completed" | "archived";
  generated_by: string;
  algorithm_version: string;
  evidence: {
    diagnostic_attempt_id?: string;
    source?: string;
    score?: number | null;
    weak_areas_used?: string[];
    strengths_used?: string[];
    recommendations_used?: string[];
  };
};
type Item = {
  id: string;
  plan_id: string;
  order_index: number;
  kind: "review" | "practice" | "lesson" | "quiz" | "project";
  skill_area: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  estimated_minutes: number | null;
  difficulty_level: number | null;
  status: "pending" | "in_progress" | "done" | "skipped";
};

export default function LearningPlan() {
  const { t } = useTranslation();
  const { planId } = useParams<{ planId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [startingCheckpoint, setStartingCheckpoint] = useState(false);

  const load = useCallback(async () => {
    if (!user || !planId) return;
    setLoading(true);
    const { data: p, error } = await supabase
      .from("learning_plans")
      .select("id, owner_type, user_id, child_id, diagnostic_attempt_id, title, description, domain, level, status, generated_by, algorithm_version, evidence")
      .eq("id", planId)
      .maybeSingle();
    if (error || !p) { setDenied(true); setLoading(false); return; }
    setPlan(p as unknown as Plan);
    const { data: it } = await supabase
      .from("learning_plan_items")
      .select("id, plan_id, order_index, kind, skill_area, title, description, rationale, estimated_minutes, difficulty_level, status")
      .eq("plan_id", planId)
      .order("order_index");
    setItems((it || []) as unknown as Item[]);
    setLoading(false);
  }, [user, planId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const time = items.reduce((a, b) => a + (b.estimated_minutes || 0), 0);
    const weakAreas = new Set((plan?.evidence?.weak_areas_used || []));
    return { total, done, time, weakAreas: weakAreas.size };
  }, [items, plan]);

  const activate = async () => {
    if (!plan) return;
    const { error } = await supabase
      .from("learning_plans")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success(t("plan.activated"));
    // SMART evidence
    await supabase.from("smart_evidence_events").insert({
      event_type: "learning_plan_activated",
      owner_type: plan.owner_type,
      user_id: plan.user_id,
      child_id: plan.child_id,
      diagnostic_attempt_id: plan.diagnostic_attempt_id,
      learning_plan_id: plan.id,
      algorithm_version: plan.algorithm_version,
      input_summary: { plan_id: plan.id },
      output_summary: { status: "active" },
      metrics: { item_count: items.length },
      created_by: user!.id,
    });
    load();
  };

  const archive = async () => {
    if (!plan) return;
    const { error } = await supabase
      .from("learning_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success(t("plan.archived"));
    load();
  };

  const updateItem = async (item: Item, status: Item["status"]) => {
    const patch: Partial<Item> & { completed_at?: string | null } = { status };
    if (status === "done") (patch as { completed_at?: string }).completed_at = new Date().toISOString();
    const { error } = await supabase.from("learning_plan_items").update(patch).eq("id", item.id);
    if (error) return toast.error(error.message);
    if (status === "done") {
      toast.success(t("plan.itemDone"));
      if (plan) {
        await supabase.from("smart_evidence_events").insert({
          event_type: "learning_plan_item_completed",
          owner_type: plan.owner_type,
          user_id: plan.user_id,
          child_id: plan.child_id,
          diagnostic_attempt_id: plan.diagnostic_attempt_id,
          learning_plan_id: plan.id,
          algorithm_version: plan.algorithm_version,
          input_summary: { item_id: item.id, kind: item.kind, skill_area: item.skill_area },
          output_summary: { status: "done" },
          metrics: { difficulty_level: item.difficulty_level, estimated_minutes: item.estimated_minutes },
          created_by: user!.id,
        });
      }
    } else if (status === "skipped") toast.success(t("plan.itemSkipped"));
    load();
  };

  if (authLoading) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return (
    <AppShell><DashboardShell>
      <div className="py-12 text-sm text-muted-foreground">{t("plan.denied")}</div>
    </DashboardShell></AppShell>
  );
  if (loading || !plan) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={plan.child_id ? `/parent/children/${plan.child_id}/knowledge` : "/dashboard"}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("plan.actions.back")}
            </Link>
          </Button>
        </div>

        <DashboardHeader
          title={plan.title}
          subtitle={`${plan.domain || "—"} • ${plan.level || "—"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              {plan.status === "draft" && (
                <Button onClick={activate} className="bg-accent-gradient text-accent-foreground" size="sm">
                  <Play className="h-4 w-4 mr-1" /> {t("plan.actions.activate")}
                </Button>
              )}
              {plan.status !== "archived" && (
                <Button onClick={archive} variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-1" /> {t("plan.actions.archive")}
                </Button>
              )}
            </div>
          }
        />

        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-[10px]">{t(`plan.status.${plan.status}`)}</Badge>
          <span className="text-[10px] text-muted-foreground">{t("plan.algoNote", { ver: plan.algorithm_version })}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <StatCard icon={ListChecks} label={t("plan.stepsCount")} value={String(stats.total)} />
          <StatCard icon={Clock} label={t("plan.totalTime")} value={`${stats.time} min`} />
          <StatCard icon={Brain} label={t("plan.weakAreasCovered")} value={String(stats.weakAreas)} />
          <StatCard icon={Sparkles} label={t("plan.diagnosticScore")} value={plan.evidence?.score != null ? `${Math.round(Number(plan.evidence.score) * 100)}%` : "—"} />
        </div>

        <ExpertReviewBadge reviewType="learning_plan" sourceId={plan.id} />

        <Surface className="p-5 mb-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("plan.whyTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-3">{t("plan.whyGenerated")}</p>
          {!!(plan.evidence?.weak_areas_used?.length) && (
            <div className="mb-2">
              <p className="text-xs font-medium mb-1">{t("evidence.weakAreas")}</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.evidence!.weak_areas_used!.map((a) => (
                  <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                ))}
              </div>
            </div>
          )}
          {!!(plan.evidence?.recommendations_used?.length) && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-1">{t("evidence.rationale")}</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {plan.evidence!.recommendations_used!.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </Surface>

        <CheckpointCta
          plan={plan}
          doneCount={stats.done}
          starting={startingCheckpoint}
          onStart={async () => {
            if (!plan) return;
            setStartingCheckpoint(true);
            try {
              const { data, error } = await supabase.functions.invoke("checkpoint-create", {
                body: { learning_plan_id: plan.id, trigger_reason: plan.status === "completed" ? "plan_completed" : "plan_progress" },
              });
              if (error) throw error;
              const d = data as { checkpoint_id?: string; error?: string };
              if (d?.error) throw new Error(d.error);
              if (!d.checkpoint_id) throw new Error("no_checkpoint_id");
              const base = plan.child_id ? `/parent/children/${plan.child_id}/diagnose` : "/diagnose";
              navigate(`${base}?checkpointId=${d.checkpoint_id}`);
            } catch (e) {
              toast.error((e as Error).message || t("checkpoint.finalizeError"));
            } finally {
              setStartingCheckpoint(false);
            }
          }}
        />

        <Surface className="p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4 text-accent" /> {t("plan.steps")}</h2>
            <span className="text-xs text-muted-foreground">{t("plan.progress", { done: stats.done, total: stats.total })}</span>
          </div>
          <Progress value={stats.total ? (stats.done / stats.total) * 100 : 0} className="mb-4" />
          <ol className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="rounded-md border bg-card-soft p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("plan.stepNumber", { n: it.order_index })}</span>
                      <Badge variant="secondary" className="text-[10px]">{t(`plan.kinds.${it.kind}`)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t(`plan.status.${it.status}`)}</Badge>
                      {it.skill_area && <span className="text-[10px] text-muted-foreground truncate">· {it.skill_area}</span>}
                    </div>
                    <p className="text-sm font-medium">{it.title}</p>
                    {it.rationale && <p className="text-xs text-muted-foreground mt-1">{it.rationale}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      {it.estimated_minutes != null && <span>{t("plan.estMinutes", { n: it.estimated_minutes })}</span>}
                      {it.difficulty_level != null && <span>{t("plan.difficulty", { n: it.difficulty_level })}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {it.status !== "done" && (
                      <Button size="sm" variant="outline" onClick={() => updateItem(it, "done")}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("plan.actions.markDone")}
                      </Button>
                    )}
                    {it.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => updateItem(it, "skipped")}>
                        <SkipForward className="h-3.5 w-3.5 mr-1" /> {t("plan.actions.skip")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Surface>

        <div className="mt-6">
          <FeedbackWidget contextType="learning_plan" contextId={plan?.id ?? null} childId={plan?.child_id ?? null} />
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground text-center">{t("plan.credibility")}</p>
      </DashboardShell>
    </AppShell>
  );
}

function CheckpointCta({ plan, doneCount, starting, onStart }: {
  plan: Plan;
  doneCount: number;
  starting: boolean;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const eligible = doneCount >= 3 || plan.status === "completed";
  return (
    <Surface className="p-5 mb-4 border-accent/30">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-accent" /> {t("checkpoint.checkProgress")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xl">
            {eligible ? t("checkpoint.checkProgressHelper") : t("checkpoint.notEligible")}
          </p>
        </div>
        <Button
          onClick={onStart}
          disabled={!eligible || starting}
          size="sm"
          className="bg-accent-gradient text-accent-foreground"
        >
          {starting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />}
          {starting ? t("checkpoint.starting") : t("checkpoint.checkProgress")}
        </Button>
      </div>
    </Surface>
  );
}

