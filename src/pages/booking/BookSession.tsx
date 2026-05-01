import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CalendarCheck2, Loader2, User, BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { expandAvailability, groupSlotsByDay, type RecurringSlot, type ExistingBooking } from "@/lib/availability";
import { logBookingEvent } from "@/lib/bookingEvents";
import { createNotification } from "@/lib/notifications";

interface Tutor {
  user_id: string;
  display_name: string | null;
  hourly_rate: number | null;
  hourly_rate_cents: number;
  currency: string;
  languages: string[];
  is_verified: boolean;
  verification_status: string;
}

interface Child { id: string; display_name: string }
interface PlanItem { id: string; title: string; competency_id: string | null; learning_domain_id: string | null; education_level_id: string | null; skill_area: string | null }

const BookSession = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const { user } = useAuth();
  const { isParent } = useUserRoles();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [slots, setSlots] = useState<RecurringSlot[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [learnerKind, setLearnerKind] = useState<"self" | "child">("self");
  const [childId, setChildId] = useState<string>("");
  const [topicMode, setTopicMode] = useState<"plan_item" | "custom">("custom");
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");
  const [selectedSlotIso, setSelectedSlotIso] = useState<string>("");

  useEffect(() => {
    if (!tutorId || !user) return;
    (async () => {
      setLoading(true);
      const [{ data: tt }, { data: kids }, { data: avail }, { data: bk }] = await Promise.all([
        supabase
          .from("tutor_profiles")
          .select("user_id, display_name, hourly_rate, hourly_rate_cents, currency, languages, is_verified, verification_status")
          .eq("user_id", tutorId)
          .maybeSingle(),
        supabase.from("parent_children").select("id, display_name").eq("parent_id", user.id).eq("status", "active"),
        supabase.from("tutor_availability_slots").select("id, weekday, start_time, end_time, timezone, valid_from, valid_to").eq("tutor_user_id", tutorId),
        supabase.from("bookings").select("starts_at, ends_at, status").eq("tutor_id", tutorId).neq("status", "cancelled"),
      ]);
      setTutor((tt as Tutor) ?? null);
      setChildren((kids || []) as Child[]);
      setSlots((avail || []) as RecurringSlot[]);
      setExistingBookings((bk || []) as ExistingBooking[]);
      setLoading(false);
    })();
  }, [tutorId, user]);

  // Load plan items for selected learner
  useEffect(() => {
    if (!user) return;
    (async () => {
      let q = supabase.from("learning_plan_items").select("id, title, competency_id, learning_domain_id, education_level_id, skill_area, plan_id").eq("status", "pending").limit(20);
      const { data } = await q;
      const items = (data || []) as Array<PlanItem & { plan_id: string }>;
      // Filter by learner ownership via plan
      if (items.length === 0) { setPlanItems([]); return; }
      const planIds = Array.from(new Set(items.map((i) => i.plan_id)));
      const { data: plans } = await supabase.from("learning_plans").select("id, user_id, child_id").in("id", planIds);
      const ownedPlanIds = new Set(
        (plans || []).filter((p) => {
          if (learnerKind === "self") return p.user_id === user.id;
          return p.child_id && p.child_id === childId;
        }).map((p) => p.id),
      );
      setPlanItems(items.filter((i) => ownedPlanIds.has(i.plan_id)));
    })();
  }, [user, learnerKind, childId]);

  const bookableSlots = useMemo(() => expandAvailability(slots, existingBookings, 14, 60), [slots, existingBookings]);
  const grouped = useMemo(() => groupSlotsByDay(bookableSlots), [bookableSlots]);

  const selectedPlanItem = useMemo(
    () => planItems.find((p) => p.id === selectedPlanItemId) || null,
    [planItems, selectedPlanItemId],
  );

  const rate = tutor ? (tutor.hourly_rate ?? tutor.hourly_rate_cents / 100) : 0;

  const canProceedStep1 = learnerKind === "self" || (learnerKind === "child" && !!childId);
  const canProceedStep2 = (topicMode === "plan_item" && !!selectedPlanItemId) || (topicMode === "custom" && customTopic.trim().length > 0);
  const canSubmit = !!selectedSlotIso && canProceedStep1 && canProceedStep2;

  if (loading) {
    return <AppShell><div className="container mx-auto max-w-3xl p-8"><Card className="h-64 animate-pulse" /></div></AppShell>;
  }
  if (!tutor || !tutor.is_verified || tutor.verification_status !== "approved") {
    return (
      <AppShell>
        <div className="container mx-auto max-w-2xl p-8">
          <Card className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">{t("tutor.unavailable.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tutor.unavailable.body")}</p>
            <Button asChild variant="outline"><Link to="/discover">{t("tutor.unavailable.cta")}</Link></Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const submit = async () => {
    if (!canSubmit || !user || !tutor) return;
    setSubmitting(true);
    try {
      const slotEnd = new Date(new Date(selectedSlotIso).getTime() + 60 * 60 * 1000).toISOString();
      const isParentBooking = learnerKind === "child";
      const topic = topicMode === "plan_item" && selectedPlanItem
        ? selectedPlanItem.title
        : customTopic.trim();

      const insertPayload: Record<string, unknown> = {
        tutor_id: tutor.user_id,
        starts_at: selectedSlotIso,
        ends_at: slotEnd,
        status: "pending",
        price_cents: Math.round(rate * 100),
        price_amount: rate,
        currency: tutor.currency,
        notes: topic,
        payment_status: "unpaid",
        created_by: user.id,
        learning_plan_item_id: topicMode === "plan_item" ? selectedPlanItemId : null,
        competency_id: selectedPlanItem?.competency_id ?? null,
        learning_domain_id: selectedPlanItem?.learning_domain_id ?? null,
        education_level_id: selectedPlanItem?.education_level_id ?? null,
        skill_area_label: selectedPlanItem?.skill_area ?? (topicMode === "custom" ? topic.slice(0, 80) : null),
      };
      if (isParentBooking) {
        insertPayload.parent_user_id = user.id;
        insertPayload.child_id = childId;
        insertPayload.student_id = null;
      } else {
        insertPayload.student_id = user.id;
      }

      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert(insertPayload as never)
        .select("id")
        .single();
      if (bErr || !booking) throw bErr || new Error("booking_insert_failed");

      const bookingId = (booking as { id: string }).id;

      // Create payment record
      const { error: pErr } = await supabase.from("payment_records").insert({
        booking_id: bookingId,
        payer_user_id: user.id,
        tutor_user_id: tutor.user_id,
        amount: rate,
        currency: tutor.currency,
        method: "manual",
        status: "pending",
      } as never);
      if (pErr) throw pErr;

      // SMART evidence
      await logBookingEvent({
        eventType: "booking_created",
        bookingId,
        userId: user.id,
        ownerUserId: isParentBooking ? null : user.id,
        childId: isParentBooking ? childId : null,
        learningDomainId: selectedPlanItem?.learning_domain_id ?? null,
        educationLevelId: selectedPlanItem?.education_level_id ?? null,
        competencyId: selectedPlanItem?.competency_id ?? null,
        skillAreaLabel: selectedPlanItem?.skill_area ?? null,
        status: "pending",
        paymentStatus: "unpaid",
      });

      // Notifications (payer + tutor)
      await Promise.all([
        createNotification({
          userId: user.id,
          type: "booking_created_payer",
          title: t("notif.bookingCreatedPayer.title"),
          body: t("notif.bookingCreatedPayer.body", { tutor: tutor.display_name || "" }),
          actionLabel: t("notif.viewCalendar"),
          actionUrl: "/calendar",
          severity: "info",
        }),
        createNotification({
          userId: tutor.user_id,
          type: "booking_created_tutor",
          title: t("notif.bookingCreatedTutor.title"),
          body: t("notif.bookingCreatedTutor.body"),
          actionLabel: t("notif.viewCalendar"),
          actionUrl: "/calendar",
          severity: "info",
        }),
      ]);

      toast.success(t("booking.toast.created"));
      navigate("/calendar");
    } catch (e: unknown) {
      console.error(e);
      toast.error(t("booking.toast.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const fmtSlotDay = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  const fmtSlotTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("common.back")}
          </Button>
          <h1 className="text-2xl font-bold">{t("booking.title", { tutor: tutor.display_name || "" })}</h1>
        </div>

        <div className="flex gap-2 text-xs text-muted-foreground">
          {[1,2,3,4].map((s) => (
            <div key={s} className={`flex-1 rounded-full border px-2 py-1 text-center ${step >= s ? "bg-primary/10 border-primary text-primary" : ""}`}>
              {t(`booking.step.${s}`)}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold"><User className="h-4 w-4" /> {t("booking.learner.title")}</h2>
            <RadioGroup value={learnerKind} onValueChange={(v) => setLearnerKind(v as "self" | "child")}>
              <div className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="self" id="lk-self" />
                <Label htmlFor="lk-self" className="cursor-pointer flex-1">{t("booking.learner.self")}</Label>
              </div>
              {isParent && children.length > 0 ? (
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <RadioGroupItem value="child" id="lk-child" />
                  <Label htmlFor="lk-child" className="cursor-pointer flex-1">{t("booking.learner.child")}</Label>
                </div>
              ) : null}
            </RadioGroup>
            {learnerKind === "child" ? (
              <div className="space-y-2 pl-2">
                <Label>{t("booking.learner.selectChild")}</Label>
                <RadioGroup value={childId} onValueChange={setChildId}>
                  {children.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                      <RadioGroupItem value={c.id} id={`c-${c.id}`} />
                      <Label htmlFor={`c-${c.id}`} className="cursor-pointer flex-1">{c.display_name}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                {t("common.next")} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" /> {t("booking.context.title")}</h2>
            <RadioGroup value={topicMode} onValueChange={(v) => setTopicMode(v as "plan_item" | "custom")}>
              {planItems.length > 0 ? (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="plan_item" id="tm-plan" />
                    <Label htmlFor="tm-plan" className="cursor-pointer">{t("booking.context.fromPlan")}</Label>
                  </div>
                  {topicMode === "plan_item" ? (
                    <div className="space-y-1 pl-6">
                      {planItems.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlanItemId(p.id)}
                          className={`block w-full rounded-md border p-2 text-left text-sm transition ${selectedPlanItemId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        >
                          <div className="font-medium">{p.title}</div>
                          {p.skill_area ? <div className="text-xs text-muted-foreground">{p.skill_area}</div> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="tm-custom" />
                  <Label htmlFor="tm-custom" className="cursor-pointer">{t("booking.context.custom")}</Label>
                </div>
                {topicMode === "custom" ? (
                  <Textarea
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder={t("booking.context.customPlaceholder")}
                    rows={3}
                  />
                ) : null}
              </div>
            </RadioGroup>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-4 w-4" />{t("common.back")}</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>{t("common.next")}<ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> {t("booking.time.title")}</h2>
            {bookableSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("booking.time.empty")}</p>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                {Object.entries(grouped).map(([day, daySlots]) => (
                  <div key={day}>
                    <div className="mb-1 text-sm font-medium">{fmtSlotDay(daySlots[0].startsAt)}</div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => setSelectedSlotIso(s.startsAt)}
                          className={`rounded-md border px-3 py-1.5 text-sm transition ${selectedSlotIso === s.startsAt ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
                        >
                          {fmtSlotTime(s.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" />{t("common.back")}</Button>
              <Button onClick={() => setStep(4)} disabled={!selectedSlotIso}>{t("common.next")}<ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 font-semibold"><CalendarCheck2 className="h-4 w-4" /> {t("booking.confirm.title")}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{t("booking.confirm.tutor")}</span><span className="font-medium">{tutor.display_name}</span></div>
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">{t("booking.confirm.learner")}</span>
                <span className="font-medium">
                  {learnerKind === "self" ? t("booking.learner.self") : children.find((c) => c.id === childId)?.display_name}
                </span>
              </div>
              <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{t("booking.confirm.topic")}</span><span className="font-medium text-right">{topicMode === "plan_item" ? selectedPlanItem?.title : customTopic}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{t("booking.confirm.time")}</span><span className="font-medium">{fmtSlotDay(selectedSlotIso)} · {fmtSlotTime(selectedSlotIso)}</span></div>
              <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">{t("booking.confirm.price")}</span><span className="font-semibold">{rate.toFixed(0)} {tutor.currency}</span></div>
            </div>
            <Card className="bg-muted/40 p-4 text-xs text-muted-foreground">
              {t("booking.confirm.paymentInstructions")}
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}><ArrowLeft className="mr-1 h-4 w-4" />{t("common.back")}</Button>
              <Button onClick={submit} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("booking.confirm.cta")}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default BookSession;
