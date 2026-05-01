import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

type Assignment = {
  id: string; title: string; status: string; skill_area_label: string | null;
  source_type: string; owner_type: string; user_id: string | null; child_id: string | null;
};
type Item = {
  id: string; order_index: number; item_type: string; prompt: string;
  choices: string[]; correct_answer: unknown; explanation: string | null; points: number | null;
};
type Submission = {
  id: string; answers: Record<string, unknown>; score: number | null; max_score: number | null;
  percentage: number | null; status: string; feedback: Record<string, { correct: boolean | null; expected?: unknown; given: unknown }>;
};

export default function HomeworkDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("assignments")
        .select("id, title, status, skill_area_label, source_type, owner_type, user_id, child_id")
        .eq("id", id).maybeSingle();
      if (!a) { setNotFound(true); setLoading(false); return; }
      setAssignment(a as Assignment);
      const { data: it } = await supabase
        .from("assignment_items")
        .select("id, order_index, item_type, prompt, choices, correct_answer, explanation, points")
        .eq("assignment_id", id).order("order_index");
      setItems((it || []) as Item[]);
      const { data: sub } = await supabase
        .from("assignment_submissions")
        .select("id, answers, score, max_score, percentage, status, feedback")
        .eq("assignment_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setSubmission((sub as Submission | null) || null);
      setLoading(false);
    })();
  }, [user, id]);

  const submit = async () => {
    if (!id) return;
    if (Object.keys(answers).length === 0) { toast.error(t("homeworkToast.answerRequired")); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("homework-grade", {
        body: { assignment_id: id, answers },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error(t("homeworkToast.submitFailed"));
      } else {
        toast.success(t("homeworkToast.submitted"));
        // Reload
        navigate(0);
      }
    } finally { setSubmitting(false); }
  };

  if (loading) return <AppShell><DashboardShell><Surface className="p-6 h-40 animate-pulse" /></DashboardShell></AppShell>;
  if (notFound || !assignment) {
    return (
      <AppShell><DashboardShell>
        <Surface className="p-6">
          <EmptyState icon={AlertCircle} title={t("homework.notFound")} description="" />
          <div className="mt-3 text-center">
            <Button asChild variant="outline" size="sm"><Link to="/homework">{t("homework.notFoundCta")}</Link></Button>
          </div>
        </Surface>
      </DashboardShell></AppShell>
    );
  }

  const isGraded = !!submission;
  const fb = submission?.feedback || {};

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/homework"><ArrowLeft className="mr-1 h-4 w-4" /> {t("homework.back")}</Link>
          </Button>
        </div>
        <DashboardHeader
          title={assignment.title}
          subtitle={assignment.skill_area_label || ""}
        />
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{t(`assignment.status.${assignment.status}`)}</Badge>
          <Badge variant="outline" className="text-[10px]">{t(`assignment.source.${assignment.source_type}`)}</Badge>
          {isGraded && submission?.percentage !== null && (
            <Badge className="text-[10px] bg-accent text-accent-foreground">
              {t("homework.scoreLabel")}: {t("grading.percentage", { n: submission!.percentage })}
            </Badge>
          )}
          {submission?.status === "needs_review" && (
            <Badge variant="destructive" className="text-[10px]">{t("grading.needsReview")}</Badge>
          )}
        </div>

        {items.length === 0 ? (
          <Surface className="p-6"><p className="text-sm text-muted-foreground">{t("homework.noItems")}</p></Surface>
        ) : (
          <div className="space-y-4">
            {items.map((it, idx) => {
              const itemFb = fb[it.id];
              const correctness = itemFb?.correct;
              return (
                <Surface key={it.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("homework.questionLabel", { n: idx + 1 })} · {t(`assignment.item.${it.item_type}`)}
                    </p>
                    {isGraded && correctness === true && <CheckCircle2 className="h-4 w-4 text-accent" />}
                    {isGraded && correctness === false && <XCircle className="h-4 w-4 text-destructive" />}
                    {isGraded && correctness === null && <AlertCircle className="h-4 w-4 text-amber-600" />}
                  </div>
                  <p className="text-sm font-medium mb-3 whitespace-pre-line">{it.prompt}</p>

                  {it.item_type === "multiple_choice" && (
                    <div className="grid gap-2">
                      {(it.choices || []).map((c, ci) => {
                        const selected = (isGraded ? itemFb?.given : answers[it.id]) === c;
                        return (
                          <label key={ci} className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer ${selected ? "border-accent bg-accent/5" : ""}`}>
                            <input
                              type="radio"
                              name={it.id}
                              disabled={isGraded}
                              checked={selected}
                              onChange={() => setAnswers((a) => ({ ...a, [it.id]: c }))}
                            />
                            {c}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {it.item_type === "true_false" && (
                    <div className="flex gap-2">
                      {[true, false].map((v) => {
                        const selected = (isGraded ? itemFb?.given : answers[it.id]) === v;
                        return (
                          <Button
                            key={String(v)} type="button" size="sm"
                            variant={selected ? "default" : "outline"}
                            disabled={isGraded}
                            onClick={() => setAnswers((a) => ({ ...a, [it.id]: v }))}
                          >
                            {v ? t("homework.true") : t("homework.false")}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {it.item_type === "short_answer" && (
                    <Textarea
                      disabled={isGraded}
                      placeholder={t("homework.shortAnswerPlaceholder")}
                      value={String((isGraded ? itemFb?.given : answers[it.id]) ?? "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [it.id]: e.target.value }))}
                      rows={3}
                    />
                  )}

                  {isGraded && it.explanation && (
                    <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                      <p className="font-medium mb-1">{t("homework.explanation")}</p>
                      <p className="text-muted-foreground">{it.explanation}</p>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        )}

        {!isGraded && items.length > 0 && (
          <div className="mt-5 flex justify-end">
            <Button onClick={submit} disabled={submitting} className="bg-accent-gradient text-accent-foreground">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? t("homework.submittingCta") : t("homework.submitCta")}
            </Button>
          </div>
        )}
      </DashboardShell>
    </AppShell>
  );
}
