import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, ExternalLink } from "lucide-react";

type ReviewType = "diagnostic" | "learning_plan" | "checkpoint";

type Props = {
  reviewType: ReviewType;
  /** ID of the source object (diagnostic_attempt / learning_plan / checkpoint) */
  sourceId: string | null | undefined;
  /** When true, show internal correction details (admin/reviewer view). */
  showInternal?: boolean;
};

type Review = {
  id: string;
  status: string;
  agreement_score: number | null;
  notes: string | null;
  submitted_at: string | null;
  algorithm_version: string;
  correction_summary: { agree?: number; partial?: number; disagree?: number; unsure?: number; correction_rate?: number | null } | null;
};

const COLUMN: Record<ReviewType, string> = {
  diagnostic: "diagnostic_attempt_id",
  learning_plan: "learning_plan_id",
  checkpoint: "checkpoint_id",
};

export function ExpertReviewBadge({ reviewType, sourceId, showInternal = false }: Props) {
  const { t } = useTranslation();
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!sourceId) return;
      const query = supabase
        .from("expert_reviews")
        .select("id, status, agreement_score, notes, submitted_at, algorithm_version, correction_summary")
        .eq("review_type", reviewType)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(1);
      // Apply the source filter using a runtime column name (typed as never to avoid deep instantiation)
      const filtered = (query as unknown as { eq: (c: string, v: string) => typeof query }).eq(COLUMN[reviewType], sourceId);
      const { data } = await filtered.maybeSingle();
      if (active && data) setReview(data as unknown as Review);
    })();
    return () => { active = false; };
  }, [reviewType, sourceId]);

  if (!review) return null;
  const score = review.agreement_score;
  const pct = score == null ? null : Math.round(score * 100);

  return (
    <Surface className="p-4 mb-4 border-accent/40">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">{t("expertReview.reviewedTitle")}</h3>
            <Badge variant="secondary" className="text-[10px]">{t(`expertReview.types.${reviewType}`)}</Badge>
            {pct !== null && (
              <Badge variant="outline" className="text-[10px]">
                {t("agreement.scoreLabel")}: {pct}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {review.submitted_at
              ? t("expertReview.submittedAt", { date: new Date(review.submitted_at).toLocaleDateString() })
              : t("expertReview.submitted")}
          </p>
          {review.notes && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{review.notes}</p>
          )}
          {showInternal && review.correction_summary && (
            <div className="text-[11px] text-muted-foreground mt-2 space-x-3">
              <span>{t("verdict.agree")}: {review.correction_summary.agree ?? 0}</span>
              <span>{t("verdict.partially_agree")}: {review.correction_summary.partial ?? 0}</span>
              <span>{t("verdict.disagree")}: {review.correction_summary.disagree ?? 0}</span>
              <span>{t("verdict.unsure")}: {review.correction_summary.unsure ?? 0}</span>
            </div>
          )}
          {showInternal && (
            <Link to={`/expert/reviews/${review.id}`} className="text-[11px] text-accent inline-flex items-center gap-1 mt-2">
              {t("expertReview.openReview")} <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </Surface>
  );
}
