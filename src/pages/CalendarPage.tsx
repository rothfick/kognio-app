import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Calendar as CalIcon, Upload, FileCheck2, Check, X, Trophy, Clock,
  CheckCircle2, XCircle, FileText, ExternalLink, AlertTriangle, Loader2, Video,
} from "lucide-react";
import { toast } from "sonner";
import { logBookingEvent } from "@/lib/bookingEvents";
import { createNotification } from "@/lib/notifications";
import { generateHomework, langCode } from "@/lib/homeworkClient";
import { isFeatureEnabled } from "@/config/features";
import { Sparkles } from "lucide-react";

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  price_amount: number | null;
  price_cents: number;
  currency: string;
  tutor_id: string;
  student_id: string | null;
  parent_user_id: string | null;
  child_id: string | null;
  notes: string | null;
  meeting_url: string | null;
  learning_domain_id: string | null;
  education_level_id: string | null;
  competency_id: string | null;
  skill_area_label: string | null;
};

type PaymentRecord = {
  id: string;
  booking_id: string;
  payer_user_id: string | null;
  tutor_user_id: string | null;
  amount: number;
  currency: string;
  status: string;
  proof_url: string | null;
  marked_paid_at: string | null;
  confirmed_at: string | null;
};

type SessionNote = {
  id: string;
  booking_id: string;
  notes: string;
  covered_skill_areas: string[];
  recommended_next_step: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { icon: typeof Clock; cls: string }> = {
  pending:   { icon: Clock,        cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  confirmed: { icon: CheckCircle2, cls: "bg-accent/15 text-accent border-accent/40" },
  completed: { icon: Trophy,       cls: "bg-primary/10 text-primary border-primary/30" },
  cancelled: { icon: XCircle,      cls: "bg-destructive/10 text-destructive border-destructive/40" },
};

const PAYMENT_META: Record<string, string> = {
  unpaid: "bg-muted text-muted-foreground",
  payment_sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmed: "bg-accent/15 text-accent",
  disputed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {t(`calendar.status.${status}`, { defaultValue: status })}
    </span>
  );
};

const PaymentBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  const cls = PAYMENT_META[status] || PAYMENT_META.unpaid;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(`payment.status.${status}`, { defaultValue: status })}
    </span>
  );
};

