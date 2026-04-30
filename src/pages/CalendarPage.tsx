import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalIcon, Video, Check, X, CreditCard } from "lucide-react";
import { toast } from "sonner";

type Booking = { id: string; starts_at: string; ends_at: string; status: string; price_cents: number; currency: string; tutor_id: string; student_id: string };
type SessionRow = { id: string; booking_id: string };

const CalendarPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Record<string, string>>({}); // booking_id -> session_id
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: bk } = await supabase.from("bookings").select("*").or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`).order("starts_at", { ascending: true });
    setBookings((bk as Booking[]) || []);
    const ids = (bk || []).map((b) => b.id);
    if (ids.length) {
      const { data: ss } = await supabase.from("sessions").select("id, booking_id").in("booking_id", ids);
      const map: Record<string, string> = {};
      (ss as SessionRow[] | null)?.forEach((s) => { map[s.booking_id] = s.id; });
      setSessions(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const updateStatus = async (id: string, status: "confirmed" | "cancelled" | "completed") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Zaktualizowano"); load(); }
  };

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.ends_at).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.ends_at).getTime() < now);

  const Item = ({ b }: { b: Booking }) => {
    const isTutor = b.tutor_id === user?.id;
    const sessionId = sessions[b.id];
    const start = new Date(b.starts_at);
    const canJoin = Date.now() >= start.getTime() - 15 * 60_000 && Date.now() <= new Date(b.ends_at).getTime() + 30 * 60_000;
    return (
      <Card className="p-4 bg-card-soft">
        <div className="flex items-center gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent shrink-0"><CalIcon className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">{start.toLocaleString()}</p>
              <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge>
              {isTutor && <Badge variant="outline">jako tutor</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{(b.price_cents / 100).toFixed(0)} {b.currency}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {isTutor && b.status === "pending" && (
              <>
                <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")}><Check className="h-4 w-4 mr-1" />Potwierdź</Button>
                <Button size="sm" variant="ghost" onClick={() => updateStatus(b.id, "cancelled")}><X className="h-4 w-4" /></Button>
              </>
            )}
            {sessionId && canJoin && b.status === "confirmed" && (
              <Button size="sm" asChild className="bg-accent-gradient text-accent-foreground"><Link to={`/session/${sessionId}`}><Video className="h-4 w-4 mr-1" />Wejdź</Link></Button>
            )}
            {!isTutor && b.status === "confirmed" && (
              <Button size="sm" variant="outline" asChild><Link to={`/payment/${b.id}`}><CreditCard className="h-4 w-4 mr-1" />Zapłać</Link></Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8">{t("calendar.title")}</h1>
        {loading ? <p className="text-muted-foreground">{t("common.loading")}</p> : (
          <>
            <h2 className="text-xl font-semibold mb-3">{t("calendar.upcoming")}</h2>
            {upcoming.length === 0 ? <p className="text-muted-foreground mb-8">{t("calendar.empty")}</p> :
              <div className="space-y-3 mb-8">{upcoming.map((b) => <Item key={b.id} b={b} />)}</div>}

            <h2 className="text-xl font-semibold mb-3">{t("calendar.past")}</h2>
            {past.length === 0 ? <p className="text-muted-foreground">—</p> :
              <div className="space-y-3">{past.map((b) => <Item key={b.id} b={b} />)}</div>}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CalendarPage;
