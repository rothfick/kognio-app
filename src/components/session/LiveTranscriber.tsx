import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  sessionId: string;
  userId: string;
  speakerLabel?: string;
};

// Web Speech API typings (browser-only, prefixed)
type AnySpeechRecognition = any;

export const LiveTranscriber = ({ sessionId, userId, speakerLabel }: Props) => {
  const { t, i18n } = useTranslation();
  const resolvedSpeakerLabel = speakerLabel || t("session.me");
  const [supported, setSupported] = useState<boolean>(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<AnySpeechRecognition | null>(null);
  const startMsRef = useRef<number>(Date.now());
  const restartTimerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec: AnySpeechRecognition = new SR();
    rec.lang = i18n.language?.startsWith("en") ? "en-US" : i18n.language?.startsWith("es") ? "es-ES" : "pl-PL";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = async (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          const now = Date.now();
          const startsMs = Math.max(0, now - startMsRef.current - 3000);
          const endsMs = now - startMsRef.current;
          const { error } = await supabase.from("session_transcripts").insert({
            session_id: sessionId,
            speaker_id: userId,
            speaker_label: resolvedSpeakerLabel,
            text,
            starts_at_ms: startsMs,
            ends_at_ms: endsMs,
          });
          if (error) console.error("transcript insert", error);
        } else {
          interimText += text + " ";
        }
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (e: any) => {
      console.warn("SpeechRecognition error", e?.error);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        toast.error(t("session.micDenied"));
        setListening(false);
        manualStopRef.current = true;
      }
    };

    rec.onend = () => {
      // Auto-restart unless user stopped
      if (!manualStopRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          try {
            rec.start();
          } catch {}
        }, 250);
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;

    return () => {
      manualStopRef.current = true;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      try { rec.stop(); } catch {}
    };
  }, [sessionId, userId, resolvedSpeakerLabel, i18n.language, t]);

  const start = () => {
    if (!recRef.current) return;
    manualStopRef.current = false;
    startMsRef.current = Date.now();
    try {
      recRef.current.start();
      setListening(true);
      toast.success(t("session.transcriptionOn"));
    } catch (e: any) {
      // Already started
      console.warn(e);
    }
  };

  const stop = () => {
    manualStopRef.current = true;
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setInterim("");
    toast.message(t("session.transcriptionOffToast"));
  };

  if (!supported) {
    return (
      <Card className="p-3 bg-background border-dashed">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 text-accent" />
          <p>
            {t("session.speechUnsupported")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-background flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            listening ? "bg-accent animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium">
            {listening ? t("session.listening") : t("session.autoOff")}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {interim || t("session.autoHint")}
          </p>
        </div>
      </div>
      {listening ? (
        <Button size="sm" variant="outline" onClick={stop}>
          <MicOff className="h-4 w-4 mr-2" /> {t("common.stop")}
        </Button>
      ) : (
        <Button size="sm" onClick={start}>
          <Mic className="h-4 w-4 mr-2" /> {t("common.start")}
        </Button>
      )}
    </Card>
  );
};
