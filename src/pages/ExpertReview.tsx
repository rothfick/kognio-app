import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BadgeCheck, Send, Loader2, Sparkles, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

type Verdict = "pending" | "agree" | "partially_agree" | "disagree" | "unsure";
type ReviewType = "diagnostic" | "learning_plan" | "checkpoint";

type Review = {
  id: string;
  review_type: ReviewType;
  owner_type: "user" | "child";
  user_id: string | null;
  child_id: string | null;
  diagnostic_attempt_id: string | null;
  learning_plan_id: string | null;
  checkpoint_id: string | null;
  reviewer_id: string;
  reviewer_role: string;
  status: "draft" | "submitted" | "archived";
  ai_summary: Record<string, unknown>;
  notes: string | null;
  algorithm_version: string;
  agreement_score: number | null;
  correction_summary: Record<string, unknown> | null;
  created_at: string;
  submitted_at: string | null;
};

type ReviewItem = {
  id: string;
  expert_review_id: string;
  item_type: string;
  competency_id: string | null;
  skill_area_label: string | null;
  ai_value: Record<string, unknown>;
  expert_value: Record<string, unknown>;
  verdict: Verdict;
  confidence: number | null;
  correction_note: string | null;
};

const VERDICTS: Verdict[] = ["pending", "agree", "partially_agree", "disagree", "unsure"];

function shortId(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "—";
}

function sourceLink(r: Review): { to: string; labelKey: string } | null {
  if (r.diagnostic_attempt_id) return { to: r.child_id ? `/parent/children/${r.child_id}/knowledge` : "/dashboard", labelKey: "expertReview.sourceDiagnostic" };
  if (r.learning_plan_id) return { to: `/plans/${r.learning_plan_id}`, labelKey: "expertReview.sourceLearningPlan" };
  if (r.checkpoint_id) return { to: `/checkpoints/${r.checkpoint_id}`, labelKey: "expertReview.sourceCheckpoint" };
  return null;
}

