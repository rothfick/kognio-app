import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ConsentType =
  | "ai_diagnosis_notice"
  | "research_participation"
  | "parent_child_data_processing"
  | "expert_review_notice"
  | "terms_of_service"
  | "privacy_policy"
  | "lesson_recording_notice"
  | "lesson_transcription_notice"
  | "lesson_engagement_analysis_notice"
  | "ai_copilot_notice";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consentType: ConsentType;
  childId?: string | null;
  onAccepted?: () => void;
  onDeclined?: () => void;
  /** When true, declining is non-blocking (e.g. optional research consent) */
  optional?: boolean;
}

const CONSENT_VERSION = "v1";

export function ResearchConsentDialog({
  open,
  onOpenChange,
  consentType,
  childId,
  onAccepted,
  onDeclined,
  optional = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const title = t(`researchConsent.types.${consentType}.title`);
  const body = t(`researchConsent.types.${consentType}.body`);
  const details = t(`researchConsent.types.${consentType}.details`);

  const accept = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const payload = {
        user_id: childId ? null : user.id,
        child_id: childId ?? null,
        consent_type: consentType,
        consent_version: CONSENT_VERSION,
        status: "accepted" as const,
        accepted_at: new Date().toISOString(),
        content_snapshot: { lang: i18n.language, title, body },
      };
      const { error } = await supabase.from("consent_records").insert(payload as any);
      if (error) throw error;

      // Best-effort SMART evidence
      await supabase.from("smart_evidence_events").insert({
        event_type: "consent_accepted",
        owner_type: childId ? "parent_child" : "self",
        user_id: childId ? null : user.id,
        child_id: childId ?? null,
        algorithm_version: "consent_v1",
        input_summary: { consent_type: consentType, version: CONSENT_VERSION },
        output_summary: {},
        metrics: {},
        created_by: user.id,
      } as any);

      toast.success(t("researchConsent.toastAccepted"));
      onOpenChange(false);
      onAccepted?.();
    } catch (e: any) {
      toast.error(e.message ?? t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const decline = () => {
    onOpenChange(false);
    onDeclined?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{t("researchConsent.draftBadge")}</Badge>
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line pt-2">{body}</DialogDescription>
        </DialogHeader>

        {showDetails && (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3 max-h-60 overflow-auto whitespace-pre-line">
            {details}
            <p className="mt-3 italic">{t("researchConsent.legalDisclaimer")}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? t("researchConsent.hideDetails") : t("researchConsent.viewDetails")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={decline} disabled={submitting}>
              {optional ? t("researchConsent.notNow") : t("researchConsent.decline")}
            </Button>
            <Button onClick={accept} disabled={submitting}>
              {submitting ? t("common.saving") : t("researchConsent.accept")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
