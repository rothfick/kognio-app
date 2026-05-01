import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  Activity, Users, ClipboardList, Sparkles, ClipboardCheck, BadgeCheck,
  Bell, ShieldCheck, AlertTriangle, MessageSquare, RefreshCw,
  TrendingUp, Filter, Inbox,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createNotification, type NotificationType } from "@/lib/notifications";

type OwnerType = "self" | "child";

interface JourneyRow {
  ownerKey: string;
  ownerType: OwnerType;
  anonId: string;
  notifyUserId: string;
  hasConsent: boolean;
  hasDiagnosis: boolean;
  diagnosisInProgress: boolean;
  latestScore: number | null;
  latestAttemptId: string | null;
  hasPlan: boolean;
  planActive: boolean;
  planId: string | null;
  planItemsTotal: number;
  planItemsDone: number;
  hasCheckpoint: boolean;
  checkpointId: string | null;
  hasExpertReview: boolean;
  feedbackCount: number;
  unreadNotifications: number;
  lastActivityAt: string | null;
}

type StuckKey =
  | "ok"
  | "no_consent"
  | "consent_no_diag"
  | "diag_no_plan"
  | "plan_not_active"
  | "active_plan_low_progress"
  | "ready_for_checkpoint"
  | "checkpoint_no_review"
  | "low_feedback";

type FilterKey =
  | "all"
  | "stuck_pre_diag"
  | "diag_no_plan"
  | "plan_not_active"
  | "active_low_progress"
  | "checkpoint_available"
  | "checkpoint_no_review"
  | "missing_consent"
  | "has_feedback"
  | "unread_notifications";

type ActivityRow = {
  id: string;
  ts: string;
  kind: "evidence" | "notification" | "feedback" | "expert_review";
  ownerType: OwnerType | null;
  descKey: string;
  descParams?: Record<string, string | number>;
};

const shortId = (uuid: string) => uuid.replace(/-/g, "").slice(0, 6);
const anonLabel = (uuid: string, type: OwnerType) =>
  `${type === "self" ? "User" : "Child"} #${shortId(uuid)}`;

function computeStuck(row: JourneyRow): StuckKey {
  if (!row.hasConsent && !row.hasDiagnosis) return "no_consent";
  if (row.hasConsent && !row.hasDiagnosis && !row.diagnosisInProgress) return "consent_no_diag";
  if (row.hasDiagnosis && !row.hasPlan) return "diag_no_plan";
  if (row.hasPlan && !row.planActive) return "plan_not_active";
  if (row.planActive && row.planItemsDone < 3) return "active_plan_low_progress";
  if (row.planItemsDone >= 3 && !row.hasCheckpoint) return "ready_for_checkpoint";
  if (row.hasCheckpoint && !row.hasExpertReview) return "checkpoint_no_review";
  return "ok";
}

function recommendedAction(stuck: StuckKey): {
  key: string;
  reminderType: NotificationType | null;
  actionUrl?: string;
} {
  switch (stuck) {
    case "no_consent":
    case "consent_no_diag":
      return { key: "invite_diagnosis", reminderType: "admin_reminder_diagnosis", actionUrl: "/diagnose" };
    case "diag_no_plan":
      return { key: "prompt_plan", reminderType: "admin_reminder_plan", actionUrl: "/dashboard" };
    case "plan_not_active":
    case "active_plan_low_progress":
      return { key: "prompt_steps", reminderType: "admin_reminder_plan", actionUrl: "/dashboard" };
    case "ready_for_checkpoint":
      return { key: "prompt_checkpoint", reminderType: "admin_reminder_checkpoint", actionUrl: "/dashboard" };
    case "checkpoint_no_review":
      return { key: "assign_review", reminderType: "admin_reminder_expert_review", actionUrl: "/dashboard" };
    default:
      return { key: "no_action", reminderType: null };
  }
}

