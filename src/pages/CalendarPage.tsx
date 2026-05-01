import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalIcon, Video, Check, X, CreditCard, Search,
  Clock, CheckCircle2, XCircle, Trophy,
} from "lucide-react";
import { toast } from "sonner";

type Booking = { id: string; starts_at: string; ends_at: string; status: string; price_cents: number; currency: string; tutor_id: string; student_id: string };
type SessionRow = { id: string; booking_id: string };

const STATUS_META: Record<string, { icon: any; cls: string }> = {
  pending:   { icon: Clock,        cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  confirmed: { icon: CheckCircle2, cls: "bg-accent/15 text-accent border-accent/40" },
  completed: { icon: Trophy,       cls: "bg-primary/10 text-primary border-primary/30" },
  cancelled: { icon: XCircle,      cls: "bg-destructive/10 text-destructive border-destructive/40" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {t(`calendar.status.${status}`, { defaultValue: t("calendar.status.pending") })}
    </span>
  );
};

const CalendarPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const { data: bk } = await supabase
      .from("bookings").select("*")
      .or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`)
      .order("starts_at", { ascending: true });
    const list = (bk as Booking[]) || [];

    // Wykryj zmianę pending -> confirmed (np. po realtime / po odświeżeniu)
    list.forEach((b) => {
      const prev = prevStatusRef.current[b.id];
      if (prev && prev === "pending" && b.status === "confirmed") {
        toast.success(t("calendar.confirmedToast"), {
          description: new Date(b.starts_at).toLocaleString(),
        });
      }
    });
    prevStatusRef.current = Object.fromEntries(list.map((b) => [b.id, b.status]));

    setBookings(list);
    const ids = list.map((b) => b.id);
    if (ids.length) {
      const { data: ss } = await supabase.from("sessions").select("id, booking_id").in("booking_id", ids);
      const map: Record<string, string> = {};
      (ss as SessionRow[] | null)?.forEach((s) => { map[s.booking_id] = s.id; });
      setSessions(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Realtime: nasłuchuj zmian na własnych rezerwacjach
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bookings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        (payload: any) => {
          const row = payload.new as Booking;
          if (row.student_id !== user.id && row.tutor_id !== user.id) return;
          const prev = prevStatusRef.current[row.id];
          if (prev === "pending" && row.status === "confirmed") {
            toast.success(t("calendar.confirmedToast"), {
              description: new Date(row.starts_at).toLocaleString(),
            });
          }
          load();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const updateStatus = async (id: string, status: "confirmed" | "cancelled" | "completed") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      if (status === "confirmed") toast.success(t("calendar.confirmToast"));
      else if (status === "cancelled") toast(t("calendar.cancelToast"));
      else toast.success(t("calendar.completedToast"));
      load();
    }
  };

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.ends_at).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.ends_at).getTime() < now);

  const Item = ({ b }: { b: Booking }) => {
    const isTutor = b.tutor_id === user?.id;
    const sessionId = sessions[b.id];
    const start = new Date(b.starts_at);
    const canEnter = b.status === "confirmed" || b.status === "completed";

    return (
      <Card className="p-4 bg-card-soft">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent shrink-0">
            <CalIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-medium">{start.toLocaleString()}</p>
              <StatusBadge status={b.status} />
              {isTutor && <Badge variant="outline">{t("calendar.asTutor")}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mb-1">{(b.price_cents / 100).toFixed(0)} {b.currency}</p>
            <p className="text-xs text-muted-foreground">{t(`calendar.hint.${b.status}`, { defaultValue: t("calendar.hint.pending") })}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap justify-end border-t pt-3">
          {isTutor && b.status === "pending" && (
            <>
              <Button size="sm" onClick={() => updateStatus(b.id, "confirmed")}>
                <Check className="h-4 w-4 mr-1" />{t("calendar.confirm")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus(b.id, "cancelled")}>
                <X className="h-4 w-4 mr-1" />{t("calendar.reject")}
              </Button>
            </>
          )}

          {b.status === "pending" && !isTutor && (
            <span className="text-xs text-muted-foreground self-center">
              {t("calendar.waitingTutor")}
            </span>
          )}

          {sessionId && canEnter && (
            <Button size="sm" asChild className="bg-accent-gradient text-accent-foreground">
              <Link to={`/session/${sessionId}`}><Video className="h-4 w-4 mr-1" />{t("calendar.enter")}</Link>
            </Button>
          )}

          {!isTutor && canEnter && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/payment/${b.id}`}><CreditCard className="h-4 w-4 mr-1" />{t("calendar.pay")}</Link>
            </Button>
          )}

          {isTutor && b.status === "confirmed" && new Date(b.ends_at).getTime() < now && (
            <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "completed")}>
              <Trophy className="h-4 w-4 mr-1" />{t("calendar.markCompleted")}
            </Button>
          )}
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
            {upcoming.length === 0 ? (
              <Card className="p-8 text-center bg-card-soft mb-8">
                <CalIcon className="h-10 w-10 mx-auto mb-3 text-accent" />
                <p className="text-muted-foreground mb-4">{t("calendar.empty")}</p>
                <Button asChild className="bg-accent-gradient text-accent-foreground">
                  <Link to="/discover"><Search className="h-4 w-4 mr-2" />{t("calendar.findTutor")}</Link>
                </Button>
              </Card>
            ) : <div className="space-y-3 mb-8">{upcoming.map((b) => <Item key={b.id} b={b} />)}</div>}

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
