import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { MasteryBadge } from "@/components/ui/mastery-badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Brain, Plus, Target, Loader2, Archive, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Child = { id: string; display_name: string; grade_level: string | null; primary_subject: string | null };
type KC = { id: string; code: string; name_pl: string; parent_kc_id: string | null; order_index: number };
type Mastery = { kc_id: string; mastery_prob: number; source: string | null; last_updated: string | null; evidence?: { kc_label?: string; status?: string } | null };
type Goal = { id: string; title: string; description: string | null; target_date: string | null; status: string; created_at: string };
type LatestAttempt = { id: string; status: string; score: number | null; correct_items: number; total_items: number; completed_at: string | null; summary?: { kc_breakdown?: { kc_label: string; mastery_pct: number; status: string }[] } | null };

const SUBJECT_CODE = "math_7_9";

function masteryLevel(p: number | undefined): "unknown" | "novice" | "developing" | "proficient" | "mastered" {
  if (p === undefined) return "unknown";
  if (p < 0.25) return "novice";
  if (p < 0.5) return "developing";
  if (p < 0.8) return "proficient";
  return "mastered";
}

const ChildKnowledge = () => {
  const { t } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [child, setChild] = useState<Child | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [groups, setGroups] = useState<KC[]>([]);
  const [kcs, setKcs] = useState<KC[]>([]);
  const [mastery, setMastery] = useState<Record<string, Mastery>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [latestAttempt, setLatestAttempt] = useState<LatestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user || !childId) return;
    setLoading(true);

    // Child (RLS: only owner parent or admin can read parent_children)
    const { data: c, error: cErr } = await supabase
      .from("parent_children")
      .select("id, display_name, grade_level, primary_subject, parent_id")
      .eq("id", childId)
      .maybeSingle();
    if (cErr || !c) { setDenied(true); setLoading(false); return; }
    if (c.parent_id !== user.id && !isAdmin) { setDenied(true); setLoading(false); return; }
    setChild({ id: c.id, display_name: c.display_name, grade_level: c.grade_level, primary_subject: c.primary_subject });

    // Subject
    const { data: subj } = await supabase
      .from("subjects").select("id").eq("code", SUBJECT_CODE).maybeSingle();
    if (!subj) { setLoading(false); return; }
    setSubjectId(subj.id);

    // KCs (groups + children)
    const { data: allKcs } = await supabase
      .from("knowledge_components")
      .select("id, code, name_pl, parent_kc_id, order_index")
      .eq("subject_id", subj.id)
      .eq("is_active", true)
      .order("order_index");
    const list = (allKcs || []) as KC[];
    setGroups(list.filter((k) => !k.parent_kc_id));
    setKcs(list.filter((k) => k.parent_kc_id));

    // Mastery
    const { data: m } = await supabase
      .from("child_kc_mastery")
      .select("kc_id, mastery_prob, source, last_updated, evidence")
      .eq("child_id", childId);
    const map: Record<string, Mastery> = {};
    (m as Mastery[] | null)?.forEach((r) => { map[r.kc_id] = r; });
    setMastery(map);

    // Latest completed attempt
    const { data: la } = await supabase
      .from("diagnostic_attempts")
      .select("id, status, score, correct_items, total_items, completed_at, summary")
      .eq("child_id", childId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestAttempt((la as LatestAttempt) || null);

    // Goals
    const { data: g } = await supabase
      .from("learning_goals")
      .select("id, title, description, target_date, status, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    setGoals((g || []) as Goal[]);

    setLoading(false);
  }, [user, childId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (authLoading || rolesLoading) {
    return <AppShell><div className="container py-12 text-muted-foreground text-sm">{t("common.loading")}</div></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return <Navigate to="/dashboard/parent" replace />;

  const trackedCount = Object.keys(mastery).length;
  const dynamicRows = (latestAttempt?.summary?.kc_breakdown || []).map((row) => ({
    label: row.kc_label,
    mastery: Math.max(0, Math.min(1, Number(row.mastery_pct || 0) / 100)),
    source: "diagnostic_ai_adaptive",
  }));
  const syntheticRows = Object.values(mastery)
    .filter((m) => !kcs.some((kc) => kc.id === m.kc_id) && m.evidence?.kc_label)
    .map((m) => ({ label: m.evidence!.kc_label!, mastery: Number(m.mastery_prob), source: m.source || "diagnostic_ai_adaptive" }));
  const fallbackRows = dynamicRows.length ? dynamicRows : syntheticRows;
  const effectiveTrackedCount = trackedCount || fallbackRows.length;
  const avgMastery = trackedCount === 0
    ? (fallbackRows.length ? fallbackRows.reduce((a, b) => a + b.mastery, 0) / fallbackRows.length : 0)
    : Object.values(mastery).reduce((a, b) => a + Number(b.mastery_prob), 0) / trackedCount;
  const hasDiagnostic = !!latestAttempt;

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/parent"><ArrowLeft className="h-4 w-4 mr-1" /> {t("knowledge.back")}</Link>
          </Button>
        </div>

        <DashboardHeader
          title={child ? t("knowledge.titleNamed", { name: child.display_name }) : t("knowledge.title")}
          subtitle={t("knowledge.subtitle")}
          actions={
            <Button asChild className="bg-accent-gradient text-accent-foreground" size="sm">
              <Link to={`/parent/children/${childId}/diagnose`}>
                <Sparkles className="h-4 w-4 mr-1" /> {hasDiagnostic ? t("knowledge.redo") : t("knowledge.doDiagnosis")}
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <StatCard icon={BookOpen} label={t("knowledge.kcCount")} value={String(kcs.length)} hint={t("knowledge.kcCountHint")} />
          <StatCard icon={Brain} label={t("knowledge.trackedKc")} value={String(effectiveTrackedCount)} hint={effectiveTrackedCount ? t("knowledge.trackedAfter") : t("knowledge.trackedNone")} />
          <StatCard icon={Target} label={t("knowledge.avgLevel")} value={effectiveTrackedCount ? `${Math.round(avgMastery * 100)}%` : "—"} hint={t("knowledge.avgHint")} />
        </div>

        {!hasDiagnostic ? (
          <AIInsightCard title={t("knowledge.promptTitle")} className="mb-6">
            <p className="mb-3">
              {t("knowledge.promptBody")}
            </p>
            <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
              <Link to={`/parent/children/${childId}/diagnose`}>
                <Sparkles className="h-4 w-4 mr-1" /> {t("knowledge.doDiagnosis")}
              </Link>
            </Button>
          </AIInsightCard>
        ) : (
          <AIInsightCard title={t("knowledge.doneTitle")} className="mb-6">
            <p>
              <span dangerouslySetInnerHTML={{ __html: t("knowledge.doneBody", { score: Math.round((latestAttempt!.score ?? 0) * 100), correct: latestAttempt!.correct_items, total: latestAttempt!.total_items }) }} />
            </p>
          </AIInsightCard>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("knowledge.loadingMap")}</p>
        ) : groups.length === 0 && fallbackRows.length === 0 ? (
          <EmptyState icon={BookOpen} title={t("knowledge.noProgramTitle")} description={t("knowledge.noProgramDesc")} />
        ) : (
          <div className="space-y-5 mb-8">
            {/* Curriculum map: official KCs + mapped AI areas */}
            {groups.length > 0 && groups.map((g) => {
              const childKcs = kcs.filter((k) => k.parent_kc_id === g.id);
              return (
                <Surface key={g.id} className="p-5">
                  <h2 className="font-semibold mb-3 text-base">{t("traceability.curriculumMap")} · {g.name_pl}</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {childKcs.map((k) => {
                      const mr = mastery[k.id];
                      return (
                        <li key={k.id} className="flex items-center justify-between gap-3 rounded-md border bg-card-soft px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{k.name_pl}</p>
                            {mr?.source && (
                              <p className="text-[10px] text-muted-foreground">
                                {mr.source}{mr.last_updated ? ` · ${new Date(mr.last_updated).toLocaleDateString("pl-PL")}` : ""}
                              </p>
                            )}
                          </div>
                          <MasteryBadge level={masteryLevel(mr ? Number(mr.mastery_prob) : undefined)} />
                        </li>
                      );
                    })}
                  </ul>
                </Surface>
              );
            })}

            {/* AI-detected areas (unmapped) */}
            {fallbackRows.length > 0 && (
              <Surface className="p-5">
                <h2 className="font-semibold mb-1 text-base">{t("traceability.aiDetectedAreas")}</h2>
                <p className="text-[11px] text-muted-foreground mb-3">{t("traceability.aiAreaNoteChild")}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {fallbackRows.map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-3 rounded-md border bg-card-soft px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{row.label}</p>
                        <p className="text-[10px] text-muted-foreground">{t("knowledge.sourceAiDiagnosis")}</p>
                      </div>
                      <MasteryBadge level={masteryLevel(row.mastery)} />
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </div>
        )}

        {latestAttempt && (
          <ChildPlanCard childId={childId!} attemptId={latestAttempt.id} />
        )}

        <ChildCheckpointCard childId={childId!} />

        <GoalsSection
          childId={childId!}
          subjectId={subjectId}
          goals={goals}
          createdById={user.id}
          onChange={load}
        />

        <p className="mt-8 text-[11px] text-muted-foreground text-center">
          {t("knowledge.footerNote")}
        </p>
      </DashboardShell>
    </AppShell>
  );
};

function GoalsSection({
  childId, subjectId, goals, createdById, onChange,
}: {
  childId: string; subjectId: string | null; goals: Goal[]; createdById: string; onChange: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error(t("knowledge.missingTitle")); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("learning_goals").insert({
        child_id: childId,
        subject_id: subjectId,
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
        status: "active",
        created_by: createdById,
      });
      if (error) throw error;
      toast.success(t("knowledge.goalAdded"));
      setTitle(""); setDescription(""); setTargetDate("");
      setOpen(false);
      onChange();
    } catch (err: any) {
      toast.error(err.message || t("knowledge.goalAddFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    const { error } = await supabase.from("learning_goals").update({ status: "archived" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("knowledge.goalArchived")); onChange(); }
  };

  const active = goals.filter((g) => g.status === "active");

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-accent" /> {t("knowledge.goalsTitle")}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent-gradient text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> {t("knowledge.addGoal")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("knowledge.newGoal")}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-title">{t("knowledge.goalTitle")}</Label>
                <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("knowledge.goalTitlePlaceholder")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-desc">{t("knowledge.goalDesc")}</Label>
                <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-date">{t("knowledge.goalDate")}</Label>
                <Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("knowledge.cancel")}</Button>
                <Button type="submit" disabled={submitting} className="bg-accent-gradient text-accent-foreground">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t("knowledge.saveGoal")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={Target} title={t("knowledge.noGoalsTitle")} description={t("knowledge.noGoalsDesc")} />
      ) : (
        <ul className="space-y-2">
          {active.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-3 rounded-md border bg-card-soft px-3 py-3">
              <div>
                <p className="text-sm font-medium">{g.title}</p>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                {g.target_date && <p className="text-[11px] text-muted-foreground mt-1">{t("knowledge.deadline", { date: g.target_date })}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => archive(g.id)}>
                <Archive className="h-4 w-4 mr-1" /> {t("knowledge.archive")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function ChildPlanCard({ childId, attemptId }: { childId: string; attemptId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("learning_plans")
        .select("id, status")
        .eq("child_id", childId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlanId((data as { id?: string } | null)?.id ?? null);
      setPlanStatus((data as { status?: string } | null)?.status ?? null);
      setLoading(false);
    })();
  }, [childId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("learning-plan-generate", {
        body: { attempt_id: attemptId, language: i18n.language?.split("-")[0] || "pl" },
      });
      if (error) throw error;
      const id = (data as { plan_id?: string })?.plan_id;
      if (!id) throw new Error("no plan id");
      toast.success(t("plan.generated"));
      navigate(`/plans/${id}`);
    } catch (e) {
      toast.error((e as Error).message || t("plan.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Surface className="p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-2 text-base mb-1">
            <Sparkles className="h-4 w-4 text-accent" /> {t("plan.title")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            {planId ? t("plan.whyGenerated") : t("plan.generateHelper")}
          </p>
        </div>
        {loading ? null : planId ? (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/plans/${planId}`}>
              {t("plan.viewCta")}{planStatus ? ` · ${t(`plan.status.${planStatus}`)}` : ""}
            </Link>
          </Button>
        ) : (
          <Button onClick={generate} disabled={generating} size="sm" className="bg-accent-gradient text-accent-foreground">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {generating ? t("plan.generating") : t("plan.generateCta")}
          </Button>
        )}
      </div>
    </Surface>
  );
}

export default ChildKnowledge;
