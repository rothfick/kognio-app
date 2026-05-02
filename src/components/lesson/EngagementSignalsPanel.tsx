import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Props = { bookingId: string; liveSessionId: string | null; userId: string; targetUserId: string | null };
type Signal = { id: string; signal_type: string; label: string | null; confidence: number | null; created_at: string };

const TYPES = ["focus","confusion","frustration","boredom","satisfaction","engagement","participation","uncertainty"] as const;

/** Tutor-only engagement signals panel. Manual marking + behavioral inference left for v2. */
export function EngagementSignalsPanel({ bookingId, liveSessionId, userId, targetUserId }: Props) {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<Signal[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("lesson_engagement_signals")
      .select("id, signal_type, label, confidence, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (Array.isArray(data)) setSignals(data as Signal[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId]);

  const mark = async (signal_type: string) => {
    const { error } = await supabase.from("lesson_engagement_signals").insert({
      booking_id: bookingId, live_session_id: liveSessionId,
      target_user_id: targetUserId, observed_by_user_id: userId,
      signal_type, label: signal_type, confidence: 0.5, source: "manual_tutor",
    } as never);
    if (error) { toast.error(t("engagement.saveError")); return; }
    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "engagement_signal_recorded", owner_type: "user", user_id: userId,
        algorithm_version: "engagement_signals_v1",
        input_summary: { booking_id: bookingId, signal_type },
        output_summary: {}, metrics: {}, created_by: userId,
      } as never);
    } catch {/*non-blocking*/}
    load();
  };

  const latest = signals[0];

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-muted-foreground">
        {t("engagement.disclaimer")}
      </div>

      <div className="rounded-md border p-2">
        <p className="text-xs text-muted-foreground">{t("engagement.currentLabel")}</p>
        {latest
          ? <p className="text-sm font-medium">{t(`engagement.types.${latest.signal_type}`, { defaultValue: latest.signal_type })}{latest.confidence != null && ` · ${Math.round((latest.confidence||0)*100)}%`}</p>
          : <p className="text-xs text-muted-foreground">{t("engagement.noData")}</p>}
        {latest && <p className="text-[10px] text-muted-foreground mt-1">{t("engagement.lastUpdated")}: {new Date(latest.created_at).toLocaleTimeString()}</p>}
      </div>

      <div>
        <p className="text-xs font-medium mb-1">{t("engagement.mark")}</p>
        <div className="flex flex-wrap gap-1">
          {TYPES.map(ty => (
            <Button key={ty} size="sm" variant="outline" className="h-7 text-xs" onClick={() => mark(ty)}>
              {t(`engagement.types.${ty}`)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1">{t("engagement.timeline")}</p>
        <div className="max-h-[28vh] overflow-auto space-y-1 pr-1">
          {signals.length === 0
            ? <p className="text-xs text-muted-foreground">{t("engagement.noData")}</p>
            : signals.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                  <span>{t(`engagement.types.${s.signal_type}`, { defaultValue: s.signal_type })}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
        </div>
      </div>

      <Badge variant="secondary" className="text-[10px]">{t("engagement.tutorOnly")}</Badge>
    </div>
  );
}
