import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Check } from "lucide-react";
import { toast } from "sonner";

type ContextType = "diagnosis" | "learning_plan" | "checkpoint" | "expert_review" | "onboarding" | "general";

interface Props {
  contextType: ContextType;
  contextId?: string | null;
  childId?: string | null;
  className?: string;
}

export function FeedbackWidget({ contextType, contextId, childId, className }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expand, setExpand] = useState(false);

  // Avoid duplicate submission per (user, context_id)
  useEffect(() => {
    if (!user || !contextId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_feedback")
        .select("id")
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setSubmitted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, contextId, contextType]);

  const submit = async () => {
    if (!user || rating == null) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: childId ? null : user.id,
        child_id: childId ?? null,
        context_type: contextType,
        context_id: contextId ?? null,
        rating,
        feedback_text: text.trim() || null,
      } as any);
      if (error) throw error;

      await supabase.from("smart_evidence_events").insert({
        event_type: "feedback_submitted",
        owner_type: childId ? "parent_child" : "self",
        user_id: childId ? null : user.id,
        child_id: childId ?? null,
        algorithm_version: "feedback_v1",
        input_summary: { context_type: contextType, has_text: !!text.trim() },
        output_summary: {},
        metrics: { rating },
        created_by: user.id,
      } as any);

      setSubmitted(true);
      toast.success(t("feedback.thanks"));
    } catch (e: any) {
      toast.error(e.message ?? t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Surface className={`p-4 flex items-center gap-2 text-sm text-muted-foreground ${className ?? ""}`}>
        <Check className="h-4 w-4 text-primary" />
        {t("feedback.alreadySubmitted")}
      </Surface>
    );
  }

  return (
    <Surface className={`p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">{t("feedback.prompt")}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover ?? rating ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  setRating(n);
                  setExpand(true);
                }}
                className="p-1 rounded hover:bg-muted/50 transition-colors"
              >
                <Star className={`h-5 w-5 ${active ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            );
          })}
        </div>
      </div>
      {expand && (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("feedback.placeholder")}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={submitting || rating == null}>
              {submitting ? t("common.saving") : t("feedback.send")}
            </Button>
          </div>
        </>
      )}
    </Surface>
  );
}
