import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { BookOpen, Loader2, Sparkles, ExternalLink } from "lucide-react";

type Row = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  created_at: string;
  user_id: string | null;
  child_id: string | null;
  booking_id: string | null;
};

interface Props {
  /** When set, scope to one child (parent view). Otherwise current user_id is used implicitly via RLS. */
  childId?: string | null;
  /** When set, only assignments tied to bookings owned by this tutor (we just filter client-side). */
  tutorView?: boolean;
  title?: string;
  emptyHint?: string;
  showGenerate?: boolean;
  onGenerate?: () => void;
  generating?: boolean;
}

export function HomeworkWidget({
  childId, tutorView, title, emptyHint, showGenerate, onGenerate, generating,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("assignments")
        .select("id, title, status, due_at, created_at, user_id, child_id, booking_id")
        .order("created_at", { ascending: false })
        .limit(20);
      if (childId) q = q.eq("child_id", childId);
      const { data } = await q;
      if (cancelled) return;
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [childId]);

  const active = rows.filter((r) => ["assigned", "in_progress"].includes(r.status));
  const graded = rows.filter((r) => r.status === "graded");
  const needsReview = rows.filter((r) => r.status === "submitted");
  const next = active.find((r) => r.due_at) || active[0] || null;

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-accent" /> {title || t("dashboardHomework.title")}
        </h2>
        <div className="flex gap-2">
          {showGenerate && onGenerate && (
            <Button size="sm" onClick={onGenerate} disabled={!!generating} className="bg-accent-gradient text-accent-foreground">
              {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {t("dashboardHomework.generateCta")}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/homework"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />{t("dashboardHomework.openCta")}</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("dashboardHomework.emptyTitle")}
          description={emptyHint || t("dashboardHomework.emptyDesc")}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border bg-card-soft p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dashboardHomework.active")}</p>
              <p className="text-base font-semibold tabular-nums">{active.length}</p>
            </div>
            <div className="rounded-md border bg-card-soft p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dashboardHomework.graded")}</p>
              <p className="text-base font-semibold tabular-nums">{graded.length}</p>
            </div>
            <div className="rounded-md border bg-card-soft p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("dashboardHomework.needsReview")}</p>
              <p className="text-base font-semibold tabular-nums">{needsReview.length}</p>
            </div>
          </div>
          {next && (
            <div className="rounded-md border p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{next.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] mr-1.5">{t(`assignment.status.${next.status}`)}</Badge>
                  {next.due_at
                    ? `${t("dashboardHomework.nextDue")}: ${new Date(next.due_at).toLocaleDateString(lang)}`
                    : t("dashboardHomework.nextDueNone")}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/homework/${next.id}`}>{t("homework.openCta")}</Link>
              </Button>
            </div>
          )}
          {tutorView && needsReview.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{t("dashboardHomework.tutorNeedsReviewCount", { count: needsReview.length })}</p>
          )}
        </div>
      )}
    </Surface>
  );
}
