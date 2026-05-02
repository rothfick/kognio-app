import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Sparkles, CheckCircle2, Save, BookOpen, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

type Audience = "tutor" | "student" | "parent";

type Summary = {
  id: string;
  audience: Audience | string;
  status: string;
  markdown: string | null;
  approved_at: string | null;
  approved_by_tutor: string | null;
  updated_at: string;
};

type Props = {
  bookingId: string;
  liveSessionId: string | null;
  isTutor: boolean;
  studentUserId: string;
  parentUserId: string | null;
  /** parent-side child id used for child-owned flashcards */
  childId: string | null;
  /** competency for plan update */
  competencyId: string | null;
};

export function LessonSummaryPanel({
  bookingId, liveSessionId, isTutor, studentUserId, parentUserId, childId, competencyId,
}: Props) {
  const { t } = useTranslation();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"generate" | "save" | "approve" | "flash" | "plan" | null>(null);
  const [audience, setAudience] = useState<Audience>(isTutor ? "tutor" : "student");
  const [editText, setEditText] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lesson_summaries")
      .select("id, audience, status, markdown, approved_at, approved_by_tutor, updated_at")
      .eq("booking_id", bookingId)
      .order("updated_at", { ascending: false });
    setSummaries((data ?? []) as Summary[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId]);

  const current = summaries.find(s => s.audience === audience) ?? null;
  useEffect(() => { setEditText(current?.markdown ?? ""); }, [current?.id]);

  // Filter by visibility for non-tutors
  const visibleAudiences: Audience[] = isTutor
    ? ["tutor", "student", "parent"]
    : ["student", "parent"];

  const generate = async () => {
    setBusy("generate");
    try {
      const { error } = await supabase.functions.invoke("lesson-summary-generate", {
        body: { booking_id: bookingId, live_session_id: liveSessionId },
      });
      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        toast.error(status === 429 ? t("copilot.rateLimited") : status === 402 ? t("copilot.noCredits") : t("lessonSummary.generationError"));
        return;
      }
      toast.success(t("lessonSummary.readyToast"));
      await load();
    } catch {
      toast.error(t("lessonSummary.generationError"));
    } finally { setBusy(null); }
  };

  const saveEdit = async () => {
    if (!current || !isTutor) return;
    setBusy("save");
    try {
      const { error } = await supabase
        .from("lesson_summaries")
        .update({ markdown: editText })
        .eq("id", current.id);
      if (error) throw error;
      toast.success(t("lessonSummary.saved"));
      await load();
    } catch {
      toast.error(t("common.error"));
    } finally { setBusy(null); }
  };

  const approve = async () => {
    if (!current || !isTutor) return;
    setBusy("approve");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("lesson_summaries")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_tutor: user?.id ?? null,
          markdown: editText,
        })
        .eq("id", current.id);
      if (error) throw error;

      // Notify learner / parent for shared audiences
      if (current.audience === "student") {
        await createNotification({
          userId: studentUserId, type: "lesson_summary_ready",
          title: t("notif.lessonSummary.title"), body: t("notif.lessonSummary.body"),
          actionLabel: t("notif.lessonSummary.action"), actionUrl: `/session/${bookingId}`,
          severity: "info",
        });
      } else if (current.audience === "parent" && parentUserId) {
        await createNotification({
          userId: parentUserId, type: "lesson_summary_ready",
          title: t("notif.lessonSummary.title"), body: t("notif.lessonSummary.body"),
          actionLabel: t("notif.lessonSummary.action"), actionUrl: `/session/${bookingId}`,
          severity: "info",
        });
      }
      toast.success(t("lessonSummary.approvedToast"));
      await load();
    } catch {
      toast.error(t("common.error"));
    } finally { setBusy(null); }
  };

  const generateFlashcards = async () => {
    setBusy("flash");
    try {
      const { error } = await supabase.functions.invoke("lesson-flashcards-generate", {
        body: { booking_id: bookingId, owner_type: childId ? "child" : "user", child_id: childId },
      });
      if (error) throw error;
      toast.success(t("flashcards.readyToast"));
    } catch {
      toast.error(t("flashcards.generationError"));
    } finally { setBusy(null); }
  };

  const updatePlan = async () => {
    setBusy("plan");
    try {
      const { error } = await supabase.functions.invoke("lesson-plan-update", {
        body: { booking_id: bookingId, competency_id: competencyId, owner_type: childId ? "child" : "user", child_id: childId },
      });
      if (error) throw error;
      toast.success(t("postLesson.planUpdatedToast"));
    } catch {
      toast.error(t("postLesson.planUpdateError"));
    } finally { setBusy(null); }
  };

  if (loading) {
    return <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // Non-tutor: only show approved
  const isApproved = current?.status === "approved";
  const canShowToLearner = !isTutor && current && isApproved;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={audience} onValueChange={(v) => setAudience(v as Audience)}>
          <TabsList className="h-8">
            {visibleAudiences.map(a => (
              <TabsTrigger key={a} value={a} className="h-7 text-xs">
                {t(`lessonSummary.audience${a.charAt(0).toUpperCase()}${a.slice(1)}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {current && (
          <Badge variant={isApproved ? "default" : "outline"} className="text-[10px]">
            {isApproved ? t("lessonSummary.statusApproved") : t("lessonSummary.statusDraft")}
          </Badge>
        )}
      </div>

      {!current && isTutor && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{t("lessonSummary.empty")}</div>
      )}
      {!current && !isTutor && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{t("lessonSummary.pendingApprovalForStudent")}</div>
      )}

      {current && !isTutor && !isApproved && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{t("lessonSummary.pendingApprovalForStudent")}</div>
      )}

      {current && (isTutor || canShowToLearner) && (
        isTutor ? (
          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={10} className="text-xs font-mono" />
        ) : (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs max-h-[40vh] overflow-auto">
            {current.markdown}
          </div>
        )
      )}

      {isTutor && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={generate} disabled={busy !== null}>
            {busy === "generate" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {current ? t("lessonSummary.generate") : t("lessonSummary.generate")}
          </Button>
          {current && (
            <>
              <Button size="sm" variant="outline" onClick={saveEdit} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {t("lessonSummary.save")}
              </Button>
              {!isApproved && (
                <Button size="sm" variant="default" onClick={approve} disabled={busy !== null}>
                  {busy === "approve" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {t("lessonSummary.approve")}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {isTutor && (
        <div className="border-t pt-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{t("postLesson.tutorActions")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={generateFlashcards} disabled={busy !== null}>
              {busy === "flash" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
              {t("postLesson.generateFlashcards")}
            </Button>
            <Button size="sm" variant="outline" onClick={updatePlan} disabled={busy !== null}>
              {busy === "plan" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ListChecks className="h-4 w-4 mr-1" />}
              {t("postLesson.updatePlan")}
            </Button>
          </div>
        </div>
      )}

      {!isTutor && (
        <div className="border-t pt-3 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{t("postLesson.learnerActions")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="outline">
              <a href="/flashcards"><BookOpen className="h-4 w-4 mr-1" />{t("postLesson.viewFlashcards")}</a>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("lessonIntel.disclaimerNotDiagnosis")}</p>
        </div>
      )}
    </div>
  );
}
