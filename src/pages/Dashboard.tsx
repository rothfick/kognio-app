import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calendar as CalIcon, CreditCard, Search, Sparkles, Users, HandHelping,
  GraduationCap, Star, Wallet, ArrowRight, Settings as SettingsIcon, AlertCircle,
  Clock, CheckCircle2, XCircle, Trophy, Video,
} from "lucide-react";

const STATUS_META: Record<string, { icon: any; cls: string }> = {
  pending:   { icon: Clock,        cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  confirmed: { icon: CheckCircle2, cls: "bg-accent/15 text-accent border-accent/40" },
  completed: { icon: Trophy,       cls: "bg-primary/10 text-primary border-primary/30" },
  cancelled: { icon: XCircle,      cls: "bg-destructive/10 text-destructive border-destructive/40" },
};

const StatusPill = ({ status }: { status: string }) => {
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

type Booking = {
  id: string; starts_at: string; ends_at: string; status: string;
  price_cents: number; currency: string; tutor_id: string; student_id: string;
};
type Payment = { id: string; booking_id: string; status: string; amount_cents: number; currency: string };
type TutorProfile = { is_published: boolean; rating: number | null; sessions_completed: number; headline: string | null };

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isTutor, isStudent, loading: rolesLoading } = useUserRoles();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessionsByBooking, setSessionsByBooking] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  const [karma, setKarma] = useState(0);
  const [tab, setTab] = useState<"student" | "tutor">("student");
  const [loading, setLoading] = useState(true);
  const prevStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (rolesLoading) return;
    if (isTutor && !isStudent) setTab("tutor");
  }, [isTutor, isStudent, rolesLoading]);

  const loadData = async () => {
    if (!user) return;
    const [{ data: bk }, { data: pm }, { data: tp }, { data: pr }] = await Promise.all([
      supabase.from("bookings").select("*").or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`).order("starts_at", { ascending: true }),
      supabase.from("payments").select("id, booking_id, status, amount_cents, currency").or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`),
      supabase.from("tutor_profiles").select("is_published, rating, sessions_completed, headline").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("karma_points").eq("id", user.id).maybeSingle(),
    ]);
    const list = (bk as Booking[]) || [];

    list.forEach((b) => {
      const prev = prevStatusRef.current[b.id];
      if (prev && prev === "pending" && b.status === "confirmed") {
        toast.success(t("dashboardLegacy.confirmedToast"), {
          description: new Date(b.starts_at).toLocaleString(),
        });
      }
    });
    prevStatusRef.current = Object.fromEntries(list.map((b) => [b.id, b.status]));

    setBookings(list);
    setPayments((pm as Payment[]) || []);
    setTutorProfile(tp as TutorProfile | null);
    setKarma(pr?.karma_points || 0);

    const ids = list.map((b) => b.id);
    if (ids.length) {
      const { data: ss } = await supabase.from("sessions").select("id, booking_id").in("booking_id", ids);
      const map: Record<string, string> = {};
      (ss as { id: string; booking_id: string }[] | null)?.forEach((s) => { map[s.booking_id] = s.id; });
      setSessionsByBooking(map);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dash-bookings-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings" }, (payload: any) => {
        const row = payload.new as Booking;
        if (row.student_id !== user.id && row.tutor_id !== user.id) return;
        const prev = prevStatusRef.current[row.id];
        if (prev === "pending" && row.status === "confirmed") {
          toast.success(t("dashboardLegacy.confirmedToast"), {
            description: new Date(row.starts_at).toLocaleString(),
          });
        }
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = Date.now();
  const studentUpcoming = bookings.filter((b) => b.student_id === user?.id && new Date(b.ends_at).getTime() >= now);
  const tutorUpcoming = bookings.filter((b) => b.tutor_id === user?.id && new Date(b.ends_at).getTime() >= now);
  const tutorPending = tutorUpcoming.filter((b) => b.status === "pending");
  const studentUnpaid = bookings.filter(
    (b) => b.student_id === user?.id && b.status === "confirmed" &&
      !payments.some((p) => p.booking_id === b.id && (p.status === "marked_paid" || p.status === "confirmed"))
  );
  const tutorUnconfirmedPayments = payments.filter((p) => p.status === "marked_paid");

  const Stat = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
    <Card className="p-5 bg-card-soft">
      <div className="flex items-center gap-3 mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"><Icon className="h-5 w-5" /></div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );

  const isBookingPaid = (bookingId: string) =>
    payments.some((p) => p.booking_id === bookingId && (p.status === "marked_paid" || p.status === "confirmed"));

  const BookingRow = ({ b, side }: { b: Booking; side: "student" | "tutor" }) => {
    const start = new Date(b.starts_at);
    const sessionId = sessionsByBooking[b.id];
    const canEnter = (b.status === "confirmed" || b.status === "completed") && !!sessionId;
    const showPay = side === "student" && (b.status === "confirmed" || b.status === "completed") && !isBookingPaid(b.id);

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-background flex-wrap">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent shrink-0">
          <CalIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{start.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{(b.price_cents / 100).toFixed(0)} {b.currency}</p>
        </div>
        <StatusPill status={b.status} />
        <div className="flex gap-1.5">
          {canEnter && (
            <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
              <Link to={`/session/${sessionId}`}><Video className="h-3.5 w-3.5 mr-1" />{t("calendar.enter")}</Link>
            </Button>
          )}
          {showPay && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/payment/${b.id}`}><CreditCard className="h-3.5 w-3.5 mr-1" />{t("calendar.pay")}</Link>
            </Button>
          )}
          {b.status === "pending" && (
            <Button asChild size="sm" variant="ghost">
              <Link to="/calendar">{t("common.details")}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading || rolesLoading) {
    return <AppShell><div className="container py-10 text-muted-foreground">{t("common.loadingPanel")}</div></AppShell>;
  }

  const showRoleTabs = isStudent && isTutor;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("dashboardLegacy.title")}</h1>
          <p className="text-muted-foreground">{t("dashboardLegacy.subtitle")}</p>
        </div>

        {showRoleTabs ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="mb-6">
              <TabsTrigger value="student"><GraduationCap className="h-4 w-4 mr-2" />{t("dashboardLegacy.asStudent")}</TabsTrigger>
              <TabsTrigger value="tutor"><Sparkles className="h-4 w-4 mr-2" />{t("dashboardLegacy.asTutor")}</TabsTrigger>
            </TabsList>
            <TabsContent value="student"><StudentView /></TabsContent>
            <TabsContent value="tutor"><TutorView /></TabsContent>
          </Tabs>
        ) : isTutor ? <TutorView /> : <StudentView />}
      </div>
    </AppShell>
  );

  function StudentView() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={CalIcon} label={t("dashboardLegacy.upcomingSessions")} value={studentUpcoming.length} />
          <Stat icon={CreditCard} label={t("dashboardLegacy.unpaid")} value={studentUnpaid.length} hint={studentUnpaid.length ? t("dashboardLegacy.needsAction") : t("dashboardLegacy.allGood")} />
          <Stat icon={Star} label="Karma" value={karma} hint={t("dashboardLegacy.karmaHint")} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5 bg-card-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t("dashboardLegacy.upcomingSessions")}</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/calendar">{t("dashboardLegacy.all")}</Link></Button>
            </div>
            {studentUpcoming.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">{t("dashboardLegacy.noUpcoming")}</p>
                <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                  <Link to="/discover"><Search className="h-4 w-4 mr-2" />{t("student.findTutor")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {studentUpcoming.slice(0, 3).map((b) => <BookingRow key={b.id} b={b} side="student" />)}
              </div>
            )}
          </Card>

          <Card className="p-5 bg-card-soft">
            <h2 className="font-semibold mb-4">{t("dashboardLegacy.whatNext")}</h2>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/discover"><Search className="h-4 w-4 mr-2" />{t("student.findTutor")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/circles"><Users className="h-4 w-4 mr-2" />{t("dashboardLegacy.joinCircle")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/peer"><HandHelping className="h-4 w-4 mr-2" />{t("dashboardLegacy.askOrHelp")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/brain"><Sparkles className="h-4 w-4 mr-2" />{t("dashboardLegacy.openBrain")}</Link>
              </Button>
              {!isTutor && (
                <Button asChild className="w-full justify-start bg-accent-gradient text-accent-foreground mt-2">
                  <Link to="/settings"><GraduationCap className="h-4 w-4 mr-2" />{t("dashboardLegacy.alsoTutor")}</Link>
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Stan rezerwacji — pełna lista z akcjami */}
        <Card className="p-5 bg-card-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">{t("dashboardLegacy.bookingStatus")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("dashboardLegacy.bookingStatusHint")}
              </p>
            </div>
          </div>
          {studentUpcoming.length === 0 && bookings.filter((b) => b.student_id === user?.id).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("dashboardLegacy.noBookings")}</p>
          ) : (
            <div className="space-y-2">
              {bookings
                .filter((b) => b.student_id === user?.id)
                .slice(0, 8)
                .map((b) => <BookingRow key={b.id} b={b} side="student" />)}
            </div>
          )}
        </Card>

        {studentUnpaid.length > 0 && (
          <Card className="p-5 bg-card-soft border-accent/40">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-accent" />
              <h2 className="font-semibold">{t("dashboardLegacy.sessionsToPay")}</h2>
            </div>
            <div className="space-y-2">
              {studentUnpaid.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                  <Wallet className="h-4 w-4 text-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{new Date(b.starts_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{(b.price_cents / 100).toFixed(2)} {b.currency}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/payment/${b.id}`}>{t("calendar.pay")} <ArrowRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  function TutorView() {
    const earnings = payments
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum + p.amount_cents, 0);

    return (
      <div className="space-y-6">
        {tutorProfile && !tutorProfile.is_published && (
          <Card className="p-5 bg-accent/10 border-accent/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-accent mb-1">{t("dashboardLegacy.hiddenTutorTitle")}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("dashboardLegacy.hiddenTutorBody")}
                </p>
                <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                  <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" />{t("dashboardLegacy.finishSetup")}</Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat icon={CalIcon} label={t("dashboardLegacy.upcomingSessions")} value={tutorUpcoming.length} />
          <Stat icon={AlertCircle} label={t("dashboardLegacy.toConfirm")} value={tutorPending.length} hint={tutorPending.length ? t("dashboardLegacy.waitingApproval") : "Wszystko ogarnięte"} />
          <Stat icon={Star} label={t("dashboardLegacy.rating")} value={tutorProfile?.rating?.toFixed(1) || "—"} hint={t("dashboardLegacy.sessionsCount", { count: tutorProfile?.sessions_completed || 0 })} />
          <Stat icon={Wallet} label={t("dashboardLegacy.confirmedEarnings")} value={`${(earnings / 100).toFixed(0)} zł`} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5 bg-card-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t("dashboardLegacy.upcomingSessions")}</h2>
              <Button asChild variant="ghost" size="sm"><Link to="/calendar">{t("dashboardLegacy.all")}</Link></Button>
            </div>
            {tutorUpcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("dashboardLegacy.noUpcoming")}</p>
            ) : (
              <div className="space-y-2">
                {tutorUpcoming.slice(0, 3).map((b) => <BookingRow key={b.id} b={b} side="tutor" />)}
              </div>
            )}
          </Card>

          <Card className="p-5 bg-card-soft">
            <h2 className="font-semibold mb-4">{t("dashboardLegacy.pendingPayments")}</h2>
            {tutorUnconfirmedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("dashboardLegacy.noNewPayments")}</p>
            ) : (
              <div className="space-y-2">
                {tutorUnconfirmedPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                    <Wallet className="h-4 w-4 text-accent shrink-0" />
                    <p className="flex-1 text-sm font-medium">{(p.amount_cents / 100).toFixed(2)} {p.currency}</p>
                    <Button asChild size="sm"><Link to={`/payment/${p.booking_id}`}>{t("dashboardLegacy.check")}</Link></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Stan rezerwacji tutora — wszystkie z akcjami */}
        <Card className="p-5 bg-card-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">{t("dashboardLegacy.studentBookings")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("dashboardLegacy.studentBookingsHint")}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/calendar">{t("dashboardLegacy.all")}</Link></Button>
          </div>
          {bookings.filter((b) => b.tutor_id === user?.id).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("dashboardLegacy.noBookingsShort")}</p>
          ) : (
            <div className="space-y-2">
              {bookings
                .filter((b) => b.tutor_id === user?.id)
                .slice(0, 8)
                .map((b) => <BookingRow key={b.id} b={b} side="tutor" />)}
            </div>
          )}
        </Card>

        <Card className="p-5 bg-card-soft">
          <h2 className="font-semibold mb-4">{t("dashboardLegacy.tutorShortcuts")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" />{t("dashboardLegacy.editProfileRates")}</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to={`/tutor/${user?.id}`}><GraduationCap className="h-4 w-4 mr-2" />{t("dashboardLegacy.viewPublicProfile")}</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }
};

export default Dashboard;
