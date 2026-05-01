import { supabase } from "@/integrations/supabase/client";

export type LiveSessionEventType =
  | "live_session_started"
  | "live_session_joined"
  | "live_session_ended"
  | "live_chat_message_sent"
  | "live_whiteboard_updated"
  | "session_completed";

/**
 * Logs a SMART evidence event for the live lesson room.
 * No PII in payload — only ids and counters.
 */
export async function logLiveEvidence(
  eventType: LiveSessionEventType,
  params: {
    userId: string;
    bookingId: string;
    role?: "student" | "parent" | "tutor" | "admin";
    metrics?: Record<string, number>;
  },
) {
  try {
    await supabase.from("smart_evidence_events").insert({
      event_type: eventType,
      owner_type: "user",
      user_id: params.userId,
      algorithm_version: "live_lesson_v1",
      input_summary: { booking_id: params.bookingId, role: params.role ?? null },
      output_summary: {},
      metrics: params.metrics ?? {},
      created_by: params.userId,
    } as never);
  } catch {
    /* non-blocking */
  }
}
