import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Target, Brain } from "lucide-react";
import { toast } from "sonner";

const SUBJECT_CODE = "math_7_9";

type Choice = { id: string; text: string };
type Item = {
  id: string;
  kc_id: string;
  question: string;
  choices: Choice[];
  correct_choice: string;
  explanation: string | null;
};
type Child = { id: string; display_name: string; parent_id: string };
type Attempt = {
  id: string;
  status: string;
  total_items: number;
  correct_items: number;
  score: number | null;
};

const ChildDiagnostic = () => {
  const { t } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<Child | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [responses, setResponses] = useState<Record<string, { selected: string | null; correct: boolean }>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [completed, setCompleted] = useState(false);
  const [kcMap, setKcMap] = useState<Record<string, string>>({}); // kc_id -> name

  const init = useCallback(async () => {
    if (!user || !childId) return;
    setLoading(true);

    const { data: c } = await supabase
      .from("parent_children")
      .select("id, display_name, parent_id")
      .eq("id", childId)
      .maybeSingle();
    if (!c) { setDenied(true); setLoading(false); return; }
    if (c.parent_id !== user.id && !isAdmin) { setDenied(true); setLoading(false); return; }
    setChild(c as Child);

    const { data: subj } = await supabase
      .from("subjects").select("id").eq("code", SUBJECT_CODE).maybeSingle();
    if (!subj) { toast.error(t("diagnose.noQuestions")); setLoading(false); return; }
    setSubjectId(subj.id);

    const { data: rawItems } = await supabase
      .from("diagnostic_items")
      .select("id, kc_id, question, choices, correct_choice, explanation, difficulty_level")
      .eq("subject_id", subj.id)
      .eq("is_active", true)
      .eq("approved_by_admin", true)
      .order("difficulty_level")
      .order("code");
    const itemsTyped = ((rawItems || []) as any[]).map((r) => ({
      id: r.id, kc_id: r.kc_id, question: r.question,
      choices: r.choices as Choice[], correct_choice: r.correct_choice,
      explanation: r.explanation,
    })) as Item[];
    setItems(itemsTyped);

    // Build kc name map
    const kcIds = Array.from(new Set(itemsTyped.map((i) => i.kc_id)));
    if (kcIds.length) {
      const { data: kcs } = await supabase
        .from("knowledge_components")
        .select("id, name_pl")
        .in("id", kcIds);
      const map: Record<string, string> = {};
      (kcs || []).forEach((k: any) => { map[k.id] = k.name_pl; });
      setKcMap(map);
    }

    // Find or create in-progress attempt
    const { data: existing } = await supabase
      .from("diagnostic_attempts")
      .select("id, status, total_items, correct_items, score")
      .eq("child_id", childId)
      .eq("subject_id", subj.id)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let a: Attempt | null = existing as Attempt | null;
    if (!a) {
      const { data: created, error } = await supabase
        .from("diagnostic_attempts")
        .insert({
          child_id: childId,
          subject_id: subj.id,
          started_by: user.id,
          status: "in_progress",
        })
        .select("id, status, total_items, correct_items, score")
        .single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      a = created as Attempt;
    }
    setAttempt(a);

    // Load existing responses
    const { data: rs } = await supabase
      .from("diagnostic_responses")
      .select("item_id, selected_choice, is_correct")
      .eq("attempt_id", a.id);
    const respMap: Record<string, { selected: string | null; correct: boolean }> = {};
    (rs || []).forEach((r: any) => {
      respMap[r.item_id] = { selected: r.selected_choice, correct: !!r.is_correct };
    });
    setResponses(respMap);

    // Find first unanswered item
    const firstUn = itemsTyped.findIndex((it) => !respMap[it.id]);
    setCurrentIdx(firstUn === -1 ? itemsTyped.length : firstUn);
    setQuestionStartedAt(Date.now());
    setLoading(false);
  }, [user, childId, isAdmin]);

  useEffect(() => { init(); }, [init]);

  const currentItem = items[currentIdx];
  const progress = items.length === 0 ? 0 : (Object.keys(responses).length / items.length) * 100;

  async function submitAnswer() {
    if (!attempt || !currentItem) return;
    setSubmitting(true);
    try {
      const isCorrect = selected !== null && selected === currentItem.correct_choice;
      const time_ms = Date.now() - questionStartedAt;
      const { error } = await supabase
        .from("diagnostic_responses")
        .insert({
          attempt_id: attempt.id,
          item_id: currentItem.id,
          selected_choice: selected,
          is_correct: isCorrect,
          time_ms,
        });
      if (error) throw error;
      setResponses((prev) => ({ ...prev, [currentItem.id]: { selected, correct: isCorrect } }));
      setSelected(null);

      const nextIdx = currentIdx + 1;
      if (nextIdx >= items.length) {
        await completeAttempt({ ...responses, [currentItem.id]: { selected, correct: isCorrect } });
      } else {
        setCurrentIdx(nextIdx);
        setQuestionStartedAt(Date.now());
      }
    } catch (e: any) {
      toast.error(e.message || t("diagnose.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function completeAttempt(allResp: Record<string, { selected: string | null; correct: boolean }>) {
    if (!attempt || !childId) return;
    const total = items.length;
    const correct = Object.values(allResp).filter((r) => r.correct).length;
    const score = total ? correct / total : 0;

    const { error: aErr } = await supabase
      .from("diagnostic_attempts")
      .update({
        status: "completed",
        total_items: total,
        correct_items: correct,
        score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    if (aErr) { toast.error(aErr.message); return; }

    // Aggregate per KC
    const perKc: Record<string, { total: number; correct: number }> = {};
    for (const it of items) {
      const r = allResp[it.id];
      if (!r) continue;
      perKc[it.kc_id] = perKc[it.kc_id] || { total: 0, correct: 0 };
      perKc[it.kc_id].total += 1;
      if (r.correct) perKc[it.kc_id].correct += 1;
    }

    const upserts = Object.entries(perKc).map(([kc_id, v]) => ({
      child_id: childId,
      kc_id,
      mastery_prob: v.total ? v.correct / v.total : 0,
      confidence: Math.min(1, v.total / 3),
      source: "diagnostic_v1",
      evidence: {
        attempt_id: attempt.id,
        total_items: v.total,
        correct_items: v.correct,
        updated_from: "diagnostic_v1",
      },
      last_updated: new Date().toISOString(),
    }));

    // Upsert one-by-one to avoid constraint surprises (no unique on (child_id,kc_id) declared)
    for (const u of upserts) {
      const { data: existing } = await supabase
        .from("child_kc_mastery")
        .select("id")
        .eq("child_id", u.child_id)
        .eq("kc_id", u.kc_id)
        .maybeSingle();
      if (existing) {
        await supabase.from("child_kc_mastery")
          .update({
            mastery_prob: u.mastery_prob,
            confidence: u.confidence,
            source: u.source,
            evidence: u.evidence,
            last_updated: u.last_updated,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("child_kc_mastery").insert(u);
      }
    }

    setAttempt({ ...attempt, status: "completed", total_items: total, correct_items: correct, score });
    setCompleted(true);
    toast.success(t("diagnose.completedToast"));
  }

  if (authLoading || rolesLoading) {
    return <AppShell><div className="container py-12 text-muted-foreground text-sm">{t("common.loading")}</div></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return <Navigate to="/dashboard/parent" replace />;

  // RESULT VIEW
  if (completed || (attempt?.status === "completed")) {
    return <ResultView attempt={attempt!} items={items} responses={responses} kcMap={kcMap} childId={childId!} childName={child?.display_name} />;
  }

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/parent/children/${childId}/knowledge`}><ArrowLeft className="h-4 w-4 mr-1" /> {t("diagnose.backToKnowledge")}</Link>
          </Button>
        </div>

        <DashboardHeader
          title={child ? t("diagnose.initialTitleNamed", { name: child.display_name }) : t("diagnose.initialTitle")}
          subtitle={t("diagnose.initialSubtitle")}
        />

        <Surface className="p-5 mb-4">
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>{t("diagnose.progress")}: {Object.keys(responses).length} / {items.length}</span>
            <Badge variant="secondary" className="text-[10px]">{t("diagnose.v1Badge")}</Badge>
          </div>
          <Progress value={progress} />
        </Surface>

        {loading ? (
          <Surface className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></Surface>
        ) : items.length === 0 ? (
          <Surface className="p-6 text-sm text-muted-foreground">{t("diagnose.noQuestions")}</Surface>
        ) : currentItem ? (
          <Surface className="p-6 space-y-5">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">{kcMap[currentItem.kc_id]}</p>
              <h2 className="text-base font-semibold">{currentItem.question}</h2>
            </div>
            <div className="grid gap-2">
              {currentItem.choices.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                    selected === c.id ? "border-accent bg-accent/10" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-mono text-xs mr-2 text-muted-foreground">{c.id}.</span>
                  {c.text}
                </button>
              ))}
              <button
                onClick={() => setSelected("__skip__")}
                className={`text-left rounded-md border border-dashed px-4 py-2 text-xs text-muted-foreground transition-colors ${
                  selected === "__skip__" ? "border-accent bg-accent/10" : "hover:bg-muted"
                }`}
              >
                {t("diagnose.skipShort")}
              </button>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  // map __skip__ to null
                  if (selected === "__skip__") setSelected(null);
                  setTimeout(submitAnswer, 0);
                }}
                disabled={selected === null || submitting}
                className="bg-accent-gradient text-accent-foreground"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {currentIdx + 1 === items.length ? t("diagnose.finish") : t("diagnose.next")}
              </Button>
            </div>
          </Surface>
        ) : (
          <Surface className="p-6">
            <p className="text-sm">{t("diagnose.allAnswered")}</p>
            <Button className="mt-3" onClick={() => completeAttempt(responses)}>{t("diagnose.finish")}</Button>
          </Surface>
        )}

        <p className="mt-6 text-[11px] text-muted-foreground text-center">
          {t("diagnose.deterministicNote")}
        </p>
      </DashboardShell>
    </AppShell>
  );
};

function ResultView({
  attempt, items, responses, kcMap, childId, childName,
}: {
  attempt: Attempt; items: Item[]; responses: Record<string, { selected: string | null; correct: boolean }>;
  kcMap: Record<string, string>; childId: string; childName?: string;
}) {
  const { t } = useTranslation();
  // Per KC summary from current responses (or from items if responses empty -> reload case)
  const perKc = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {};
    for (const it of items) {
      const r = responses[it.id];
      if (!r) continue;
      map[it.kc_id] = map[it.kc_id] || { total: 0, correct: 0 };
      map[it.kc_id].total += 1;
      if (r.correct) map[it.kc_id].correct += 1;
    }
    return map;
  }, [items, responses]);

  const rows = Object.entries(perKc).map(([kcId, v]) => ({
    kcId, name: kcMap[kcId] || "—", ratio: v.total ? v.correct / v.total : 0, total: v.total, correct: v.correct,
  }));
  const strengths = rows.filter((r) => r.ratio >= 0.75).sort((a, b) => b.ratio - a.ratio);
  const gaps = rows.filter((r) => r.ratio < 0.5).sort((a, b) => a.ratio - b.ratio);
  const score = attempt.score ?? (attempt.total_items ? attempt.correct_items / attempt.total_items : 0);

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("diagnose.resultTitleNamed", { name: childName ? ` — ${childName}` : "" })}
          subtitle={t("diagnose.resultSubtitleV1")}
        />

        <Surface className="p-6 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("diagnose.overallScore")}</p>
              <p className="text-3xl font-bold">{Math.round(score * 100)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{t("diagnose.correctOf", { correct: attempt.correct_items, total: attempt.total_items })}</p>
            </div>
            <Badge variant="secondary">{t("diagnose.v1Badge")}</Badge>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <Surface className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-accent" /> {t("diagnose.strengths")}
            </h3>
            {strengths.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("diagnose.noStrongKc")}</p>
            ) : (
              <ul className="space-y-1.5">
                {strengths.map((r) => (
                  <li key={r.kcId} className="flex justify-between text-sm">
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">{Math.round(r.ratio * 100)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
          <Surface className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-destructive" /> {t("diagnose.catchUpAreas")}
            </h3>
            {gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("diagnose.noLowGaps")}</p>
            ) : (
              <ul className="space-y-1.5">
                {gaps.map((r) => (
                  <li key={r.kcId} className="flex justify-between text-sm">
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">{Math.round(r.ratio * 100)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${childId}/knowledge`}><Brain className="h-4 w-4 mr-1" /> {t("parent.child.viewMap")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/parent/children/${childId}/knowledge`}><Target className="h-4 w-4 mr-1" /> {t("diagnose.addLearningGoal")}</Link>
          </Button>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground text-center">
          {t("diagnose.v1AiLaterNote")}
        </p>
      </DashboardShell>
    </AppShell>
  );
}

export default ChildDiagnostic;
