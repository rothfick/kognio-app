import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string;
  onLeave?: () => void;
};

export function LiveKitVideo({ sessionId, onLeave }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s?.access_token) throw new Error("Brak sesji użytkownika");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setToken(json.token);
        setWsUrl(json.wsUrl);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Nie udało się pobrać tokenu wideo");
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) {
    return (
      <div className="aspect-video grid place-items-center bg-muted text-center p-6 rounded-lg">
        <div>
          <VideoOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Wideo niedostępne</p>
          <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!token || !wsUrl) {
    return (
      <div className="aspect-video grid place-items-center bg-muted rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connect) {
    return (
      <div className="aspect-video grid place-items-center bg-hero text-primary-foreground rounded-lg">
        <div className="text-center">
          <p className="mb-3 text-sm opacity-90">Gotowi na sesję?</p>
          <Button onClick={() => setConnect(true)} className="bg-accent-gradient text-accent-foreground">
            Dołącz do pokoju wideo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-background h-[60vh] min-h-[420px]" data-lk-theme="default">
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect
        video
        audio
        onDisconnected={() => { setConnect(false); onLeave?.(); }}
        style={{ height: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