function matchesFilter(row: JourneyRow, f: FilterKey): boolean {
  switch (f) {
    case "all": return true;
    case "stuck_pre_diag": return !row.hasDiagnosis && !row.diagnosisInProgress;
    case "diag_no_plan": return row.hasDiagnosis && !row.hasPlan;
    case "plan_not_active": return row.hasPlan && !row.planActive;
    case "active_low_progress": return row.planActive && row.planItemsDone < 3;
    case "checkpoint_available": return row.planItemsDone >= 3 && !row.hasCheckpoint;
    case "checkpoint_no_review": return row.hasCheckpoint && !row.hasExpertReview;
    case "missing_consent": return !row.hasConsent;
    case "has_feedback": return row.feedbackCount > 0;
    case "unread_notifications": return row.unreadNotifications > 0;
  }
}

interface ConsoleData {
  rows: JourneyRow[];
  stats: {
    profiles: number;
    parents: number;
    students: number;
    children: number;
    diagnosticsCompleted: number;
    plansGenerated: number;
    plansActive: number;
    checkpointsCompleted: number;
    expertReviewsPending: number;
    feedbackEntries: number;
    unreadNotifications: number;
    missingConsents: number;
  };
  activity: ActivityRow[];
  health: {
    score: number;
    diagnosisRate: number;
    planRate: number;
    checkpointRate: number;
    expertCoverage: number;
    feedbackPositive: number;
    consentCoverage: number;
  };
  lowFeedbackOwners: Set<string>;
}

