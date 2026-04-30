import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Activity, Camera, CameraOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = { sessionId: string; userId: string };

const MODELS_URL = "https://justadudewhohacks.github.io/face-api.js/models";

type EmoSample = { engagement: number; confusion: number; joy: number; boredom: number };

export const EmotionEngine = ({ sessionId, userId }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<EmoSample | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { stopFnRef.current?.(); }, []);

  const start = async () => {
    if (!consent) { toast.error("Zaznacz zgodę na analizę kamery."); return; }
    setLoading(true);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEnabled(true);

      const detect = async (): Promise<EmoSample | null> => {
        if (!videoRef.current || videoRef.current.readyState < 2) return null;
        const result = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })).withFaceExpressions();
        if (!result) return null;
        const e = result.expressions as any;
        // Mapowanie na nasze 4 osie (0..1)
        const joy = e.happy ?? 0;
        const boredom = Math.min(1, (e.neutral ?? 0) * 0.6 + (e.sad ?? 0) * 0.4);
        const confusion = Math.min(1, (e.surprised ?? 0) * 0.5 + (e.fearful ?? 0) * 0.3 + (e.disgusted ?? 0) * 0.2);
        const engagement = Math.max(0, Math.min(1, 0.5 + joy * 0.5 + (e.surprised ?? 0) * 0.2 - boredom * 0.6));
        return { engagement, confusion, joy, boredom };
      };

      // sampling co 5s, zapis batch
      let buffer: EmoSample[] = [];
      const sampler = setInterval(async () => {
        const s = await detect();
        if (s) { buffer.push(s); setCurrent(s); }
      }, 1500);

      const flusher = setInterval(async () => {
        if (buffer.length === 0) return;
        const avg = buffer.reduce((a, b) => ({
          engagement: a.engagement + b.engagement, confusion: a.confusion + b.confusion,
          joy: a.joy + b.joy, boredom: a.boredom + b.boredom,
        }), { engagement: 0, confusion: 0, joy: 0, boredom: 0 });
        const n = buffer.length;
        const sample = { engagement: +(avg.engagement / n).toFixed(3), confusion: +(avg.confusion / n).toFixed(3), joy: +(avg.joy / n).toFixed(3), boredom: +(avg.boredom / n).toFixed(3) };
        buffer = [];
        await supabase.from("session_emotions").insert({
          session_id: sessionId, user_id: userId, ...sample, raw: { samples: n } as any,
        });
      }, 8000);

      stopFnRef.current = () => {
        clearInterval(sampler); clearInterval(flusher);
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setEnabled(false); setCurrent(null);
      };
    } catch (e: any) {
      toast.error(e.message || "Nie udało się uruchomić kamery");
    } finally {
      setLoading(false);
    }
  };

  const stop = () => { stopFnRef.current?.(); stopFnRef.current = null; };

  const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div>
      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{label}</span><span className="font-mono">{Math.round(value * 100)}%</span></div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className={`h-full ${color} transition-all`} style={{ width: `${value * 100}%` }} /></div>
    </div>
  );

  return (
    <Card className="p-4 bg-card-soft space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Activity className="h-4 w-4 text-accent" /> Silnik emocji
      </div>
      <video ref={videoRef} muted playsInline className={`w-full rounded-md bg-muted ${enabled ? "block" : "hidden"}`} style={{ aspectRatio: "4/3" }} />

      {!enabled && (
        <>
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={consent} onCheckedChange={setConsent} />
            <span>Wyrażam zgodę na lokalną analizę mimiki z mojej kamery. Wideo nie opuszcza mojego urządzenia — zapisywane są tylko zagregowane wskaźniki (zaangażowanie, radość, znudzenie, dezorientacja).</span>
          </label>
          <Button onClick={start} disabled={loading || !consent} size="sm" className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Włącz analizę emocji
          </Button>
        </>
      )}

      {enabled && current && (
        <div className="space-y-2">
          <Bar label="Zaangażowanie" value={current.engagement} color="bg-accent-gradient" />
          <Bar label="Radość" value={current.joy} color="bg-success" />
          <Bar label="Dezorientacja" value={current.confusion} color="bg-warning" />
          <Bar label="Znudzenie" value={current.boredom} color="bg-destructive" />
          <Button onClick={stop} variant="outline" size="sm" className="w-full"><CameraOff className="h-4 w-4 mr-2" />Wyłącz</Button>
        </div>
      )}
    </Card>
  );
};
