import { supabase } from "@/integrations/supabase/client";

export type BookingEventType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_rejected"
  | "payment_proof_uploaded"
  | "payment_confirmed"
  | "session_completed"
  | "tutor_note_submitted";

export interface BookingEventInput {
  eventType: BookingEventType;
  bookingId: string;
  userId: string; // actor (created_by)
  ownerUserId?: string | null;
  childId?: string | null;
  learningDomainId?: string | null;
  educationLevelId?: string | null;
  competencyId?: string | null;
  skillAreaLabel?: string | null;
  status?: string;
  paymentStatus?: string;
}

/**
 * Insert a SMART evidence event for booking lifecycle.
 * No PII. Best-effort (non-blocking).
 */
export async function logBookingEvent(input: BookingEventInput) {
  try {
    await supabase.from("smart_evidence_events").insert({
      event_type: input.eventType,
      owner_type: input.childId ? "child" : "user",
      user_id: input.ownerUserId ?? null,
      child_id: input.childId ?? null,
      algorithm_version: "marketplace_v1",
      input_summary: {
        booking_id: input.bookingId,
        learning_domain_id: input.learningDomainId ?? null,
        education_level_id: input.educationLevelId ?? null,
        competency_id: input.competencyId ?? null,
        skill_area_label: input.skillAreaLabel ?? null,
      },
      output_summary: {
        status: input.status ?? null,
        payment_status: input.paymentStatus ?? null,
      },
      metrics: {},
      created_by: input.userId,
    } as never);
  } catch {
    /* non-blocking */
  }
}
