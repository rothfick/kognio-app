import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Video, MessageSquare, FileText, PenTool, Loader2, Send, AlertTriangle,
  PlayCircle, StopCircle, BookOpen, Sparkles, ArrowLeft, LogOut,
  Mic, Activity, Bot, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { createNotification } from "@/lib/notifications";
import { logLiveEvidence } from "@/lib/liveSessionEvents";
import { generateHomework } from "@/lib/homeworkClient";
import { LessonTranscriptionPanel } from "@/components/lesson/LessonTranscriptionPanel";
import { EngagementSignalsPanel } from "@/components/lesson/EngagementSignalsPanel";
import { LessonCopilotPanel } from "@/components/lesson/LessonCopilotPanel";
import { LessonSummaryPanel } from "@/components/lesson/LessonSummaryPanel";
import { ResearchConsentDialog, type ConsentType } from "@/components/pilot/ResearchConsentDialog";
import { isFeatureEnabled } from "@/config/features";

type Booking = {
  id: string;
  student_id: string;
  tutor_id: string;
  parent_user_id: string | null;
  child_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string;
  skill_area_label: string | null;
  notes: string | null;
  meeting_url: string | null;
  learning_plan_item_id: string | null;
  competency_id: string | null;
};

type LiveSession = {
  id: string;
  booking_id: string;
  room_name: string;
  status: "scheduled" | "live" | "ended" | "failed";
  started_at: string | null;
  ended_at: string | null;
};

type ChatEvent = {
  id: string;
  user_id: string | null;
  payload: { text?: string; name?: string };
  created_at: string;
};

type WhiteboardState = { text: string; updated_by?: string | null; updated_at?: string };

type TokenResponse = {
  url: string;
  token: string;
  roomName: string;
  participantRole: "student" | "parent" | "tutor" | "admin";
};

