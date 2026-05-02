import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, CalendarCheck2, Wallet, Activity, AlertTriangle, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  approvedTutors: number; pendingTutors: number; rejectedTutors: number;
  totalBookings: number; upcomingBookings: number; completedBookings: number; cancelledBookings: number;
  pendingPayments: number; confirmedPayments: number; disputedPayments: number;
  bookingCreated: number; sessionCompleted: number; tutorNotes: number;
};

const AdminMarketplace = () => {
  const { t } = useTranslation();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [
        apprT, pendT, rejT, totalBk, upBk, compBk, cancBk,
        pendPay, confPay, dispPay, evBk, evSess, evNote,
      ] = await Promise.all([
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "approved"),
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "rejected"),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).gte("ends_at", nowIso).neq("status", "cancelled"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("payment_records").select("id", { count: "exact", head: true }).in("status", ["pending", "proof_uploaded"]),
        supabase.from("payment_records").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("payment_records").select("id", { count: "exact", head: true }).eq("status", "disputed"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }).eq("event_type", "booking_created"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }).eq("event_type", "session_completed"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }).eq("event_type", "tutor_note_submitted"),
      ]);
      setS({
        approvedTutors: apprT.count ?? 0, pendingTutors: pendT.count ?? 0, rejectedTutors: rejT.count ?? 0,
        totalBookings: totalBk.count ?? 0, upcomingBookings: upBk.count ?? 0,
        completedBookings: compBk.count ?? 0, cancelledBookings: cancBk.count ?? 0,
        pendingPayments: pendPay.count ?? 0, confirmedPayments: confPay.count ?? 0, disputedPayments: dispPay.count ?? 0,
        bookingCreated: evBk.count ?? 0, sessionCompleted: evSess.count ?? 0, tutorNotes: evNote.count ?? 0,
      });
    })();
  }, []);

  const v = (n: number | undefined | null) => (n === undefined || n === null ? "…" : String(n));

  return (
    <AdminPageShell
      title={t("adminMarketplace.title")}
      subtitle={t("adminMarketplace.subtitle")}
      actions={
        <Button asChild className="bg-accent-gradient text-accent-foreground">
          <Link to="/admin/tutors">{t("adminMarketplace.openTutors")}</Link>
        </Button>
      }
    >
      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" /> {t("adminMarketplace.tutorsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={ShieldCheck} label={t("adminMarketplace.approvedTutors")} value={v(s?.approvedTutors)} />
          <StatCard icon={AlertTriangle} label={t("adminMarketplace.pendingTutors")} value={v(s?.pendingTutors)} />
          <StatCard icon={AlertTriangle} label={t("adminMarketplace.rejectedTutors")} value={v(s?.rejectedTutors)} />
        </div>
      </Surface>

      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 text-accent" /> {t("adminMarketplace.bookingsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={CalendarCheck2} label={t("adminMarketplace.totalBookings")} value={v(s?.totalBookings)} />
          <StatCard icon={CalendarCheck2} label={t("adminMarketplace.upcomingBookings")} value={v(s?.upcomingBookings)} />
          <StatCard icon={CalendarCheck2} label={t("adminMarketplace.completedBookings")} value={v(s?.completedBookings)} />
          <StatCard icon={AlertTriangle} label={t("adminMarketplace.cancelledBookings")} value={v(s?.cancelledBookings)} />
        </div>
      </Surface>

      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-accent" /> {t("adminMarketplace.paymentsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Wallet} label={t("adminMarketplace.pendingPayments")} value={v(s?.pendingPayments)} />
          <StatCard icon={Wallet} label={t("adminMarketplace.confirmedPayments")} value={v(s?.confirmedPayments)} />
          <StatCard icon={AlertTriangle} label={t("adminMarketplace.disputedPayments")} value={v(s?.disputedPayments)} />
        </div>
      </Surface>

      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" /> {t("adminMarketplace.sessionsTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Activity} label={t("adminMarketplace.evBooking")} value={v(s?.bookingCreated)} />
          <StatCard icon={Activity} label={t("adminMarketplace.evSession")} value={v(s?.sessionCompleted)} />
          <StatCard icon={Activity} label={t("adminMarketplace.evTutorNote")} value={v(s?.tutorNotes)} />
        </div>
      </Surface>

      <Surface className="p-5">
        <h2 className="font-semibold mb-3">{t("adminMarketplace.linksTitle")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/admin/tutors" className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 hover:bg-muted/50 text-sm">
            <span>{t("adminMarketplace.linkTutors")}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
          <Link to="/calendar" className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 hover:bg-muted/50 text-sm">
            <span>{t("adminMarketplace.linkCalendar")}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </div>
      </Surface>
    </AdminPageShell>
  );
};

export default AdminMarketplace;