export default function ExpertReview() {
  const { t } = useTranslation();
  const { reviewId } = useParams<{ reviewId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [review, setReview] = useState<Review | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !reviewId) return;
    setLoading(true);
    const { data: r, error } = await supabase
      .from("expert_reviews")
      .select("*")
      .eq("id", reviewId)
      .maybeSingle();
    if (error || !r) { setDenied(true); setLoading(false); return; }
    const review = r as unknown as Review;
    setReview(review);
    setNotes(review.notes ?? "");
    const { data: its } = await supabase
      .from("expert_review_items")
      .select("*")
      .eq("expert_review_id", reviewId)
      .order("created_at", { ascending: true });
    setItems((its || []) as unknown as ReviewItem[]);
    setLoading(false);
  }, [user, reviewId]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { agree: 0, partial: 0, disagree: 0, unsure: 0, pending: 0 };
    for (const it of items) {
      if (it.verdict === "agree") c.agree++;
      else if (it.verdict === "partially_agree") c.partial++;
      else if (it.verdict === "disagree") c.disagree++;
      else if (it.verdict === "unsure") c.unsure++;
      else c.pending++;
    }
    return c;
  }, [items]);

  const computedAgreement = useMemo(() => {
    const denom = counts.agree + counts.partial + counts.disagree;
    if (denom === 0) return null;
    return (counts.agree * 1 + counts.partial * 0.5) / denom;
  }, [counts]);

  const updateItem = async (item: ReviewItem, patch: Partial<ReviewItem>) => {
    setSavingItemId(item.id);
    const { error } = await supabase.from("expert_review_items").update(patch).eq("id", item.id);
    setSavingItemId(null);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
  };

  const saveNotes = async () => {
    if (!review) return;
    const { error } = await supabase.from("expert_reviews").update({ notes }).eq("id", review.id);
    if (error) toast.error(error.message);
    else toast.success(t("common.saved", { defaultValue: "Saved" }));
  };

  const submit = async () => {
    if (!review || !user) return;
    setSubmitting(true);
    try {
      const denom = counts.agree + counts.partial + counts.disagree;
      const score = denom === 0 ? null : (counts.agree + 0.5 * counts.partial) / denom;
      const decided = counts.agree + counts.partial + counts.disagree + counts.unsure;
      const correction_rate = decided === 0 ? null : (counts.partial + counts.disagree) / decided;
      const correction_summary = {
        agree: counts.agree,
        partial: counts.partial,
        disagree: counts.disagree,
        unsure: counts.unsure,
        pending: counts.pending,
        correction_rate,
      };
      const { error } = await supabase
        .from("expert_reviews")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          agreement_score: score,
          correction_summary,
          notes,
        })
        .eq("id", review.id);
      if (error) throw error;

      // SMART evidence
      await supabase.from("smart_evidence_events").insert({
        event_type: "expert_review_submitted",
        owner_type: review.owner_type,
        user_id: review.user_id,
        child_id: review.child_id,
        diagnostic_attempt_id: review.diagnostic_attempt_id,
        learning_plan_id: review.learning_plan_id,
        algorithm_version: review.algorithm_version,
        input_summary: {
          review_id: review.id,
          review_type: review.review_type,
          diagnostic_attempt_id: review.diagnostic_attempt_id,
          learning_plan_id: review.learning_plan_id,
          checkpoint_id: review.checkpoint_id,
          item_count: items.length,
        },
        output_summary: {
          agreement_score: score,
          agree_count: counts.agree,
          partial_count: counts.partial,
          disagree_count: counts.disagree,
          unsure_count: counts.unsure,
        },
        metrics: {
          ai_expert_agreement: score,
          correction_rate,
        },
        created_by: user.id,
      });

      toast.success(t("expertReview.submitted"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return (
    <AppShell><DashboardShell>
      <div className="py-12 text-sm text-muted-foreground">{t("expertReview.denied")}</div>
    </DashboardShell></AppShell>
  );
  if (loading || !review) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;

  const isReviewer = review.reviewer_id === user.id;
  const readOnly = review.status !== "draft" || !isReviewer;
  const src = sourceLink(review);

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> {t("expertReview.back")}</Link>
          </Button>
        </div>

        <DashboardHeader
          title={t("expertReview.workspaceTitle")}
          subtitle={t(`expertReview.types.${review.review_type}`)}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary" className="text-[10px]">{t(`expertReview.status.${review.status}`)}</Badge>
              <Badge variant="outline" className="text-[10px]">{t(`reviewer.role.${review.reviewer_role || "expert"}`, { defaultValue: review.reviewer_role || "expert" })}</Badge>
              <span className="text-[10px] text-muted-foreground">{review.algorithm_version}</span>
            </div>
          }
        />

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4 flex-wrap">
          <span>{t("expertReview.ownerType")}: {t(`expertReview.owner.${review.owner_type}`)}</span>
          {src && (
            <Link to={src.to} className="text-accent inline-flex items-center gap-1">{t(src.labelKey)} →</Link>
          )}
          <span>· {t("expertReview.created", { date: new Date(review.created_at).toLocaleString() })}</span>
        </div>

        <Surface className="p-5 mb-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("expertReview.aiSummaryTitle")}</h2>
          <pre className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 overflow-auto max-h-60 whitespace-pre-wrap break-words">
{JSON.stringify(review.ai_summary, null, 2)}
          </pre>
        </Surface>

        <Surface className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-accent" /> {t("expertReview.itemsTitle")}</h2>
            <div className="text-[11px] text-muted-foreground space-x-3">
              <span>{t("verdict.agree")}: {counts.agree}</span>
              <span>{t("verdict.partially_agree")}: {counts.partial}</span>
              <span>{t("verdict.disagree")}: {counts.disagree}</span>
              <span>{t("verdict.unsure")}: {counts.unsure}</span>
              <span>{t("verdict.pending")}: {counts.pending}</span>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("expertReview.noItems")}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="rounded-md border bg-card-soft p-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{t(`expertReview.itemType.${it.item_type}`, { defaultValue: it.item_type })}</Badge>
                    {it.skill_area_label && <span className="text-xs font-medium">{it.skill_area_label}</span>}
                    {savingItemId === it.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">{t("expertReview.aiValue")}</p>
                      <pre className="text-[11px] bg-muted/30 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">
{JSON.stringify(it.ai_value, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">{t("expertReview.verdictLabel")}</p>
                        <Select
                          value={it.verdict}
                          disabled={readOnly}
                          onValueChange={(v) => updateItem(it, { verdict: v as Verdict })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VERDICTS.map((v) => (
                              <SelectItem key={v} value={v} className="text-xs">{t(`verdict.${v}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">{t("expertReview.confidence")}</p>
                        <Input
                          type="number" step="0.1" min="0" max="1"
                          disabled={readOnly}
                          value={it.confidence ?? ""}
                          onChange={(e) => updateItem(it, { confidence: e.target.value === "" ? null : Number(e.target.value) })}
                          className="h-8 text-xs"
                          placeholder="0.0 – 1.0"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">{t("expertReview.correctionNote")}</p>
                        <Textarea
                          rows={2}
                          disabled={readOnly}
                          value={it.correction_note ?? ""}
                          onChange={(e) => updateItem(it, { correction_note: e.target.value })}
                          className="text-xs"
                          placeholder={t("expertReview.correctionNotePlaceholder")}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="p-5 mb-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent" /> {t("expertReview.notesTitle")}</h2>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
            placeholder={t("expertReview.notesPlaceholder")}
          />
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <p className="text-[11px] text-muted-foreground">
              {t("agreement.computed")}: {computedAgreement === null ? "—" : `${Math.round(computedAgreement * 100)}%`}
            </p>
            <div className="flex gap-2">
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={saveNotes}>
                  {t("expertReview.saveNotes")}
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="sm"
                  className="bg-accent-gradient text-accent-foreground"
                  onClick={submit}
                  disabled={submitting || counts.pending === items.length}
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  {t("expertReview.submit")}
                </Button>
              )}
            </div>
          </div>
        </Surface>

        <Surface className="p-5 mb-6 border-accent/40">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> {t("expertReview.evidenceTitle")}</h2>
          <ul className="text-xs text-muted-foreground space-y-1 font-mono">
            <li>{t("expertReview.evidenceReview")}: {shortId(review.id)}</li>
            <li>{t("expertReview.evidenceDiagnostic")}: {shortId(review.diagnostic_attempt_id)}</li>
            <li>{t("expertReview.evidencePlan")}: {shortId(review.learning_plan_id)}</li>
            <li>{t("expertReview.evidenceCheckpoint")}: {shortId(review.checkpoint_id)}</li>
            <li>{t("expertReview.evidenceAlgorithm")}: {review.algorithm_version}</li>
          </ul>
        </Surface>

        <p className="mt-6 text-[11px] text-muted-foreground text-center">{t("expertReview.credibility")}</p>
      </DashboardShell>
    </AppShell>
  );
}
