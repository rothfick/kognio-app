import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalIcon, FileText, Users, Wallet, Settings as SettingsIcon, ShieldCheck, AlertCircle,
  ExternalLink, FileCheck2,
} from "lucide-react";
import { UpcomingBookingCard } from "@/components/booking/UpcomingBookingCard";
import { useUpcomingBookings } from "@/hooks/useUpcomingBookings";
import { HomeworkWidget } from "@/components/homework/HomeworkWidget";
import { isFeatureEnabled } from "@/config/features";

const TutorDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [published, setPublished] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>("draft");
  const [pendingPaymentCount, setPendingPaymentCount] = useState<number>(0);
  const [notesNeededCount, setNotesNeededCount] = useState<number>(0);
  const [confirmedEarnings, setConfirmedEarnings] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [activeStudents, setActiveStudents] = useState<number>(0);

  const { items: upcoming, loading: upcomingLoading } = useUpcomingBookings("tutor");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("tutor_profiles")
        .select("is_verified, is_published, verification_status, currency")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setHasProfile(!!profile);
      setVerified(!!profile?.is_verified);
      setPublished(!!profile?.is_published);
      setVerificationStatus(profile?.verification_status || "draft");

      // Pending payment confirmations (proof_uploaded)
      const { data: bookingIdsRows } = await supabase
        .from("bookings")
        .select("id, student_id, child_id, starts_at, ends_at, status, payment_status")
        .eq("tutor_id", user.id);
      const allBookings = (bookingIdsRows || []) as Array<{
        id: string; student_id: string | null; child_id: string | null;
        starts_at: string; ends_at: string; status: string; payment_status: string;
      }>;
      const allIds = allBookings.map((b) => b.id);

      let pendingCount = 0;
      let earnings = 0;
      if (allIds.length) {
        const { data: pays } = await supabase
          .from("payment_records")
          .select("booking_id, status, amount")
          .in("booking_id", allIds);
        const payRows = (pays || []) as Array<{ booking_id: string; status: string; amount: number }>;
        pendingCount = payRows.filter((p) => p.status === "proof_uploaded").length;
        earnings = payRows.filter((p) => p.status === "confirmed").reduce((sum, p) => sum + Number(p.amount || 0), 0);
      }

      // Notes needed: completed sessions without a note
      const completed = allBookings.filter((b) => b.status === "completed");
      let notesNeeded = 0;
      if (completed.length) {
        const { data: notes } = await supabase
          .from("session_notes")
          .select("booking_id")
          .in("booking_id", completed.map((b) => b.id));
        const haveIds = new Set(((notes || []) as Array<{ booking_id: string }>).map((n) => n.booking_id));
        notesNeeded = completed.filter((b) => !haveIds.has(b.id)).length;
      }

      // Today's sessions
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const today = allBookings.filter((b) => {
        const t = new Date(b.starts_at).getTime();
        return t >= startOfDay.getTime() && t <= endOfDay.getTime() && b.status !== "cancelled";
      }).length;

      // Active students (distinct learners with future or recent bookings)
      const learnerKeys = new Set<string>();
      allBookings.forEach((b) => {
        if (b.status === "cancelled") return;
        if (b.child_id) learnerKeys.add(`c:${b.child_id}`);
        else if (b.student_id) learnerKeys.add(`s:${b.student_id}`);
      });

      if (!cancelled) {
        setPendingPaymentCount(pendingCount);
        setNotesNeededCount(notesNeeded);
        setConfirmedEarnings(earnings);
        setTodayCount(today);
        setActiveStudents(learnerKeys.size);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const isApproved = verified && verificationStatus === "approved";

  return (
    <RoleGate allow={["tutor"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("dashboard.tutorTitle")}
            subtitle={t("dashboard.tutorSubtitle")}
            primaryAction={{ label: t("tutorDash.settingsCta"), to: "/settings" }}
          />

          {hasProfile === false && (
            <Surface variant="ai" className="p-5 mb-6 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{t("tutorDash.onboardingTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("tutorDash.onboardingBody")}</p>
              </div>
              <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
                <Link to="/tutor/onboarding">{t("tutorDash.onboardingCta")}</Link>
              </Button>
            </Surface>
          )}

          {hasProfile && verificationStatus === "pending" && (
            <Surface variant="ai" className="p-5 mb-6 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-warning/15 text-warning">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{t("tutorDash.pendingTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("tutorDash.pendingBody")}</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{t("tutorDash.pendingBadge")}</Badge>
            </Surface>
          )}

          {hasProfile && verificationStatus === "rejected" && (
            <Surface variant="ai" className="p-5 mb-6 flex items-start gap-3 border-destructive/40">
              <AlertCircle className="h-4 w-4 text-destructive mt-1 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{t("tutorDash.rejectedTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("tutorDash.rejectedBody")}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/tutor/onboarding">{t("tutorDash.editProfileCta")}</Link>
              </Button>
            </Surface>
          )}

          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <StatCard icon={CalIcon} label={t("tutorDash.today")} value={String(todayCount)} hint={todayCount === 0 ? t("tutorDash.todayHint") : undefined} />
            <StatCard icon={FileText} label={t("tutorDash.notesTodo")} value={String(notesNeededCount)} hint={notesNeededCount === 0 ? t("tutorDash.notesHint") : t("tutorDash.notesPending")} />
            <StatCard icon={Users} label={t("tutorDash.activeStudents")} value={String(activeStudents)} />
            <StatCard
              icon={Wallet}
              label={t("tutorDash.monthEarn")}
              value={new Intl.NumberFormat(i18n.language, { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(confirmedEarnings)}
              hint={t("tutorDash.earnHint")}
            />
          </div>

          {pendingPaymentCount > 0 && (
            <Surface className="p-5 mb-6 border-amber-500/40 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <FileCheck2 className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">{t("tutorDash.paymentPendingTitle", { count: pendingPaymentCount })}</p>
                  <p className="text-xs text-muted-foreground">{t("tutorDash.paymentPendingBody")}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/calendar">{t("tutorDash.reviewPayments")}</Link>
                </Button>
              </div>
            </Surface>
          )}

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title={t("tutorDash.studentInsight")} className="md:col-span-2">
              <p>{t("tutorDash.studentInsightBody")}</p>
            </AIInsightCard>
            <Surface className="p-5">
              <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> {t("tutorDash.profileStatus")}
              </h3>
              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li>{t("tutorDash.verification")}: {verified ? t("tutorDash.yes") : t("tutorDash.pending")}</li>
                <li>{t("tutorDash.publication")}: {published ? t("tutorDash.visible") : t("tutorDash.hidden")}</li>
              </ul>
              <div className="mt-3 grid gap-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/settings"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" />{t("tutorDash.config")}</Link>
                </Button>
                {isApproved && user && (
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/tutors/${user.id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> {t("tutorDash.viewPublic")}
                    </Link>
                  </Button>
                )}
              </div>
            </Surface>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <UpcomingBookingCard
              loading={upcomingLoading}
              items={upcoming}
              emptyShowFindTutor={false}
              showPaymentAttention={false}
              title={t("tutorDash.todayLessons")}
              emptyHint={t("tutorDash.noLessonsDesc")}
            />
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-accent" /> {t("tutorDash.afterLessonNotes")}</h2>
              {notesNeededCount === 0 ? (
                <EmptyState icon={FileText} title={t("tutorDash.noNotesTitle")} description={t("tutorDash.noNotesDesc")} />
              ) : (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                  <p className="font-medium mb-1">{t("tutorDash.notesPendingTitle", { count: notesNeededCount })}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t("tutorDash.notesPendingBody")}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/calendar">{t("tutorDash.openCalendar")}</Link>
                  </Button>
                </div>
              )}
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default TutorDashboard;