async function loadConsoleData(): Promise<ConsoleData> {
  const [
    profilesRes, rolesRes, childrenRes,
    consentRes, diagRes, plansRes, planItemsRes, cpRes, reviewsRes,
    feedbackRes, notifRes, evidenceRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, created_at"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("parent_children").select("id, parent_id, consent_signed_at, created_at"),
    supabase.from("consent_records").select("user_id, child_id, consent_type, status").eq("status", "accepted"),
    supabase.from("diagnostic_attempts").select("id, user_id, child_id, status, score, completed_at, started_at").order("completed_at", { ascending: false, nullsFirst: false }).limit(2000),
    supabase.from("learning_plans").select("id, user_id, child_id, status, created_at, approved_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("learning_plan_items").select("plan_id, status").limit(10000),
    supabase.from("learning_checkpoints").select("id, user_id, child_id, status, completed_at").order("completed_at", { ascending: false, nullsFirst: false }).limit(2000),
    supabase.from("expert_reviews").select("id, user_id, child_id, status, checkpoint_id, created_at, submitted_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("user_feedback").select("id, user_id, child_id, rating, context_type, created_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("notifications").select("id, user_id, type, status, created_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("smart_evidence_events").select("id, event_type, owner_type, user_id, child_id, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const profiles = (profilesRes.data || []) as { id: string; created_at: string }[];
  const roles = (rolesRes.data || []) as { user_id: string; role: string }[];
  const children = (childrenRes.data || []) as { id: string; parent_id: string; consent_signed_at: string | null; created_at: string }[];
  const consents = (consentRes.data || []) as { user_id: string | null; child_id: string | null; consent_type: string; status: string }[];
  const diags = (diagRes.data || []) as { id: string; user_id: string | null; child_id: string | null; status: string; score: number | null; completed_at: string | null; started_at: string }[];
  const plans = (plansRes.data || []) as { id: string; user_id: string | null; child_id: string | null; status: string; created_at: string; approved_at: string | null }[];
  const planItems = (planItemsRes.data || []) as { plan_id: string; status: string }[];
  const cps = (cpRes.data || []) as { id: string; user_id: string | null; child_id: string | null; status: string; completed_at: string | null }[];
  const reviews = (reviewsRes.data || []) as { id: string; user_id: string | null; child_id: string | null; status: string; checkpoint_id: string | null; created_at: string; submitted_at: string | null }[];
  const feedback = (feedbackRes.data || []) as { id: string; user_id: string | null; child_id: string | null; rating: number | null; context_type: string; created_at: string }[];
  const notifs = (notifRes.data || []) as { id: string; user_id: string; type: string; status: string; created_at: string }[];
  const evidence = (evidenceRes.data || []) as { id: string; event_type: string; owner_type: string | null; user_id: string | null; child_id: string | null; created_at: string }[];

  const rolesByUser = new Map<string, Set<string>>();
  roles.forEach((r) => {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role);
  });
  const isParent = (uid: string) => rolesByUser.get(uid)?.has("parent") ?? false;
  const isStudent = (uid: string) => rolesByUser.get(uid)?.has("student") ?? false;

  const itemsByPlan = new Map<string, { total: number; done: number }>();
  planItems.forEach((it) => {
    const cur = itemsByPlan.get(it.plan_id) || { total: 0, done: 0 };
    cur.total += 1;
    if (it.status === "done") cur.done += 1;
    itemsByPlan.set(it.plan_id, cur);
  });

  type PlanLite = { id: string; status: string; total: number; done: number; createdAt: string };
  const latestPlan = new Map<string, PlanLite>();
  plans.forEach((p) => {
    if (p.status === "archived") return;
    const owner = p.user_id ? `u:${p.user_id}` : p.child_id ? `c:${p.child_id}` : null;
    if (!owner) return;
    if (!latestPlan.has(owner)) {
      const items = itemsByPlan.get(p.id) || { total: 0, done: 0 };
      latestPlan.set(owner, { id: p.id, status: p.status, total: items.total, done: items.done, createdAt: p.created_at });
    }
  });

  type DiagLite = { id: string; score: number | null; completedAt: string | null; inProgress: boolean };
  const latestDiag = new Map<string, DiagLite>();
  const inProgressOwners = new Set<string>();
  diags.forEach((d) => {
    const owner = d.user_id ? `u:${d.user_id}` : d.child_id ? `c:${d.child_id}` : null;
    if (!owner) return;
    if (d.status === "completed" && !latestDiag.has(owner)) {
      latestDiag.set(owner, { id: d.id, score: d.score, completedAt: d.completed_at, inProgress: false });
    }
    if (d.status === "in_progress" || d.status === "started") inProgressOwners.add(owner);
  });

  const latestCp = new Map<string, { id: string; completedAt: string | null }>();
  cps.forEach((c) => {
    const owner = c.user_id ? `u:${c.user_id}` : c.child_id ? `c:${c.child_id}` : null;
    if (!owner) return;
    if (c.status === "completed" && !latestCp.has(owner)) {
      latestCp.set(owner, { id: c.id, completedAt: c.completed_at });
    }
  });

  const hasReview = new Set<string>();
  reviews.forEach((r) => {
    const owner = r.user_id ? `u:${r.user_id}` : r.child_id ? `c:${r.child_id}` : null;
    if (!owner) return;
    if (r.status === "submitted" || r.status === "in_review" || r.status === "draft") hasReview.add(owner);
  });

  const fbCount = new Map<string, number>();
  const lowFbOwners = new Set<string>();
  feedback.forEach((f) => {
    const owner = f.user_id ? `u:${f.user_id}` : f.child_id ? `c:${f.child_id}` : null;
    if (!owner) return;
    fbCount.set(owner, (fbCount.get(owner) || 0) + 1);
    if (f.rating !== null && f.rating <= 2) lowFbOwners.add(owner);
  });

  const unreadByUser = new Map<string, number>();
  notifs.forEach((n) => {
    if (n.status !== "unread") return;
    unreadByUser.set(n.user_id, (unreadByUser.get(n.user_id) || 0) + 1);
  });

  const userHasAiConsent = new Set<string>();
  const childHasParentConsent = new Set<string>();
  consents.forEach((c) => {
    if (c.user_id && c.consent_type === "ai_diagnosis_notice") userHasAiConsent.add(c.user_id);
    if (c.child_id && c.consent_type === "parent_child_data_processing") childHasParentConsent.add(c.child_id);
  });

  const rows: JourneyRow[] = [];

  profiles.forEach((p) => {
    const owner = `u:${p.id}`;
    const include = isStudent(p.id) || latestDiag.has(owner) || latestPlan.has(owner) || latestCp.has(owner);
    if (!include) return;
    const diag = latestDiag.get(owner);
    const plan = latestPlan.get(owner);
    const cp = latestCp.get(owner);
    rows.push({
      ownerKey: owner,
      ownerType: "self",
      anonId: anonLabel(p.id, "self"),
      notifyUserId: p.id,
      hasConsent: userHasAiConsent.has(p.id),
      hasDiagnosis: !!diag,
      diagnosisInProgress: inProgressOwners.has(owner),
      latestScore: diag?.score ?? null,
      latestAttemptId: diag?.id ?? null,
      hasPlan: !!plan,
      planActive: plan?.status === "active",
      planId: plan?.id ?? null,
      planItemsTotal: plan?.total ?? 0,
      planItemsDone: plan?.done ?? 0,
      hasCheckpoint: !!cp,
      checkpointId: cp?.id ?? null,
      hasExpertReview: hasReview.has(owner),
      feedbackCount: fbCount.get(owner) || 0,
      unreadNotifications: unreadByUser.get(p.id) || 0,
      lastActivityAt: cp?.completedAt || diag?.completedAt || plan?.createdAt || p.created_at,
    });
  });

  children.forEach((c) => {
    const owner = `c:${c.id}`;
    const diag = latestDiag.get(owner);
    const plan = latestPlan.get(owner);
    const cp = latestCp.get(owner);
    rows.push({
      ownerKey: owner,
      ownerType: "child",
      anonId: anonLabel(c.id, "child"),
      notifyUserId: c.parent_id,
      hasConsent: childHasParentConsent.has(c.id) || !!c.consent_signed_at,
      hasDiagnosis: !!diag,
      diagnosisInProgress: inProgressOwners.has(owner),
      latestScore: diag?.score ?? null,
      latestAttemptId: diag?.id ?? null,
      hasPlan: !!plan,
      planActive: plan?.status === "active",
      planId: plan?.id ?? null,
      planItemsTotal: plan?.total ?? 0,
      planItemsDone: plan?.done ?? 0,
      hasCheckpoint: !!cp,
      checkpointId: cp?.id ?? null,
      hasExpertReview: hasReview.has(owner),
      feedbackCount: fbCount.get(owner) || 0,
      unreadNotifications: 0,
      lastActivityAt: cp?.completedAt || diag?.completedAt || plan?.createdAt || c.created_at,
    });
  });

  rows.sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""));

  const parentsCount = roles.filter((r) => r.role === "parent").length;
  const studentsCount = roles.filter((r) => r.role === "student").length;
  const diagnosticsCompleted = latestDiag.size;
  const plansGenerated = plans.length;
  const plansActive = plans.filter((p) => p.status === "active").length;
  const checkpointsCompleted = latestCp.size;
  const expertReviewsPending = reviews.filter((r) => r.status !== "submitted").length;
  const feedbackEntries = feedback.length;
  const unreadNotifications = notifs.filter((n) => n.status === "unread").length;

  const missingConsents = rows.filter((r) => !r.hasConsent).length;

  const totalOwners = Math.max(rows.length, 1);
  const diagnosisRate = rows.filter((r) => r.hasDiagnosis).length / totalOwners;
  const planRate = rows.filter((r) => r.hasPlan).length / totalOwners;
  const cpRate = rows.filter((r) => r.hasCheckpoint).length / totalOwners;
  const reviewCoverage = rows.filter((r) => r.hasExpertReview).length / totalOwners;
  const ratedFb = feedback.filter((f) => f.rating !== null);
  const positiveFb = ratedFb.length === 0 ? 0 : ratedFb.filter((f) => (f.rating || 0) >= 4).length / ratedFb.length;
  const consentCoverage = rows.filter((r) => r.hasConsent).length / totalOwners;

  const score =
    diagnosisRate * 20 +
    planRate * 20 +
    cpRate * 20 +
    reviewCoverage * 15 +
    positiveFb * 15 +
    consentCoverage * 10;

  const activity: ActivityRow[] = [];
  evidence.slice(0, 20).forEach((e) => {
    activity.push({
      id: `ev:${e.id}`,
      ts: e.created_at,
      kind: "evidence",
      ownerType: e.child_id ? "child" : "self",
      descKey: `operations.activity.evidence.${e.event_type}`,
      descParams: {},
    });
  });
  notifs.slice(0, 10).forEach((n) => {
    activity.push({
      id: `nf:${n.id}`,
      ts: n.created_at,
      kind: "notification",
      ownerType: "self",
      descKey: "operations.activity.notificationCreated",
      descParams: { type: n.type },
    });
  });
  feedback.slice(0, 10).forEach((f) => {
    activity.push({
      id: `fb:${f.id}`,
      ts: f.created_at,
      kind: "feedback",
      ownerType: f.child_id ? "child" : "self",
      descKey: "operations.activity.feedback",
      descParams: { rating: f.rating ?? "—", context: f.context_type },
    });
  });
  reviews.slice(0, 10).forEach((r) => {
    activity.push({
      id: `er:${r.id}`,
      ts: r.submitted_at || r.created_at,
      kind: "expert_review",
      ownerType: r.child_id ? "child" : "self",
      descKey: r.status === "submitted" ? "operations.activity.expertSubmitted" : "operations.activity.expertOpened",
    });
  });
  activity.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

  return {
    rows,
    stats: {
      profiles: profiles.length,
      parents: parentsCount,
      students: studentsCount,
      children: children.length,
      diagnosticsCompleted,
      plansGenerated,
      plansActive,
      checkpointsCompleted,
      expertReviewsPending,
      feedbackEntries,
      unreadNotifications,
      missingConsents,
    },
    activity: activity.slice(0, 30),
    health: {
      score: Math.round(score),
      diagnosisRate, planRate, checkpointRate: cpRate, expertCoverage: reviewCoverage,
      feedbackPositive: positiveFb, consentCoverage,
    },
    lowFeedbackOwners: lowFbOwners,
  };
}

const OperationalConsole = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const { user } = useAuth();
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await loadConsoleData();
      setData(d);
    } catch (e) {
      console.error("Operational console load failed", e);
      toast.error(t("operations.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [] as JourneyRow[];
    return data.rows.filter((r) => matchesFilter(r, filter));
  }, [data, filter]);

  const sendReminder = async (row: JourneyRow) => {
    if (!user) return;
    const action = recommendedAction(computeStuck(row));
    if (!action.reminderType) {
      toast.message(t("adminAction.no_action"));
      return;
    }
    setSendingFor(row.ownerKey);
    try {
      const titleKey = `adminAction.reminderTitle.${action.reminderType}`;
      const bodyKey = `adminAction.reminderBody.${action.reminderType}`;
      const id = await createNotification({
        userId: row.notifyUserId,
        type: action.reminderType,
        title: t(titleKey),
        body: t(bodyKey),
        actionLabel: t("adminAction.openCta"),
        actionUrl: action.actionUrl || "/dashboard",
        severity: "info",
        metadata: { source: "operations_console", owner_type: row.ownerType, anon: row.anonId },
      });
      await supabase.from("smart_evidence_events").insert({
        event_type: "admin_reminder_sent",
        owner_type: row.ownerType,
        user_id: row.ownerType === "self" ? row.notifyUserId : null,
        child_id: row.ownerType === "child" ? row.ownerKey.replace(/^c:/, "") : null,
        algorithm_version: "operations_console_v1",
        input_summary: { reminder_type: action.reminderType, recommended: action.key } as never,
        output_summary: { dedup_skipped: id === null } as never,
        metrics: {} as never,
        created_by: user.id,
      } as never);
      if (id) toast.success(t("adminAction.reminderSent"));
      else toast.message(t("adminAction.reminderDeduped"));
    } catch (e) {
      console.error(e);
      toast.error(t("adminAction.reminderFailed"));
    } finally {
      setSendingFor(null);
    }
  };

  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang) : "—");

  return (
    <RoleGate allow={["admin"]} fallback="/dashboard">
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("operations.title")}
            subtitle={t("operations.subtitle")}
            actions={
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {t("operations.refresh")}
              </Button>
            }
          />

          {data && (
            <Surface variant="ai" className="p-5 mb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{t("pilotHealth.label")}</p>
                  <p className="text-3xl font-bold mt-1 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-accent" />
                    {data.health.score}
                    <span className="text-base text-muted-foreground font-normal">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">{t("pilotHealth.note")}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <HealthMetric label={t("pilotHealth.diagnosisRate")} value={fmtPct(data.health.diagnosisRate)} />
                  <HealthMetric label={t("pilotHealth.planRate")} value={fmtPct(data.health.planRate)} />
                  <HealthMetric label={t("pilotHealth.checkpointRate")} value={fmtPct(data.health.checkpointRate)} />
                  <HealthMetric label={t("pilotHealth.expertCoverage")} value={fmtPct(data.health.expertCoverage)} />
                  <HealthMetric label={t("pilotHealth.feedbackPositive")} value={fmtPct(data.health.feedbackPositive)} />
                  <HealthMetric label={t("pilotHealth.consentCoverage")} value={fmtPct(data.health.consentCoverage)} />
                </div>
              </div>
            </Surface>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard icon={Users} label={t("operations.stats.profiles")} value={data?.stats.profiles ?? "—"} />
            <StatCard icon={Users} label={t("operations.stats.parents")} value={data?.stats.parents ?? "—"} />
            <StatCard icon={Users} label={t("operations.stats.students")} value={data?.stats.students ?? "—"} />
            <StatCard icon={Users} label={t("operations.stats.children")} value={data?.stats.children ?? "—"} />
            <StatCard icon={ClipboardList} label={t("operations.stats.diagnosticsCompleted")} value={data?.stats.diagnosticsCompleted ?? "—"} />
            <StatCard icon={Sparkles} label={t("operations.stats.plansGenerated")} value={data?.stats.plansGenerated ?? "—"} />
            <StatCard icon={Activity} label={t("operations.stats.plansActive")} value={data?.stats.plansActive ?? "—"} />
            <StatCard icon={ClipboardCheck} label={t("operations.stats.checkpointsCompleted")} value={data?.stats.checkpointsCompleted ?? "—"} />
            <StatCard icon={BadgeCheck} label={t("operations.stats.expertReviewsPending")} value={data?.stats.expertReviewsPending ?? "—"} />
            <StatCard icon={MessageSquare} label={t("operations.stats.feedbackEntries")} value={data?.stats.feedbackEntries ?? "—"} />
            <StatCard icon={Bell} label={t("operations.stats.unreadNotifications")} value={data?.stats.unreadNotifications ?? "—"} />
            <StatCard icon={ShieldCheck} label={t("operations.stats.missingConsents")} value={data?.stats.missingConsents ?? "—"} />
          </div>

          <Surface className="p-5 mb-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" /> {t("operations.journeyTitle")}
              </h2>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                  <SelectTrigger className="w-[280px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["all","stuck_pre_diag","diag_no_plan","plan_not_active","active_low_progress","checkpoint_available","checkpoint_no_review","missing_consent","has_feedback","unread_notifications"] as FilterKey[]).map((k) => (
                      <SelectItem key={k} value={k}>{t(`operations.filter.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{t("operations.rowCount", { n: filtered.length })}</span>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("common.loading")}</p>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Inbox} title={t("operations.emptyTitle")} description={t("operations.emptyDesc")} />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                    <tr>
                      <th className="text-left px-2 py-2">{t("operations.col.owner")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.type")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.consent")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.diagnosis")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.score")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.plan")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.items")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.checkpoint")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.expert")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.feedback")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.lastActivity")}</th>
                      <th className="text-left px-2 py-2">{t("operations.col.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const stuck = data!.lowFeedbackOwners.has(r.ownerKey) ? "low_feedback" : computeStuck(r);
                      const action = recommendedAction(stuck === "low_feedback" ? "ok" : stuck);
                      const needsAttention = stuck !== "ok";
                      return (
                        <tr key={r.ownerKey} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="px-2 py-2 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span>{r.anonId}</span>
                              {needsAttention && (
                                <Badge variant="destructive" className="text-[9px] py-0 px-1.5">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  {t("operations.needsAttention")}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant="secondary" className="text-[10px]">{t(`operations.ownerType.${r.ownerType}`)}</Badge>
                          </td>
                          <td className="px-2 py-2">
                            {r.hasConsent
                              ? <Badge variant="secondary" className="text-[10px]">{t("operations.badge.consentOk")}</Badge>
                              : <Badge variant="destructive" className="text-[10px]">{t("operations.badge.consentMissing")}</Badge>}
                          </td>
                          <td className="px-2 py-2">
                            {r.hasDiagnosis ? (
                              <Badge variant="secondary" className="text-[10px]">{t("operations.badge.done")}</Badge>
                            ) : r.diagnosisInProgress ? (
                              <Badge variant="outline" className="text-[10px]">{t("operations.badge.inProgress")}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">{t("operations.badge.none")}</Badge>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs">{r.latestScore == null ? "—" : `${Math.round((r.latestScore || 0) * 100)}%`}</td>
                          <td className="px-2 py-2">
                            {r.hasPlan
                              ? <Badge variant="secondary" className="text-[10px]">{t(`operations.planStatus.${r.planActive ? "active" : "draft"}`)}</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2 text-xs">{r.hasPlan ? `${r.planItemsDone}/${r.planItemsTotal}` : "—"}</td>
                          <td className="px-2 py-2">
                            {r.hasCheckpoint
                              ? <Badge variant="secondary" className="text-[10px]">{t("operations.badge.done")}</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2">
                            {r.hasExpertReview
                              ? <Badge variant="secondary" className="text-[10px]">{t("operations.badge.assigned")}</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2 text-xs">{r.feedbackCount}</td>
                          <td className="px-2 py-2 text-xs whitespace-nowrap">{fmtDate(r.lastActivityAt)}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                onClick={() => sendReminder(r)}
                                disabled={!action.reminderType || sendingFor === r.ownerKey}
                              >
                                <Bell className="h-3.5 w-3.5 mr-1" />
                                {t(`adminAction.${action.key}`)}
                              </Button>
                              {r.latestAttemptId && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                  <Link to={r.ownerType === "child" ? `/parent/children/${r.ownerKey.slice(2)}/diagnostic` : `/diagnose`}>
                                    {t("adminAction.viewDiagnosis")}
                                  </Link>
                                </Button>
                              )}
                              {r.planId && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                  <Link to={`/plans/${r.planId}`}>{t("adminAction.viewPlan")}</Link>
                                </Button>
                              )}
                              {r.checkpointId && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                  <Link to={`/checkpoints/${r.checkpointId}`}>{t("adminAction.viewCheckpoint")}</Link>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>

          <Surface className="p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" /> {t("operations.activity.title")}
            </h2>
            {!data || data.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("operations.activity.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-xs border-b last:border-b-0 pb-2 last:pb-0">
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(a.ts)}</span>
                    <Badge variant="outline" className="text-[10px]">{t(`operations.activity.kind.${a.kind}`)}</Badge>
                    {a.ownerType && (
                      <Badge variant="secondary" className="text-[10px]">{t(`operations.ownerType.${a.ownerType}`)}</Badge>
                    )}
                    <span className="text-foreground/90">
                      {t(a.descKey, { defaultValue: a.descKey, ...(a.descParams || {}) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            {t("operations.piiNote")}
          </p>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

const HealthMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border bg-card-soft px-3 py-2">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold mt-0.5">{value}</p>
  </div>
);

export default OperationalConsole;
