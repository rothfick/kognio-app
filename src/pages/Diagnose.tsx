import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Brain, Target, ArrowRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { CurriculumPicker, type CurriculumSelection } from "@/components/diagnose/CurriculumPicker";
import { ExpertReviewBadge } from "@/components/expert-review/ExpertReviewBadge";
import { ResearchConsentDialog } from "@/components/pilot/ResearchConsentDialog";
import { FeedbackWidget } from "@/components/pilot/FeedbackWidget";
import { useConsent } from "@/hooks/useConsent";

type Choice = { id: string; text: string };
type Item = { id: string; question: string; choices: Choice[]; kc_label: string; difficulty: number };
type Summary = {
  overall_level: string;
  score_pct: number;
  strengths: string[];
  gaps: string[];
  kc_breakdown: { kc_label: string; mastery_pct: number; status: "mocna" | "stabilna" | "do_pracy" | "luka" }[];
  recommendations: string[];
  next_subject_suggestion?: string;
};

const LEVEL_IDS = [
  "sp_4_6", "sp_7_8", "lo_1_2", "lo_3_4", "matura_podst",
  "matura_rozsz", "studia_lic", "studia_mgr", "dorosly",
];

const TARGET = 12;

export default function Diagnose() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ childId?: string }>();
  const childId = params.childId ?? null;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkpointId = searchParams.get("checkpointId");

  const [phase, setPhase] = useState<"intake" | "running" | "done">("intake");
  const [domain, setDomain] = useState("");
  const [level, setLevel] = useState<string>("");
  const [taxonomy, setTaxonomy] = useState<CurriculumSelection>({});
  const [submitting, setSubmitting] = useState(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correct_choice: string } | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [score, setScore] = useState<{ pct: number; total: number; correct: number } | null>(null);

  // Checkpoint mode
  const [checkpointLoading, setCheckpointLoading] = useState<boolean>(!!checkpointId);
  const [checkpointDenied, setCheckpointDenied] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState(false);

  const domainSuggestions = t("diagnose.domainSuggestions", { returnObjects: true }) as string[];
  const levelLabel = useMemo(() => level ? t(`diagnose.levels.${level}`) : "", [level, t]);

  // Load checkpoint metadata + prefill from baseline diagnostic
  useEffect(() => {
    if (!checkpointId || !user) return;
    let cancelled = false;
    (async () => {
      const { data: cp, error } = await supabase
        .from("learning_checkpoints")
        .select("id, baseline_diagnostic_attempt_id, child_id, status")
        .eq("id", checkpointId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !cp) { setCheckpointDenied(true); setCheckpointLoading(false); return; }
      if (cp.baseline_diagnostic_attempt_id) {
        const { data: ba } = await supabase
          .from("diagnostic_attempts")
          .select("domain, level")
          .eq("id", cp.baseline_diagnostic_attempt_id)
          .maybeSingle();
        if (!cancelled && ba) {
          if (ba.domain) setDomain(ba.domain);
          // Best-effort match level to LEVEL_IDS by translated label
          if (ba.level) {
            const matchId = LEVEL_IDS.find((id) => t(`diagnose.levels.${id}`) === ba.level);
            if (matchId) setLevel(matchId);
          }
        }
      }
      setCheckpointLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpointId, user]);

  // After diagnostic completes in checkpoint mode, finalize and navigate
  const finalizeCheckpoint = useCallback(async (cpId: string, attempt: string) => {
    setFinalizing(true);
    setFinalizeError(false);
    try {
      const { data, error } = await supabase.functions.invoke("checkpoint-finalize", {
        body: { checkpoint_id: cpId, checkpoint_attempt_id: attempt },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      navigate(`/checkpoints/${cpId}`);
    } catch (e: any) {
      setFinalizeError(true);
      toast.error(e?.message || t("checkpoint.finalizeError"));
    } finally {
      setFinalizing(false);
    }
  }, [navigate, t]);

  const aiConsentType = childId ? "parent_child_data_processing" : "ai_diagnosis_notice";
  const { hasConsent: hasAiConsent, refresh: refreshConsent } = useConsent(aiConsentType, childId);
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const start = useCallback(async () => {
    if (!hasAiConsent) {
      setPendingStart(true);
      setConsentOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const lang = i18n.language?.split("-")[0] || "pl";
      const localizedDomain = (d: typeof taxonomy.domain) => d ? ((lang === "en" ? d.name_en : lang === "es" ? d.name_es : d.name_pl) || d.name_pl) : "";
      const localizedLevel = (lv: typeof taxonomy.level) => lv ? ((lang === "en" ? lv.name_en : lang === "es" ? lv.name_es : lv.name_pl) || lv.name_pl) : "";
      const effectiveDomain = (domain.trim() || localizedDomain(taxonomy.domain)).trim();
      const effectiveLevel = level ? levelLabel : localizedLevel(taxonomy.level);
      if (!effectiveDomain) return toast.error(t("diagnose.missingDomain"));
      if (!effectiveLevel) return toast.error(t("diagnose.missingLevel"));
      const { data, error } = await supabase.functions.invoke("diagnostic-adaptive", {
        body: {
          action: "start",
          domain: effectiveDomain,
          level: effectiveLevel,
          language: lang,
          target_questions: TARGET,
          taxonomy: {
            system_code: taxonomy.system?.code,
            level_code: taxonomy.level?.code,
            domain_code: taxonomy.domain?.code,
          },
          ...(childId ? { child_id: childId } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAttemptId((data as any).attempt_id);
      setItem((data as any).item);
      setQuestionIdx(1);
      setPhase("running");
    } catch (e: any) {
      toast.error(e?.message || t("diagnose.startError"));
    } finally {
      setSubmitting(false);
    }
  }, [domain, level, levelLabel, taxonomy, childId, i18n.language, t, hasAiConsent]);

  const submit = useCallback(async () => {
    if (!attemptId || !item) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-adaptive", {
        body: {
          action: "next",
          attempt_id: attemptId,
          item_id: item.id,
          selected_choice: selected === "__skip__" ? null : selected,
          target_questions: TARGET,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setFeedback(d.last ?? null);
      // brief feedback flash, then advance
      setTimeout(() => {
        setFeedback(null);
        if (d.done) {
          setSummary(d.summary);
          setScore({ pct: d.score_pct, total: d.total, correct: d.correct });
          setPhase("done");
        } else {
          setItem(d.item);
          setQuestionIdx(d.question_index);
          setSelected(null);
        }
      }, 700);
    } catch (e: any) {
      toast.error(e?.message || t("diagnose.submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, item, selected, t]);

  // Auto-finalize when checkpoint mode and diagnosis just completed
  useEffect(() => {
    if (phase === "done" && checkpointId && attemptId && !finalizing && !finalizeError) {
      finalizeCheckpoint(checkpointId, attemptId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, checkpointId, attemptId]);

  if (authLoading) {
    return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (checkpointId && checkpointDenied) {
    return <AppShell><DashboardShell><div className="py-12 text-sm text-muted-foreground">{t("checkpoint.denied")}</div></DashboardShell></AppShell>;
  }
  if (checkpointId && checkpointLoading) {
    return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("checkpoint.starting")}</div></AppShell>;
  }

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={childId ? `/parent/children/${childId}/knowledge` : "/dashboard"}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("diagnose.back")}
            </Link>
          </Button>
        </div>

        {checkpointId && (
          <Surface variant="ai" className="p-4 mb-4 border-accent/40">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{t("checkpoint.modeBadge")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t("checkpoint.modeNote")}</p>
              </div>
            </div>
          </Surface>
        )}

        {phase === "intake" && (
          <>
            <DashboardHeader
              title={childId ? t("diagnose.titleChild") : t("diagnose.title")}
              subtitle={t("diagnose.subtitle")}
            />
            <Surface className="p-6 max-w-2xl space-y-5">
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("diagnoseTaxonomy.useTaxonomy")}</p>
                <CurriculumPicker onChange={setTaxonomy} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{t("diagnoseTaxonomy.useFreeText")}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("diagnose.domainLabel")}</label>
                <Input
                  placeholder={t("diagnose.domainPlaceholder")}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  maxLength={120}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {domainSuggestions.slice(0, 12).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDomain(s)}
                      className="text-[11px] rounded-full border px-2.5 py-1 hover:bg-muted text-muted-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("diagnose.levelLabel")}</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {LEVEL_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLevel(id)}
                      className={`text-left text-sm rounded-md border px-3 py-2 transition-colors ${
                        level === id ? "border-accent bg-accent/10" : "hover:bg-muted"
                      }`}
                    >
                      {t(`diagnose.levels.${id}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={start}
                  disabled={submitting || (!domain.trim() && !taxonomy.domain) || (!level && !taxonomy.level)}
                  size="lg"
                  className="bg-accent-gradient text-accent-foreground shadow-glow"
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {t("diagnose.start")}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-3">
                  {t("diagnose.intakeNote")}
                </p>
              </div>
            </Surface>
          </>
        )}

        {phase === "running" && item && (
          <>
            <DashboardHeader
              title={t("diagnose.runningTitle", { domain })}
              subtitle={t("diagnose.runningSubtitle", { level: levelLabel, current: questionIdx, total: TARGET })}
            />
            <Surface className="p-5 mb-4">
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <span>{t("diagnose.progress")}</span>
                <Badge variant="secondary" className="text-[10px]">{t("diagnose.adaptive")}</Badge>
              </div>
              <Progress value={(questionIdx / TARGET) * 100} />
            </Surface>

            <Surface className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[11px] text-muted-foreground">{item.kc_label}</p>
                  <Badge variant="outline" className="text-[10px]">{t("diagnose.difficulty", { n: item.difficulty })}</Badge>
                </div>
                <h2 className="text-base font-semibold whitespace-pre-wrap">{item.question}</h2>
              </div>

              <div className="grid gap-2">
                {item.choices.map((c) => {
                  const isFeedbackCorrect = feedback && c.id === feedback.correct_choice;
                  const isFeedbackWrong = feedback && selected === c.id && !feedback.correct;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !feedback && setSelected(c.id)}
                      disabled={!!feedback || submitting}
                      className={`text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                        isFeedbackCorrect ? "border-green-500 bg-green-500/10"
                          : isFeedbackWrong ? "border-destructive bg-destructive/10"
                          : selected === c.id ? "border-accent bg-accent/10"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-mono text-xs mr-2 text-muted-foreground">{c.id}.</span>
                      {c.text}
                    </button>
                  );
                })}
                <button
                  onClick={() => !feedback && setSelected("__skip__")}
                  disabled={!!feedback || submitting}
                  className={`text-left rounded-md border border-dashed px-4 py-2 text-xs text-muted-foreground transition-colors ${
                    selected === "__skip__" ? "border-accent bg-accent/10" : "hover:bg-muted"
                  }`}
                >
                  {t("diagnose.skip")}
                </button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={submit}
                  disabled={selected === null || submitting || !!feedback}
                  className="bg-accent-gradient text-accent-foreground"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {questionIdx === TARGET ? t("diagnose.finish") : t("diagnose.next")}
                  {!submitting && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </Surface>
          </>
        )}

        {phase === "done" && summary && score && checkpointId && (
          <>
            <DashboardHeader title={t("checkpoint.modeBadge")} subtitle={t("checkpoint.reportSubtitle")} />
            <Surface className="p-6 max-w-2xl">
              {finalizing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("checkpoint.starting")}
                </div>
              )}
              {finalizeError && (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">{t("checkpoint.finalizeError")}</p>
                  <Button
                    size="sm"
                    onClick={() => attemptId && finalizeCheckpoint(checkpointId, attemptId)}
                    className="bg-accent-gradient text-accent-foreground"
                  >
                    {t("checkpoint.retryFinalize")}
                  </Button>
                </div>
              )}
            </Surface>
          </>
        )}

        {phase === "done" && summary && score && !checkpointId && (
          <>
            <DashboardHeader title={t("diagnose.resultTitle")} subtitle={`${domain} • ${levelLabel}`} />

            <ExpertReviewBadge reviewType="diagnostic" sourceId={attemptId} />

            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <Surface className="p-5 md:col-span-1">
                <p className="text-xs text-muted-foreground">{t("diagnose.overallScore")}</p>
                <p className="text-3xl font-bold">{score.pct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{t("diagnose.correctOf", { correct: score.correct, total: score.total })}</p>
                <Badge className="mt-3" variant="secondary">{t("diagnose.level", { level: summary.overall_level })}</Badge>
              </Surface>

              <Surface className="p-5 md:col-span-2">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("diagnose.recommendations")}</h3>
                <ul className="space-y-1.5 text-sm list-disc pl-5">
                  {summary.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                {summary.next_subject_suggestion && (
                  <p className="text-xs text-muted-foreground mt-3">{t("diagnose.nextSubject", { subject: summary.next_subject_suggestion })}</p>
                )}
              </Surface>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <Surface className="p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> {t("diagnose.strengths")}
                </h3>
                {summary.strengths.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("diagnose.noStrengths")}</p>
                ) : (
                  <ul className="space-y-1 text-sm list-disc pl-5">{summary.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                )}
              </Surface>
              <Surface className="p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-destructive" /> {t("diagnose.gaps")}
                </h3>
                {summary.gaps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("diagnose.noGaps")}</p>
                ) : (
                  <ul className="space-y-1 text-sm list-disc pl-5">{summary.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                )}
              </Surface>
            </div>

            <Surface className="p-5 mb-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Brain className="h-4 w-4 text-accent" /> {t("diagnose.competenceMap")}</h3>
              <TraceabilityList attemptId={attemptId} childId={childId} kcBreakdown={summary.kc_breakdown} />
            </Surface>

            <PlanCta attemptId={attemptId} childId={childId} language={i18n.language} />

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-accent-gradient text-accent-foreground">
                <Link to="/discover"><Target className="h-4 w-4 mr-1" /> {t("diagnose.findTutor")}</Link>
              </Button>
              <Button variant="outline" onClick={() => { setPhase("intake"); setSummary(null); setScore(null); setItem(null); setAttemptId(null); }}>
                {t("diagnose.anotherDiagnosis")}
              </Button>
              {childId && (
                <Button asChild variant="outline">
                  <Link to={`/parent/children/${childId}/knowledge`}><Brain className="h-4 w-4 mr-1" /> {t("diagnose.childKnowledgeMap")}</Link>
                </Button>
              )}
            </div>

            <div className="mt-4">
              <FeedbackWidget contextType="diagnosis" contextId={attemptId} childId={childId} />
            </div>
          </>
        )}

        <ResearchConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          consentType={aiConsentType as any}
          childId={childId}
          onAccepted={async () => {
            await refreshConsent();
            if (pendingStart) {
              setPendingStart(false);
              // Re-trigger after consent
              setTimeout(() => start(), 50);
            }
          }}
          onDeclined={() => {
            setPendingStart(false);
            toast.info(t("consent.requiredAiDiagnosis"));
          }}
        />
      </DashboardShell>
    </AppShell>
  );
}

function PlanCta({ attemptId, childId, language }: { attemptId: string | null; childId: string | null; language: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      const { data } = await supabase
        .from("learning_plans")
        .select("id")
        .eq("diagnostic_attempt_id", attemptId)
        .maybeSingle();
      setPlanId(data?.id ?? null);
      setLoading(false);
    })();
  }, [attemptId]);

  const generate = async () => {
    if (!attemptId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("learning-plan-generate", {
        body: { attempt_id: attemptId, language: language?.split("-")[0] || "pl" },
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

  if (loading) return null;

  return (
    <Surface className="p-5 mb-4">
      <div className="flex items-start gap-3 flex-wrap justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-accent" /> {planId ? t("plan.viewCta") : t("plan.generateCta")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xl">{t("plan.generateHelper")}</p>
        </div>
        {planId ? (
          <Button asChild className="bg-accent-gradient text-accent-foreground" size="sm">
            <Link to={`/plans/${planId}`}>{t("plan.viewCta")}</Link>
          </Button>
        ) : (
          <Button onClick={generate} disabled={generating} className="bg-accent-gradient text-accent-foreground" size="sm">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {generating ? t("plan.generating") : t("plan.generateCta")}
          </Button>
        )}
      </div>
    </Surface>
  );
}

type TraceRow = {
  skill_area_label: string | null;
  competency_id: string | null;
  mastery_prob: number;
  evidence?: { match_confidence?: number; match_reason?: string; status?: string } | null;
};
type CompLite = { id: string; name_pl: string; name_en: string | null; name_es: string | null };

function TraceabilityList({
  attemptId, childId, kcBreakdown,
}: {
  attemptId: string | null;
  childId: string | null;
  kcBreakdown: { kc_label: string; mastery_pct: number; status: string }[];
}) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [comps, setComps] = useState<Record<string, CompLite>>({});

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      let trace: TraceRow[] = [];
      if (childId) {
        const { data } = await supabase
          .from("child_kc_mastery")
          .select("skill_area_label, competency_id, mastery_prob, evidence")
          .eq("child_id", childId)
          .order("last_updated", { ascending: false });
        trace = (data || []) as TraceRow[];
      } else {
        const { data } = await supabase
          .from("user_competency_mastery")
          .select("skill_area_label, competency_id, mastery_prob, evidence")
          .order("last_updated", { ascending: false });
        trace = (data || []) as TraceRow[];
      }
      setRows(trace);
      const ids = Array.from(new Set(trace.map((r) => r.competency_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: cs } = await supabase.from("competencies").select("id, name_pl, name_en, name_es").in("id", ids);
        const map: Record<string, CompLite> = {};
        (cs || []).forEach((c: any) => { map[c.id] = c; });
        setComps(map);
      }
    })();
  }, [attemptId, childId]);

  const byLabel = new Map<string, TraceRow>();
  rows.forEach((r) => { if (r.skill_area_label) byLabel.set(r.skill_area_label.toLowerCase(), r); });
  const compName = (c: CompLite) => (lang === "en" ? c.name_en : lang === "es" ? c.name_es : c.name_pl) || c.name_pl;

  return (
    <div className="space-y-2">
      {kcBreakdown.map((k, i) => {
        const tr = byLabel.get(k.kc_label.toLowerCase());
        const comp = tr?.competency_id ? comps[tr.competency_id] : null;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-sm flex-1 truncate">{k.kc_label}</span>
              <div className="w-32"><Progress value={k.mastery_pct} /></div>
              <span className="text-xs text-muted-foreground w-10 text-right">{k.mastery_pct}%</span>
              <Badge variant="outline" className={`text-[10px] ${
                k.status === "mocna" ? "border-green-500 text-green-600"
                : k.status === "luka" ? "border-destructive text-destructive"
                : k.status === "do_pracy" ? "border-amber-500 text-amber-600" : ""
              }`}>
                {t(`diagnose.status.${k.status}`, { defaultValue: k.status.replace("_", " ") })}
              </Badge>
            </div>
            <div className="pl-1 text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
              {comp ? (
                <span><span className="font-medium">{t("traceability.mappedCompetency")}:</span> {compName(comp)}</span>
              ) : (
                <span>{t("traceability.aiSkillArea")}</span>
              )}
              {tr?.evidence?.match_reason && tr.evidence.match_reason !== "no_match" && tr.evidence.match_reason !== "no_candidates" && (
                <span>· {t(tr.evidence.match_reason === "exact_match" ? "traceability.matchExact" : "traceability.matchContains")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
