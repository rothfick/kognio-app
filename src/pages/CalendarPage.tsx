import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Calendar as CalIcon } from "lucide-react";

type Booking = { id: string; starts_at: string; ends_at: string; status: string; price_cents: number; currency: string; tutor_id: string; student_id: string };

const CalendarPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("bookings").select("*").or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`).order("starts_at", { ascending: true });
      setBookings((data as Booking[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.starts_at).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.starts_at).getTime() < now);

  const Item = ({ b }: { b: Booking }) => (
    <Card className="p-4 flex items-center gap-4 bg-card-soft">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"><CalIcon className="h-5 w-5" /></div>
      <div className="flex-1">
        <p className="font-medium">{new Date(b.starts_at).toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{(b.price_cents / 100).toFixed(0)} {b.currency} · {b.status}</p>
      </div>
    </Card>
  );

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