const LiveLessonRoom = () => {
  const { t, i18n } = useTranslation();
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "forbidden" | "setup_required" | "load_error" | null>(null);
  const [missingEnv, setMissingEnv] = useState<string[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [tutorName, setTutorName] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [planItem, setPlanItem] = useState<{ skill_area_label: string | null } | null>(null);
  const [competency, setCompetency] = useState<{ name: string } | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [participantRole, setParticipantRole] = useState<TokenResponse["participantRole"] | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  // chat
  const [chat, setChat] = useState<ChatEvent[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  // notes
  const [noteText, setNoteText] = useState("");
  const [noteSkills, setNoteSkills] = useState("");
  const [noteNext, setNoteNext] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);

  // whiteboard
  const [board, setBoard] = useState<WhiteboardState>({ text: "" });
  const [savingBoard, setSavingBoard] = useState(false);

  // session control
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState<string>("");

  // intelligence consents (booking-scoped checks)
  const [hasTranscriptionConsent, setHasTranscriptionConsent] = useState(false);
  const [hasEngagementConsent, setHasEngagementConsent] = useState(false);
  const [hasCopilotConsent, setHasCopilotConsent] = useState(false);
  const [consentDialog, setConsentDialog] = useState<ConsentType | null>(null);

  const isTutor = participantRole === "tutor";
  const isAdmin = participantRole === "admin";
  const canControl = isTutor || isAdmin;

  const intelEnabled = isFeatureEnabled("lessonIntelligence");
  const transcriptionEnabled = intelEnabled && isFeatureEnabled("lessonTranscription");
  const engagementEnabled = intelEnabled && isFeatureEnabled("lessonEngagementSignals");
  const copilotEnabled = intelEnabled && isFeatureEnabled("lessonAiCopilot");
  const summaryEnabled = intelEnabled && isFeatureEnabled("lessonSummaries");

  // ------- Load booking + live session ----------
  const loadAll = useCallback(async () => {
    if (!bookingId || !user) return;
    setLoading(true); setError(null);
    try {
      const { data: b, error: be } = await supabase
        .from("bookings")
        .select("id, student_id, tutor_id, parent_user_id, child_id, starts_at, ends_at, status, payment_status, skill_area_label, notes, meeting_url, learning_plan_item_id, competency_id")
        .eq("id", bookingId).maybeSingle();
      if (be) throw be;
      if (!b) { setError("not_found"); setLoading(false); return; }
      const isParticipant =
        b.student_id === user.id || b.tutor_id === user.id || b.parent_user_id === user.id;
      if (!isParticipant) {
        // admin?
        const { data: roleRow } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (!roleRow) { setError("forbidden"); setLoading(false); return; }
      }
      setBooking(b as Booking);

      const [{ data: ls }, { data: tutorP }, { data: stuP }] = await Promise.all([
        supabase.from("live_sessions").select("id, booking_id, room_name, status, started_at, ended_at").eq("booking_id", b.id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", b.tutor_id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", b.student_id).maybeSingle(),
      ]);
      setLiveSession(ls as LiveSession | null);
      setTutorName(tutorP?.display_name || "");
      setStudentName(stuP?.display_name || "");

      // Optional context
      if (b.learning_plan_item_id) {
        const { data: pi } = await supabase.from("learning_plan_items").select("skill_area").eq("id", b.learning_plan_item_id).maybeSingle();
        if (pi) setPlanItem({ skill_area_label: (pi as { skill_area: string | null }).skill_area ?? null });
      }
      if (b.competency_id) {
        const { data: c } = await supabase.from("competencies").select("name_pl, name_en, name_es").eq("id", b.competency_id).maybeSingle();
        if (c) {
          const cc = c as { name_pl: string | null; name_en: string | null; name_es: string | null };
          const lang = (i18n.language || "pl").split("-")[0];
          const nm = (lang === "en" ? cc.name_en : lang === "es" ? cc.name_es : cc.name_pl) || cc.name_pl || cc.name_en || "";
          setCompetency({ name: nm });
        }
      }

      // Load existing note
      const { data: existingNote } = await supabase
        .from("session_notes")
        .select("id, notes, covered_skill_areas, recommended_next_step")
        .eq("booking_id", b.id).maybeSingle();
      if (existingNote) {
        setNoteId((existingNote as { id: string }).id);
        setNoteText((existingNote as { notes: string | null }).notes ?? "");
        setNoteSkills(((existingNote as { covered_skill_areas: string[] | null }).covered_skill_areas ?? []).join(", "));
        setNoteNext((existingNote as { recommended_next_step: string | null }).recommended_next_step ?? "");
      }

      // Load chat & whiteboard from events
      const { data: evs } = await supabase
        .from("live_session_events")
        .select("id, user_id, event_type, payload, created_at")
        .eq("booking_id", b.id)
        .order("created_at", { ascending: true });
      const chatEvs: ChatEvent[] = [];
      let lastBoard: WhiteboardState | null = null;
      (evs ?? []).forEach((e: { id: string; user_id: string | null; event_type: string; payload: unknown; created_at: string }) => {
        if (e.event_type === "chat_message") {
          chatEvs.push({ id: e.id, user_id: e.user_id, payload: (e.payload as ChatEvent["payload"]) ?? {}, created_at: e.created_at });
        } else if (e.event_type === "whiteboard_event") {
          lastBoard = { ...(e.payload as WhiteboardState), updated_at: e.created_at };
        }
      });
      setChat(chatEvs);
      if (lastBoard) setBoard(lastBoard);
    } catch (e) {
      console.error("loadAll", e);
      setError("load_error");
    } finally {
      setLoading(false);
    }
  }, [bookingId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: chat + live_sessions
  useEffect(() => {
    if (!booking) return;
    const ch = supabase.channel(`live-${booking.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "live_session_events", filter: `booking_id=eq.${booking.id}` },
        (p) => {
          const e = p.new as { id: string; user_id: string | null; event_type: string; payload: ChatEvent["payload"] | WhiteboardState; created_at: string };
          if (e.event_type === "chat_message") {
            setChat((prev) => prev.some(x => x.id === e.id) ? prev : [...prev, { id: e.id, user_id: e.user_id, payload: e.payload as ChatEvent["payload"], created_at: e.created_at }]);
          } else if (e.event_type === "whiteboard_event") {
            setBoard({ ...(e.payload as WhiteboardState), updated_at: e.created_at });
          }
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `booking_id=eq.${booking.id}` },
        (p) => setLiveSession(p.new as LiveSession))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [booking]);

  // Auto-scroll chat
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // Elapsed timer
  useEffect(() => {
    if (!liveSession?.started_at || liveSession.status !== "live") { setElapsed(""); return; }
    const tick = () => {
      const diff = Date.now() - new Date(liveSession.started_at as string).getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
      setElapsed(`${m}:${s}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [liveSession]);

  // ---- Join / token ----
  const fetchToken = async () => {
    if (!booking || !user) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("livekit-token-v2", {
        body: { booking_id: booking.id },
      });
      if (error) throw error;
      const resp = data as TokenResponse | { error: string; missing?: string[] };
      if ("error" in resp) {
        if (resp.error === "setup_required") {
          setMissingEnv(resp.missing ?? []);
          setError("setup_required");
        } else {
          toast.error(t(`liveLesson.errors.${resp.error}`, { defaultValue: resp.error }));
        }
        return;
      }
      setToken(resp.token);
      setWsUrl(resp.url);
      setParticipantRole(resp.participantRole);
      setJoined(true);

      // events
      await supabase.from("live_session_events").insert({
        booking_id: booking.id, user_id: user.id, event_type: "participant_joined",
        payload: { role: resp.participantRole },
      });
      await logLiveEvidence("live_session_joined", { userId: user.id, bookingId: booking.id, role: resp.participantRole });

      // refresh live session
      const { data: ls } = await supabase
        .from("live_sessions").select("id, booking_id, room_name, status, started_at, ended_at")
        .eq("booking_id", booking.id).maybeSingle();
      setLiveSession(ls as LiveSession | null);
    } catch (e: unknown) {
      console.error(e);
      toast.error(t("liveLesson.tokenError"));
    } finally {
      setJoining(false);
    }
  };

  const sendChat = async () => {
    if (!user || !booking) return;
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    const { error } = await supabase.from("live_session_events").insert({
      booking_id: booking.id, user_id: user.id, event_type: "chat_message",
      payload: { text, name: participantRole ?? "user" },
    });
    if (error) { toast.error(t("chat.sendFailed")); return; }
    await logLiveEvidence("live_chat_message_sent", {
      userId: user.id, bookingId: booking.id, role: participantRole ?? undefined,
      metrics: { length: text.length },
    });
  };

  const updateBoard = async () => {
    if (!user || !booking) return;
    setSavingBoard(true);
    try {
      const payload: WhiteboardState = { text: board.text, updated_by: user.id };
      const { error } = await supabase.from("live_session_events").insert({
        booking_id: booking.id, user_id: user.id, event_type: "whiteboard_event", payload,
      });
      if (error) throw error;
      await logLiveEvidence("live_whiteboard_updated", {
        userId: user.id, bookingId: booking.id, role: participantRole ?? undefined,
      });
      toast.success(t("whiteboard.saved"));
    } catch (e) {
      console.error(e); toast.error(t("whiteboard.saveFailed"));
    } finally { setSavingBoard(false); }
  };

  const resetBoard = async () => {
    if (!canControl) return;
    setBoard({ text: "" });
    await supabase.from("live_session_events").insert({
      booking_id: booking!.id, user_id: user!.id, event_type: "whiteboard_event",
      payload: { text: "", updated_by: user!.id },
    });
  };

  const saveNote = async () => {
    if (!isTutor || !booking || !user) return;
    if (!noteText.trim()) { toast.error(t("session.noteEmpty")); return; }
    setSavingNote(true);
    try {
      const skills = noteSkills.split(",").map(s => s.trim()).filter(Boolean);
      const payload = {
        booking_id: booking.id,
        tutor_user_id: user.id,
        learner_user_id: booking.student_id,
        child_id: booking.child_id,
        notes: noteText.trim(),
        covered_skill_areas: skills,
        recommended_next_step: noteNext.trim() || null,
      };
      let saveErr: unknown = null;
      if (noteId) {
        const { error } = await supabase.from("session_notes").update(payload).eq("id", noteId);
        saveErr = error;
      } else {
        const { data, error } = await supabase.from("session_notes").insert(payload as never).select("id").single();
        saveErr = error;
        if (data) setNoteId((data as { id: string }).id);
      }
      if (saveErr) throw saveErr;

      // Notifications + SMART
      const learnerId = booking.parent_user_id || booking.student_id;
      await createNotification({
        userId: learnerId, type: "lesson_note_submitted",
        title: t("notif.lessonNote.title"), body: t("notif.lessonNote.body"),
        actionLabel: t("notif.lessonNote.action"), actionUrl: `/session/${booking.id}`,
        severity: "info",
      });
      await logLiveEvidence("session_completed", { userId: user.id, bookingId: booking.id, role: "tutor" });
      toast.success(t("session.noteSaved"));
    } catch (e) {
      console.error(e); toast.error(t("session.noteFailed"));
    } finally { setSavingNote(false); }
  };

  const startSession = async () => {
    if (!canControl || !booking || !user) return;
    setActing(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("live_sessions")
        .update({ status: "live", started_at: nowIso, started_by: user.id })
        .eq("booking_id", booking.id);
      if (error) throw error;
      await supabase.from("live_session_events").insert({
        booking_id: booking.id, user_id: user.id, event_type: "session_started", payload: {},
      });
      await logLiveEvidence("live_session_started", { userId: user.id, bookingId: booking.id, role: participantRole ?? "tutor" });

      // Notify learner / parent
      const learnerId = booking.parent_user_id || booking.student_id;
      await createNotification({
        userId: learnerId, type: "session_started",
        title: t("notif.sessionStarted.title"), body: t("notif.sessionStarted.body"),
        actionLabel: t("notif.sessionStarted.action"), actionUrl: `/session/${booking.id}`,
        severity: "info",
      });
      toast.success(t("liveLesson.started"));
    } catch (e) {
      console.error(e); toast.error(t("liveLesson.startFailed"));
    } finally { setActing(false); }
  };

  const endSession = async () => {
    if (!canControl || !booking || !user) return;
    setActing(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("live_sessions")
        .update({ status: "ended", ended_at: nowIso, ended_by: user.id })
        .eq("booking_id", booking.id);
      if (error) throw error;
      await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id);
      await supabase.from("live_session_events").insert({
        booking_id: booking.id, user_id: user.id, event_type: "session_ended", payload: {},
      });
      await Promise.all([
        logLiveEvidence("live_session_ended", { userId: user.id, bookingId: booking.id, role: participantRole ?? "tutor" }),
        logLiveEvidence("session_completed", { userId: user.id, bookingId: booking.id, role: participantRole ?? "tutor" }),
      ]);
      const learnerId = booking.parent_user_id || booking.student_id;
      await createNotification({
        userId: learnerId, type: "session_ended",
        title: t("notif.sessionEnded.title"), body: t("notif.sessionEnded.body"),
        actionLabel: t("notif.sessionEnded.action"), actionUrl: `/session/${booking.id}`,
        severity: "info",
      });
      toast.success(t("liveLesson.ended"));
    } catch (e) {
      console.error(e); toast.error(t("liveLesson.endFailed"));
    } finally { setActing(false); }
  };

  const generateHomeworkFromSession = async () => {
    if (!booking || !user) return;
    try {
      const skills = noteSkills.split(",").map(s => s.trim()).filter(Boolean);
      const firstSkill = skills[0] ?? booking.skill_area_label ?? null;
      const res = await generateHomework({
        source_type: "session_note",
        owner_type: booking.child_id ? "child" : "user",
        child_id: booking.child_id ?? null,
        booking_id: booking.id,
        skill_area_label: firstSkill,
        competency_id: booking.competency_id ?? null,
      });
      if (res?.assignment_id) {
        toast.success(t("homework.toast.created"));
        navigate(`/homework/${res.assignment_id}`);
      } else if (res?.error) {
        toast.error(t("homework.toast.createFailed"));
      }
    } catch (e) {
      console.error(e); toast.error(t("homework.toast.createFailed"));
    }
  };

  // ----- render branches -----
  if (loading) {
    return <AppShell><div className="p-8 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (error === "not_found") {
    return <AppShell><div className="p-8 max-w-xl mx-auto text-center">
      <h1 className="text-xl font-semibold mb-2">{t("liveLesson.notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground mb-4">{t("liveLesson.notFoundBody")}</p>
      <Button asChild><Link to="/calendar">{t("common.back")}</Link></Button>
    </div></AppShell>;
  }
  if (error === "forbidden") {
    return <AppShell><div className="p-8 max-w-xl mx-auto text-center">
      <h1 className="text-xl font-semibold mb-2">{t("liveLesson.forbiddenTitle")}</h1>
      <p className="text-sm text-muted-foreground mb-4">{t("liveLesson.forbiddenBody")}</p>
      <Button asChild><Link to="/calendar">{t("common.back")}</Link></Button>
    </div></AppShell>;
  }
  if (error === "setup_required") {
    return <AppShell><div className="p-8 max-w-xl mx-auto text-center">
      <h1 className="text-xl font-semibold mb-2">{t("livekit.setupRequiredTitle")}</h1>
      <p className="text-sm text-muted-foreground mb-2">{t("livekit.setupRequiredBody")}</p>
      {missingEnv.length > 0 && <p className="text-xs text-muted-foreground mb-4">{t("livekit.missing")}: {missingEnv.join(", ")}</p>}
      <Button asChild variant="outline"><Link to="/calendar">{t("common.back")}</Link></Button>
    </div></AppShell>;
  }
  if (error === "load_error" || !booking) {
    return <AppShell><div className="p-8 max-w-xl mx-auto text-center">
      <p className="text-sm text-muted-foreground">{t("common.error")}</p>
    </div></AppShell>;
  }

  const startsAt = new Date(booking.starts_at);
  const lang = (i18n.language || "pl").split("-")[0];
  const fmtDate = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(startsAt);
  const paymentOk = booking.payment_status === "confirmed";
  const sessionStatus: LiveSession["status"] = liveSession?.status ?? "scheduled";

  // ---- pre-join lobby ----
  if (!joined) {
    return (
      <AppShell>
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm"><Link to="/calendar"><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Link></Button>
            <Badge variant="outline">{t(`liveLesson.status.${sessionStatus}`)}</Badge>
          </div>
          <Surface className="p-6">
            <h1 className="text-2xl font-semibold mb-1">{t("liveLesson.lobbyTitle")}</h1>
            <p className="text-sm text-muted-foreground mb-4">{t("liveLesson.lobbyBody")}</p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
              <div><span className="text-muted-foreground">{t("liveLesson.tutor")}:</span> <strong>{tutorName || "—"}</strong></div>
              <div><span className="text-muted-foreground">{t("liveLesson.learner")}:</span> <strong>{studentName || "—"}</strong></div>
              <div><span className="text-muted-foreground">{t("liveLesson.scheduledAt")}:</span> <strong>{fmtDate}</strong></div>
              <div><span className="text-muted-foreground">{t("liveLesson.topic")}:</span> <strong>{booking.skill_area_label || competency?.name || planItem?.skill_area_label || "—"}</strong></div>
              <div><span className="text-muted-foreground">{t("liveLesson.bookingStatus")}:</span> <Badge variant="secondary">{t(`calendar.status.${booking.status}`, { defaultValue: booking.status })}</Badge></div>
              <div><span className="text-muted-foreground">{t("liveLesson.paymentStatus")}:</span> <Badge variant={paymentOk ? "default" : "outline"}>{t(`payment.status.${booking.payment_status}`, { defaultValue: booking.payment_status })}</Badge></div>
            </div>
            {!paymentOk && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{t("liveLesson.paymentWarning")}</p>
              </div>
            )}
            <Button onClick={fetchToken} disabled={joining} className="bg-accent-gradient text-accent-foreground">
              {joining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
              {t("liveLesson.joinCta")}
            </Button>
          </Surface>
        </div>
      </AppShell>
    );
  }

  // ---- live room ----
  return (
    <AppShell>
      <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-3">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate flex items-center gap-2">
              <Video className="h-4 w-4 text-accent" />
              {booking.skill_area_label || competency?.name || t("liveLesson.lessonTitle")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {fmtDate} · {tutorName || "—"} ↔ {studentName || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`liveLesson.status.${sessionStatus}`)}</Badge>
            {elapsed && <Badge variant="secondary">{t("liveLesson.elapsed")}: {elapsed}</Badge>}
            {canControl && sessionStatus === "scheduled" && (
              <Button size="sm" onClick={startSession} disabled={acting} className="bg-accent-gradient text-accent-foreground">
                <PlayCircle className="h-4 w-4 mr-1" />{t("liveLesson.startCta")}
              </Button>
            )}
            {canControl && sessionStatus === "live" && (
              <Button size="sm" variant="destructive" onClick={endSession} disabled={acting}>
                <StopCircle className="h-4 w-4 mr-1" />{t("liveLesson.endCta")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate("/calendar")}>
              <LogOut className="h-4 w-4 mr-1" />{t("liveLesson.leave")}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-3">
          {/* video */}
          <Card className="overflow-hidden">
            {token && wsUrl ? (
              <div className="h-[60vh] min-h-[420px]" data-lk-theme="default">
                <LiveKitRoom
                  token={token}
                  serverUrl={wsUrl}
                  connect
                  video
                  audio
                  onDisconnected={async () => {
                    if (user && booking) {
                      await supabase.from("live_session_events").insert({
                        booking_id: booking.id, user_id: user.id,
                        event_type: "participant_left", payload: { role: participantRole },
                      });
                    }
                    setJoined(false); setToken(null);
                  }}
                  style={{ height: "100%" }}
                >
                  <VideoConference />
                </LiveKitRoom>
              </div>
            ) : (
              <div className="aspect-video grid place-items-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </Card>

          {/* side panel */}
          <Card className="p-3">
            <Tabs defaultValue="context">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="context" title={t("liveLesson.tabContext")}><BookOpen className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="chat" title={t("liveLesson.tabChat")}><MessageSquare className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="notes" title={t("liveLesson.tabNotes")}><FileText className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="board" title={t("liveLesson.tabBoard")}><PenTool className="h-4 w-4" /></TabsTrigger>
              </TabsList>

              {/* context */}
              <TabsContent value="context" className="space-y-2 text-sm mt-3">
                <h3 className="font-semibold">{t("liveLesson.context")}</h3>
                <p><span className="text-muted-foreground">{t("liveLesson.topic")}:</span> {booking.skill_area_label || "—"}</p>
                {competency && <p><span className="text-muted-foreground">{t("liveLesson.competency")}:</span> {competency.name}</p>}
                {planItem?.skill_area_label && <p><span className="text-muted-foreground">{t("liveLesson.planItem")}:</span> {planItem.skill_area_label}</p>}
                {booking.notes && <p><span className="text-muted-foreground">{t("liveLesson.goal")}:</span> {booking.notes}</p>}
                <p><span className="text-muted-foreground">{t("liveLesson.paymentStatus")}:</span> <Badge variant={paymentOk ? "default" : "outline"}>{t(`payment.status.${booking.payment_status}`, { defaultValue: booking.payment_status })}</Badge></p>
              </TabsContent>

              {/* chat */}
              <TabsContent value="chat" className="mt-3">
                <div className="h-[50vh] flex flex-col">
                  <div className="flex-1 overflow-auto space-y-2 pr-1">
                    {chat.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("chat.empty")}</p>
                    ) : chat.map(m => (
                      <div key={m.id} className={`text-sm rounded-md px-2 py-1 ${m.user_id === user?.id ? "bg-accent/10 ml-6" : "bg-muted mr-6"}`}>
                        <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</p>
                        <p className="break-words">{m.payload?.text}</p>
                      </div>
                    ))}
                    <div ref={chatEnd} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }}
                      placeholder={t("chat.placeholder")} />
                    <Button size="sm" onClick={sendChat} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>

              {/* notes */}
              <TabsContent value="notes" className="mt-3 space-y-2 text-sm">
                {isTutor ? (
                  <>
                    <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t("session.notesLabel")} rows={5} />
                    <Input value={noteSkills} onChange={(e) => setNoteSkills(e.target.value)} placeholder={t("session.skillsPlaceholder")} />
                    <Input value={noteNext} onChange={(e) => setNoteNext(e.target.value)} placeholder={t("session.nextLabel")} />
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={saveNote} disabled={savingNote || !noteText.trim()}>
                        {savingNote ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                        {t("session.saveNote")}
                      </Button>
                      {noteId && (
                        <Button size="sm" variant="outline" onClick={generateHomeworkFromSession}>
                          <Sparkles className="h-4 w-4 mr-1" />{t("liveLesson.generateHw")}
                        </Button>
                      )}
                    </div>
                  </>
                ) : noteText ? (
                  <>
                    <p className="font-semibold">{t("session.noteFromTutor")}</p>
                    <p className="whitespace-pre-wrap">{noteText}</p>
                    {noteNext && <p className="text-xs text-muted-foreground">{t("session.recommendedNext")}: {noteNext}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("liveLesson.noteEmpty")}</p>
                )}
              </TabsContent>

              {/* whiteboard */}
              <TabsContent value="board" className="mt-3 space-y-2">
                <Textarea value={board.text} onChange={(e) => setBoard({ ...board, text: e.target.value })}
                  rows={10} placeholder={t("whiteboard.placeholder")} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={updateBoard} disabled={savingBoard}>
                    {savingBoard ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PenTool className="h-4 w-4 mr-1" />}
                    {t("whiteboard.save")}
                  </Button>
                  {canControl && (
                    <Button size="sm" variant="ghost" onClick={resetBoard}>{t("whiteboard.reset")}</Button>
                  )}
                </div>
                {board.updated_at && <p className="text-[10px] text-muted-foreground">{t("whiteboard.updatedAt")}: {new Date(board.updated_at).toLocaleString()}</p>}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default LiveLessonRoom;