const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isParent, isStudent, isTutor, isAdmin } = useUserRoles();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [notes, setNotes] = useState<Record<string, SessionNote>>({});
  const [tutorNames, setTutorNames] = useState<Record<string, string>>({});
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [proofBookingId, setProofBookingId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [signedUrlFor, setSignedUrlFor] = useState<string | null>(null);
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);
  const [noteBookingId, setNoteBookingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSkills, setNoteSkills] = useState("");
  const [noteNext, setNoteNext] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [meetingUrlFor, setMeetingUrlFor] = useState<string | null>(null);
  const [meetingUrlValue, setMeetingUrlValue] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: bk } = await supabase
      .from("bookings")
      .select("id, starts_at, ends_at, status, payment_status, price_amount, price_cents, currency, tutor_id, student_id, parent_user_id, child_id, notes, meeting_url, learning_domain_id, education_level_id, competency_id, skill_area_label")
      .order("starts_at", { ascending: true });
    const rows = (bk || []) as Booking[];
    setBookings(rows);

    if (rows.length) {
      const ids = rows.map((b) => b.id);
      const tutorIds = Array.from(new Set(rows.map((b) => b.tutor_id)));
      const childIds = Array.from(new Set(rows.map((b) => b.child_id).filter(Boolean) as string[]));
      const [{ data: pr }, { data: tn }, { data: cn }, { data: nt }] = await Promise.all([
        supabase.from("payment_records").select("id, booking_id, payer_user_id, tutor_user_id, amount, currency, status, proof_url, marked_paid_at, confirmed_at").in("booking_id", ids),
        supabase.from("profiles").select("id, display_name").in("id", tutorIds),
        childIds.length ? supabase.from("parent_children").select("id, display_name").in("id", childIds) : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
        supabase.from("session_notes").select("id, booking_id, notes, covered_skill_areas, recommended_next_step, created_at").in("booking_id", ids),
      ]);
      setPayments(Object.fromEntries(((pr || []) as PaymentRecord[]).map((p) => [p.booking_id, p])));
      setTutorNames(Object.fromEntries(((tn || []) as Array<{ id: string; display_name: string | null }>).map((p) => [p.id, p.display_name || ""])));
      setChildNames(Object.fromEntries(((cn || []) as Array<{ id: string; display_name: string }>).map((c) => [c.id, c.display_name])));
      setNotes(Object.fromEntries(((nt || []) as SessionNote[]).map((n) => [n.booking_id, n])));
    } else {
      setPayments({}); setTutorNames({}); setChildNames({}); setNotes({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const now = Date.now();
  const upcoming = useMemo(() => bookings.filter((b) => new Date(b.ends_at).getTime() >= now && b.status !== "cancelled"), [bookings, now]);
  const past = useMemo(() => bookings.filter((b) => new Date(b.ends_at).getTime() < now || b.status === "cancelled"), [bookings, now]);

  const fmtDay = (iso: string) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  // --- Actions ---
  const openProofUpload = (bookingId: string) => { setProofBookingId(bookingId); setProofFile(null); };

  const uploadProof = async () => {
    if (!proofFile || !proofBookingId || !user) return;
    const payment = payments[proofBookingId];
    if (!payment) {
      toast.error(t("payment.toast.noPaymentRecord"));
      setProofBookingId(null);
      return;
    }
    setProofUploading(true);
    try {
      const ext = proofFile.name.split(".").pop() || "bin";
      const path = `${proofBookingId}/${payment.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile, { upsert: false, contentType: proofFile.type });
      if (upErr) throw upErr;
      const { error: pErr } = await supabase
        .from("payment_records")
        .update({ proof_url: path, status: "proof_uploaded", marked_paid_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (pErr) throw pErr;

      const booking = bookings.find((b) => b.id === proofBookingId)!;
      await logBookingEvent({
        eventType: "payment_proof_uploaded",
        bookingId: proofBookingId,
        userId: user.id,
        ownerUserId: booking.student_id,
        childId: booking.child_id,
        learningDomainId: booking.learning_domain_id,
        educationLevelId: booking.education_level_id,
        competencyId: booking.competency_id,
        skillAreaLabel: booking.skill_area_label,
        status: booking.status,
        paymentStatus: "payment_sent",
      });
      await createNotification({
        userId: booking.tutor_id,
        type: "payment_proof_uploaded",
        title: t("notif.paymentProofUploaded.title"),
        body: t("notif.paymentProofUploaded.body"),
        actionLabel: t("notif.viewCalendar"),
        actionUrl: "/calendar",
        severity: "info",
      });
      toast.success(t("payment.toast.proofUploaded"));
      setProofBookingId(null); setProofFile(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(t("payment.toast.proofFailed"));
    } finally {
      setProofUploading(false);
    }
  };

  const viewProof = async (paymentId: string) => {
    const payment = Object.values(payments).find((p) => p.id === paymentId);
    if (!payment?.proof_url) {
      toast.error(t("payment.toast.noPaymentRecord"));
      return;
    }
    setSignedUrlFor(paymentId);
    setSignedUrlLoading(true);
    try {
      const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(payment.proof_url, 60 * 5);
      if (error || !data?.signedUrl) throw error || new Error("no_url");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("payment.toast.signedUrlFailed"));
    } finally {
      setSignedUrlFor(null); setSignedUrlLoading(false);
    }
  };

  const confirmPayment = async (booking: Booking) => {
    if (!user) return;
    const payment = payments[booking.id];
    if (!payment) {
      toast.error(t("payment.toast.noPaymentRecord"));
      return;
    }
    if (payment.status === "confirmed") {
      toast.info(t("payment.toast.alreadyConfirmed"));
      return;
    }
    if (user.id === payment.payer_user_id) {
      toast.error(t("payment.toast.payerCannotConfirm"));
      return;
    }
    try {
      const { error } = await supabase
        .from("payment_records")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (error) throw error;
      await logBookingEvent({
        eventType: "payment_confirmed",
        bookingId: booking.id,
        userId: user.id,
        ownerUserId: booking.student_id,
        childId: booking.child_id,
        learningDomainId: booking.learning_domain_id,
        educationLevelId: booking.education_level_id,
        competencyId: booking.competency_id,
        skillAreaLabel: booking.skill_area_label,
        status: booking.status,
        paymentStatus: "confirmed",
      });
      const payerId = payment.payer_user_id || booking.student_id || booking.parent_user_id;
      if (payerId) {
        await createNotification({
          userId: payerId,
          type: "payment_confirmed",
          title: t("notif.paymentConfirmed.title"),
          body: t("notif.paymentConfirmed.body"),
          actionLabel: t("notif.viewCalendar"),
          actionUrl: "/calendar",
          severity: "success",
        });
      }
      toast.success(t("payment.toast.confirmed"));
      await load();
    } catch (e) {
      console.error(e); toast.error(t("payment.toast.confirmFailed"));
    }
  };

  const markCompleted = async (booking: Booking) => {
    if (!user) return;
    const payment = payments[booking.id];
    if (!payment || payment.status !== "confirmed") {
      toast.error(t("payment.toast.notConfirmedYet"));
      return;
    }
    try {
      const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id);
      if (error) throw error;
      await logBookingEvent({
        eventType: "session_completed",
        bookingId: booking.id, userId: user.id,
        ownerUserId: booking.student_id, childId: booking.child_id,
        learningDomainId: booking.learning_domain_id, educationLevelId: booking.education_level_id,
        competencyId: booking.competency_id, skillAreaLabel: booking.skill_area_label,
        status: "completed", paymentStatus: booking.payment_status,
      });
      const payerId = booking.student_id || booking.parent_user_id;
      if (payerId) {
        await createNotification({
          userId: payerId, type: "session_completed",
          title: t("notif.sessionCompleted.title"), body: t("notif.sessionCompleted.body"),
          actionLabel: t("notif.viewCalendar"), actionUrl: "/calendar", severity: "success",
        });
      }
      toast.success(t("calendar.completedToast"));
      await load();
    } catch { toast.error(t("calendar.actionFailed")); }
  };

  const cancelBooking = async (booking: Booking) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
      if (error) throw error;
      const otherId = booking.tutor_id === user.id ? (booking.student_id || booking.parent_user_id) : booking.tutor_id;
      if (otherId) {
        await createNotification({
          userId: otherId, type: "booking_cancelled",
          title: t("notif.bookingCancelled.title"), body: t("notif.bookingCancelled.body"),
          actionLabel: t("notif.viewCalendar"), actionUrl: "/calendar", severity: "warning",
        });
      }
      toast.success(t("calendar.cancelToast"));
      await load();
    } catch { toast.error(t("calendar.actionFailed")); }
  };

  const openMeetingUrl = (booking: Booking) => {
    setMeetingUrlFor(booking.id); setMeetingUrlValue(booking.meeting_url || "");
  };
  const saveMeetingUrl = async () => {
    if (!meetingUrlFor) return;
    const { error } = await supabase.from("bookings").update({ meeting_url: meetingUrlValue.trim() || null }).eq("id", meetingUrlFor);
    if (error) toast.error(t("calendar.actionFailed"));
    else { toast.success(t("calendar.meetingUrlSaved")); setMeetingUrlFor(null); await load(); }
  };

  const openNote = (booking: Booking) => {
    const existing = notes[booking.id];
    setNoteBookingId(booking.id);
    setNoteText(existing?.notes || "");
    setNoteSkills((existing?.covered_skill_areas || []).join(", "));
    setNoteNext(existing?.recommended_next_step || "");
  };
  const saveNote = async () => {
    if (!noteBookingId || !user) return;
    const booking = bookings.find((b) => b.id === noteBookingId);
    if (!booking) return;
    if (!noteText.trim()) {
      toast.error(t("session.noteEmpty"));
      return;
    }
    setNoteSaving(true);
    try {
      const skills = noteSkills.split(",").map((s) => s.trim()).filter(Boolean);
      const existing = notes[noteBookingId];
      const payload = {
        booking_id: noteBookingId,
        tutor_user_id: user.id,
        learner_user_id: booking.student_id,
        child_id: booking.child_id,
        notes: noteText,
        covered_skill_areas: skills,
        recommended_next_step: noteNext.trim() || null,
      };
      let error: unknown;
      if (existing) {
        ({ error } = await supabase.from("session_notes").update(payload).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("session_notes").insert(payload as never));
      }
      if (error) throw error;
      await logBookingEvent({
        eventType: "tutor_note_submitted",
        bookingId: noteBookingId, userId: user.id,
        ownerUserId: booking.student_id, childId: booking.child_id,
        learningDomainId: booking.learning_domain_id, educationLevelId: booking.education_level_id,
        competencyId: booking.competency_id, skillAreaLabel: booking.skill_area_label,
        status: booking.status, paymentStatus: booking.payment_status,
      });
      const payerId = booking.student_id || booking.parent_user_id;
      if (payerId) {
        await createNotification({
          userId: payerId, type: "tutor_note_submitted",
          title: t("notif.tutorNote.title"), body: t("notif.tutorNote.body"),
          actionLabel: t("notif.viewCalendar"), actionUrl: "/calendar", severity: "info",
        });
      }
      toast.success(t("session.noteSaved"));
      setNoteBookingId(null);
      await load();
    } catch (e) { console.error(e); toast.error(t("session.noteFailed")); }
    finally { setNoteSaving(false); }
  };

  // --- Render helpers ---
  const renderBookingCard = (b: Booking) => {
    if (!user) return null;
    const isMyTutor = user.id === b.tutor_id;
    const isMyPayer = user.id === b.student_id || user.id === b.parent_user_id;
    const learnerName = b.child_id ? childNames[b.child_id] : (isMyTutor ? t("calendar.studentLabel") : t("booking.learner.self"));
    const payment = payments[b.id];
    const note = notes[b.id];
    const inFuture = new Date(b.starts_at).getTime() > Date.now();

    return (
      <Card key={b.id} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">{fmtDay(b.starts_at)} · {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)}</div>
            <div className="text-xs text-muted-foreground">
              {isMyTutor ? <>{t("calendar.with")}: {learnerName}</> : <>{t("calendar.tutor")}: {tutorNames[b.tutor_id] || "—"}</>}
              {b.child_id && !isMyTutor ? <> · {childNames[b.child_id]}</> : null}
            </div>
            {b.notes ? <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.notes}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            <PaymentBadge status={b.payment_status} />
            <Badge variant="outline">{(b.price_amount ?? b.price_cents / 100).toFixed(0)} {b.currency}</Badge>
          </div>
        </div>

        {b.meeting_url ? (
          <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Video className="h-3.5 w-3.5" /> {t("calendar.joinMeeting")} <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {/* Payer actions */}
          {isMyPayer && payment && (payment.status === "pending") ? (
            <Button size="sm" variant="outline" onClick={() => openProofUpload(b.id)}>
              <Upload className="mr-1 h-3.5 w-3.5" /> {t("payment.uploadProof")}
            </Button>
          ) : null}
          {isMyPayer && payment && (payment.status === "proof_uploaded") ? (
            <Button size="sm" variant="outline" onClick={() => openProofUpload(b.id)}>
              <Upload className="mr-1 h-3.5 w-3.5" /> {t("payment.replaceProof")}
            </Button>
          ) : null}
          {isMyPayer && inFuture && (b.status === "pending" || b.status === "confirmed") ? (
            <Button size="sm" variant="ghost" onClick={() => cancelBooking(b)}>
              <X className="mr-1 h-3.5 w-3.5" /> {t("calendar.cancel")}
            </Button>
          ) : null}

          {/* Tutor actions */}
          {isMyTutor && payment?.proof_url ? (
            <Button size="sm" variant="outline" onClick={() => viewProof(payment.id)} disabled={signedUrlFor === payment.id && signedUrlLoading}>
              <FileText className="mr-1 h-3.5 w-3.5" /> {t("payment.viewProof")}
            </Button>
          ) : null}
          {isMyTutor && payment && payment.status === "proof_uploaded" ? (
            <Button size="sm" onClick={() => confirmPayment(b)}>
              <FileCheck2 className="mr-1 h-3.5 w-3.5" /> {t("payment.confirm")}
            </Button>
          ) : null}
          {isMyTutor && (b.status === "pending" || b.status === "confirmed") ? (
            <>
              <Button size="sm" variant="outline" onClick={() => openMeetingUrl(b)}>
                <Video className="mr-1 h-3.5 w-3.5" /> {b.meeting_url ? t("calendar.editMeetingUrl") : t("calendar.addMeetingUrl")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markCompleted(b)}
                disabled={!payment || payment.status !== "confirmed"}
                title={!payment || payment.status !== "confirmed" ? t("payment.toast.notConfirmedYet") : undefined}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> {t("calendar.markCompleted")}
              </Button>
            </>
          ) : null}
          {isMyTutor && b.status === "completed" ? (
            <Button size="sm" onClick={() => openNote(b)}>
              <FileText className="mr-1 h-3.5 w-3.5" /> {note ? t("session.editNote") : t("session.addNote")}
            </Button>
          ) : null}

          {/* Admin actions */}
          {isAdmin && payment && payment.status === "proof_uploaded" ? (
            <Button size="sm" variant="outline" onClick={() => confirmPayment(b)}>
              <FileCheck2 className="mr-1 h-3.5 w-3.5" /> {t("payment.adminConfirm")}
            </Button>
          ) : null}
          {isAdmin && payment?.proof_url ? (
            <Button size="sm" variant="ghost" onClick={() => viewProof(payment.id)}>
              <FileText className="mr-1 h-3.5 w-3.5" /> {t("payment.viewProof")}
            </Button>
          ) : null}
        </div>

        {/* Note display for learner/parent */}
        {note && !isMyTutor ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> {t("session.noteFromTutor")}
            </div>
            <div className="whitespace-pre-line">{note.notes}</div>
            {note.covered_skill_areas?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {note.covered_skill_areas.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
              </div>
            ) : null}
            {note.recommended_next_step ? (
              <div className="mt-2 text-xs"><span className="text-muted-foreground">{t("session.recommendedNext")}:</span> {note.recommended_next_step}</div>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("calendar.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/discover"><CalIcon className="mr-1 h-4 w-4" /> {t("calendar.findTutor")}</Link>
          </Button>
        </header>

        {loading ? (
          <Card className="h-40 animate-pulse" />
        ) : (
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">{t("calendar.upcoming")} ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="past">{t("calendar.past")} ({past.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4 space-y-3">
              {upcoming.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">{t("calendar.empty")}</Card> : upcoming.map(renderBookingCard)}
            </TabsContent>
            <TabsContent value="past" className="mt-4 space-y-3">
              {past.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">{t("calendar.emptyPast")}</Card> : past.map(renderBookingCard)}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Proof upload */}
      <Dialog open={!!proofBookingId} onOpenChange={(o) => !o && setProofBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payment.uploadProof")}</DialogTitle>
            <DialogDescription>{t("payment.uploadHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> {t("payment.privacyHint")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProofBookingId(null)} disabled={proofUploading}>{t("common.cancel")}</Button>
            <Button onClick={uploadProof} disabled={!proofFile || proofUploading}>
              {proofUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t("payment.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session note */}
      <Dialog open={!!noteBookingId} onOpenChange={(o) => !o && setNoteBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("session.noteTitle")}</DialogTitle>
            <DialogDescription>{t("session.noteHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="note-text">{t("session.notesLabel")}</Label>
              <Textarea id="note-text" rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="note-skills">{t("session.skillsLabel")}</Label>
              <Input id="note-skills" value={noteSkills} onChange={(e) => setNoteSkills(e.target.value)} placeholder={t("session.skillsPlaceholder")} />
            </div>
            <div>
              <Label htmlFor="note-next">{t("session.nextLabel")}</Label>
              <Input id="note-next" value={noteNext} onChange={(e) => setNoteNext(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteBookingId(null)} disabled={noteSaving}>{t("common.cancel")}</Button>
            <Button onClick={saveNote} disabled={noteSaving || !noteText.trim()}>
              {noteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting URL */}
      <Dialog open={!!meetingUrlFor} onOpenChange={(o) => !o && setMeetingUrlFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.meetingUrlTitle")}</DialogTitle>
            <DialogDescription>{t("calendar.meetingUrlHint")}</DialogDescription>
          </DialogHeader>
          <Input value={meetingUrlValue} onChange={(e) => setMeetingUrlValue(e.target.value)} placeholder="https://meet.google.com/..." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMeetingUrlFor(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveMeetingUrl}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default CalendarPage;
