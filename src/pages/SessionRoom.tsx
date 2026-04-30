import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, MessageSquare, Sparkles, Activity, ArrowRight } from "lucide-react";

const SessionRoom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<{ id: string; room_name: string; booking_id: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions").select("id, room_name, booking_id").eq("id", id as string).maybeSingle();
      setSession(data);
    })();
  }, [id]);

  if (!session) return <AppShell><div className="container py-10">Ładowanie pokoju…</div></AppShell>;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
          {/* Left: video tiles */}
          <div className="space-y-4 flex flex-col">
            <Card className="aspect-video bg-hero text-primary-foreground grid place-items-center">
              <div className="text-center"><Video className="h-10 w-10 mx-auto mb-2 opacity-70" /><p className="text-sm opacity-80">Wideo tutora (LiveKit — wkrótce)</p></div>
            </Card>
            <Card className="aspect-video bg-hero text-primary-foreground grid place-items-center">
              <div className="text-center"><Video className="h-10 w-10 mx-auto mb-2 opacity-70" /><p className="text-sm opacity-80">Wideo ucznia</p></div>
            </Card>
            <Card className="p-4 bg-card-soft">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium"><Activity className="h-4 w-4 text-accent" /> Zaangażowanie</div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-accent-gradient w-3/4" /></div>
              <p className="text-xs text-muted-foreground mt-2">Analizator emocji włączy się po starcie sesji.</p>
            </Card>
          </div>

          {/* Center: whiteboard / editor */}
          <Card className="lg:col-span-2 p-6 bg-card-soft flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Tablica · Edytor zadań</h2>
              <span className="text-xs text-muted-foreground font-mono">room: {session.room_name}</span>
            </div>
            <div className="flex-1 rounded-lg border-2 border-dashed border-border grid place-items-center text-muted-foreground">
              <div className="text-center max-w-sm p-8">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-accent" />
                <p className="font-medium mb-2">Pokój sesji jest gotowy</p>
                <p className="text-sm">Tablica (tldraw + Yjs), edytor (Monaco + KaTeX), transkrypcja na żywo (ElevenLabs Scribe) i AI Co-pilot zostaną podłączone w następnym kroku — wymaga to dodania kluczy LiveKit i ElevenLabs.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Card className="p-3 bg-background">
                <div className="flex items-center gap-2 mb-1 text-xs font-medium text-muted-foreground"><MessageSquare className="h-3 w-3" /> TRANSKRYPT NA ŻYWO</div>
                <p className="text-xs text-muted-foreground italic">— oczekiwanie na audio —</p>
              </Card>
              <Card className="p-3 bg-background">
                <div className="flex items-center gap-2 mb-1 text-xs font-medium text-accent"><Sparkles className="h-3 w-3" /> AI CO-PILOT</div>
                <p className="text-xs text-muted-foreground italic">Sugestie pojawią się tu w trakcie sesji.</p>
              </Card>
            </div>
            <div className="flex justify-end mt-4">
              <Button asChild variant="outline"><Link to={`/payment/${session.booking_id}`}>Zakończ i przejdź do płatności <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default SessionRoom;
