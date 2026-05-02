import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers to record org-level SMART evidence events.
 * No PII in payload — only IDs, roles, statuses.
 */
export type OrgEventType =
  | "organization_created"
  | "organization_member_added"
  | "organization_invite_created"
  | "organization_invite_accepted"
  | "organization_role_changed"
  | "cohort_created"
  | "cohort_member_added"
  | "org_report_exported";

export async function recordOrgEvent(opts: {
  event_type: OrgEventType;
  organization_id: string;
  actor_id?: string;
  cohort_id?: string;
  role?: string;
  status?: string;
  extra?: Record<string, unknown>;
}) {
  const input_summary: Record<string, unknown> = { organization_id: opts.organization_id };
  if (opts.cohort_id) input_summary.cohort_id = opts.cohort_id;
  if (opts.role) input_summary.role = opts.role;
  if (opts.status) input_summary.status = opts.status;
  if (opts.extra) Object.assign(input_summary, opts.extra);
  try {
    await supabase.from("smart_evidence_events").insert({
      event_type: opts.event_type,
      input_summary,
      created_by: opts.actor_id || null,
    } as any);
  } catch (e) {
    // best-effort; never block UI
    console.warn("recordOrgEvent failed", e);
  }
}

export async function notifyUser(opts: {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  action_label?: string;
  action_url?: string;
  severity?: "info" | "success" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}) {
  try {
    // Notifications RLS allows owner_user to insert their own row OR admin.
    // Most org actions are done by admins, who can insert any user row.
    await supabase.from("notifications").insert({
      user_id: opts.user_id,
      type: opts.type,
      title: opts.title,
      body: opts.body || null,
      action_label: opts.action_label || null,
      action_url: opts.action_url || null,
      severity: opts.severity || "info",
      metadata: opts.metadata || {},
    } as any);
  } catch (e) {
    console.warn("notifyUser failed", e);
  }
}
