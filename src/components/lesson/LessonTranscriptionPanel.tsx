import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Save, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  bookingId: string;
  liveSessionId: string | null;
  userId: string;
  speakerRole: "student" | "parent" | "tutor" | "admin" | "unknown";
  hasStudentConsent: boolean;
  isTutor: boolean;
};

type Snippet = { id: string; text: string; speaker_role: string; created_at: string };
type AnyRec = any;

/**
 * Lesson transcription panel using browser Web Speech API.
 * Saves final results to lesson_transcripts (booking-keyed) periodically.
 */
export function LessonTranscriptionPanel({
  bookingId, liveSessionId, userId, speakerRole, hasStudentConsent, isTutor,
}: Props) {
  const { t, i18n } = useTranslation();
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [recent, setRecent] = useState<Snippet[]>([]);
  const [saving, setSaving] = useState(false);
  const recRef = useRef<AnyRec>(null);
  const startMsRef = useRef<number>(Date.now());
  const restartTimer = useRef<number | null>(null);
  const manualStop = useRef(false);

  const language = (i18n.language || "pl").split("-")[0];

  // Load recent transcript snippets
  const loadRecent = async () => {
    const { data } = await supabase
      .from("lesson_transcripts")
      .select("id, text, speaker_role, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (Array.isArray(data)) setRecent(data.reverse() as Snippet[]);
  };

  useEffect(() => {
    loadRecent();
    const channel = supabase
      .channel(`lesson_transcripts:${bookingId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "lesson_transcripts", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as Snippet;
          setRecent((prev) => [...prev.slice(-19), row]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec: AnyRec = new SR();
    rec.lang = language === "en" ? "en-US" : language === "es" ? "es-ES" : "pl-PL";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = async (event: AnyRec) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = (r[0]?.transcript || "").trim();
        if (!text) continue;
        if (r.isFinal) {
          const now = Date.now();
          await supabase.from("lesson_transcripts").insert({
            booking_id: bookingId,
            live_session_id: liveSessionId,
            speaker_user_id: userId,
            speaker_role: speakerRole,
            text,
            start_ms: Math.max(0, now - startMsRef.current - 3000),
            end_ms: now - startMsRef.current,
            confidence: r[0]?.confidence ?? null,
            source: "browser_stt",
            language,
          } as never);
        } else {
          interimText += text + " ";
        }
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (e: AnyRec) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        toast.error(t("transcription.micDenied"));
        manualStop.current = true; setListening(false);
      }
    };
    rec.onend = () => {
      if (!manualStop.current) {
        restartTimer.current = window.setTimeout(() => { try { rec.start(); } catch {} }, 250);
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    return () => {
      manualStop.current = true;
      if (restartTimer.current) window.clearTimeout(restartTimer.current);
      try { rec.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, liveSessionId, userId, speakerRole, language]);

  const start = () => {
    if (!recRef.current) return;
    // If tutor recording student speech, require student consent
    if (isTutor && !hasStudentConsent) {
      toast.message(t("transcription.consentNeeded"));
    }
    manualStop.current = false;
    startMsRef.current = Date.now();
    try { recRef.current.start(); setListening(true); } catch {}
  };
  const stop = () => {
    manualStop.current = true;
    try { recRef.current?.stop(); } catch {}
    setListening(false); setInterim("");
  };
  const saveSnapshot = async () => {
    if (!interim.trim()) { toast.message(t("transcription.panelEmpty")); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("lesson_transcripts").insert({
        booking_id: bookingId, live_session_id: liveSessionId,
        speaker_user_id: userId, speaker_role: speakerRole,
        text: interim.trim(), source: "browser_stt", language,
      } as never);
      if (error) throw error;
      toast.success(t("transcription.saved"));
      setInterim("");
    } catch (e) {
      toast.error(t("transcription.saveError"));
    } finally { setSaving(false); }
  };

  if (!supported) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 text-accent shrink-0" />
        <p>{t("transcription.browserUnsupported")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full ${listening ? "bg-accent animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-xs">{listening ? t("transcription.listening") : t("transcription.idle")}</span>
        </div>
        <div className="flex gap-1">
          {listening
            ? <Button size="sm" variant="outline" onClick={stop}><MicOff className="h-4 w-4 mr-1" />{t("transcription.stop")}</Button>
            : <Button size="sm" onClick={start}><Mic className="h-4 w-4 mr-1" />{t("transcription.start")}</Button>}
          <Button size="sm" variant="ghost" onClick={saveSnapshot} disabled={saving || !interim.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {interim && <p className="text-xs italic text-muted-foreground break-words">{interim}</p>}
      <div className="max-h-[40vh] overflow-auto space-y-1.5 pr-1">
        {recent.length === 0
          ? <p className="text-xs text-muted-foreground">{t("transcription.panelEmpty")}</p>
          : recent.map((s) => (
              <div key={s.id} className="text-xs rounded-md bg-muted/50 px-2 py-1">
                <p className="text-[10px] text-muted-foreground">[{t(`transcription.speaker${s.speaker_role.charAt(0).toUpperCase()}${s.speaker_role.slice(1)}`, { defaultValue: s.speaker_role })}] · {new Date(s.created_at).toLocaleTimeString()}</p>
                <p className="break-words">{s.text}</p>
              </div>
            ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{t("transcription.sourceLabel")}: {t("transcription.sourceBrowserStt")}</p>
    </div>
  );
}
