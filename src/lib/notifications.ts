import { supabase } from "@/integrations/supabase/client";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";
export type NotificationStatus = "unread" | "read" | "dismissed";

export type NotificationType =
  | "diagnosis_incomplete"
  | "diagnosis_completed"
  | "plan_ready"
  | "plan_step_reminder"
  | "checkpoint_available"
  | "checkpoint_completed"
  | "feedback_requested"
  | "expert_review_assigned"
  | "consent_required"
  | "pilot_update"
  | "admin_reminder_diagnosis"
  | "admin_reminder_plan"
  | "admin_reminder_checkpoint"
  | "admin_reminder_feedback"
  | "admin_reminder_expert_review"
  // booking/marketplace
  | "booking_created_payer"
  | "booking_created_tutor"
  | "payment_proof_uploaded"
  | "payment_confirmed"
  | "session_completed"
  | "tutor_note_submitted"
  | "booking_cancelled"
  // homework
  | "homework_assigned"
  | "homework_submitted"
  | "homework_graded"
  | "homework_needs_review"
  // live lesson
  | "session_room_ready"
  | "session_started"
  | "session_ended"
  | "lesson_note_submitted";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionLabel?: string;
  actionUrl?: string;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
}

function actionUrlCategory(url?: string): string {
  if (!url) return "none";
  if (url.startsWith("/diagnose")) return "diagnose";
  if (url.startsWith("/plans")) return "plans";
  if (url.startsWith("/checkpoints")) return "checkpoints";
  if (url.startsWith("/expert")) return "expert";
  if (url.startsWith("/getting-started")) return "getting_started";
  if (url.startsWith("/calendar")) return "calendar";
  if (url.startsWith("/discover")) return "discover";
  if (url.startsWith("/dashboard")) return "dashboard";
  if (url.startsWith("/homework")) return "homework";
  if (url.startsWith("/session")) return "session";
  return "other";
}

async function logEvidence(
  eventType: "notification_created" | "notification_read" | "notification_dismissed",
  payload: { userId: string; type: string; severity: string; actionUrl?: string | null },
) {
  try {
    await supabase.from("smart_evidence_events").insert({
      event_type: eventType,
      owner_type: "user",
      user_id: payload.userId,
      algorithm_version: "notifications_v1",
      input_summary: { notification_type: payload.type, severity: payload.severity },
      output_summary: { url_category: actionUrlCategory(payload.actionUrl ?? undefined) },
      metrics: {},
      created_by: payload.userId,
    } as never);
  } catch {
    /* non-blocking */
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  const {
    userId, type, title, body, actionLabel, actionUrl,
    severity = "info", metadata = {},
  } = input;

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dupQ = supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("status", "unread")
    .gte("created_at", sinceIso)
    .limit(1);
  dupQ = actionUrl ? dupQ.eq("action_url", actionUrl) : dupQ.is("action_url", null);
  const { data: existing } = await dupQ;
  if (existing && existing.length > 0) return null;

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      action_label: actionLabel ?? null,
      action_url: actionUrl ?? null,
      severity,
      metadata: metadata as never,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  await logEvidence("notification_created", { userId, type, severity, actionUrl });
  return (data as { id: string }).id;
}

export async function markNotificationRead(id: string, userId: string, type: string, severity: string, actionUrl?: string | null) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "unread");
  if (!error) await logEvidence("notification_read", { userId, type, severity, actionUrl });
}

export async function dismissNotification(id: string, userId: string, type: string, severity: string, actionUrl?: string | null) {
  const { error } = await supabase
    .from("notifications")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) await logEvidence("notification_dismissed", { userId, type, severity, actionUrl });
}

export async function markAllRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "unread");
}
