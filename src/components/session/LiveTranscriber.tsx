import { useEffect, useRef, useState } from "react";
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

export const LiveTranscriber = ({ sessionId, userId, speakerLabel = "Ja" }: Props) => {
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
    rec.lang = navigator.language?.startsWith("en") ? "en-US" : "pl-PL";
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
            speaker_label: speakerLabel,
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
        toast.error("Brak dostępu do mikrofonu");
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
  }, [sessionId, userId, speakerLabel]);

  const start = () => {
    if (!recRef.current) return;
    manualStopRef.current = false;
    startMsRef.current = Date.now();
    try {
      recRef.current.start();
      setListening(true);
      toast.success("Transkrypcja włączona");
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
    toast.message("Transkrypcja zatrzymana");
  };

  if (!supported) {
    return (
      <Card className="p-3 bg-background border-dashed">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 text-accent" />
          <p>
            Twoja przeglądarka nie obsługuje rozpoznawania mowy w przeglądarce.
            Użyj Chrome lub Edge, albo dodawaj notatki ręcznie poniżej.
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
            {listening ? "Słucham…" : "Auto-transkrypcja wyłączona"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {interim || "Włącz, aby automatycznie zapisywać wypowiedzi do transkryptu."}
          </p>
        </div>
      </div>
      {listening ? (
        <Button size="sm" variant="outline" onClick={stop}>
          <MicOff className="h-4 w-4 mr-2" /> Stop
        </Button>
      ) : (
        <Button size="sm" onClick={start}>
          <Mic className="h-4 w-4 mr-2" /> Start
        </Button>
      )}
    </Card>
  );
};
