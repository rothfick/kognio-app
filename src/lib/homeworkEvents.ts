import { supabase } from "@/integrations/supabase/client";

export type HomeworkEventType =
  | "homework_generated"
  | "homework_submitted"
  | "homework_auto_graded"
  | "homework_reviewed"
  | "mastery_updated_from_homework";

export interface HomeworkEventInput {
  eventType: HomeworkEventType;
  assignmentId: string;
  userId: string;
  ownerUserId?: string | null;
  childId?: string | null;
  bookingId?: string | null;
  learningDomainId?: string | null;
  educationLevelId?: string | null;
  competencyId?: string | null;
  skillAreaLabel?: string | null;
  source?: string | null;
  score?: number | null;
  percentage?: number | null;
}

export async function logHomeworkEvent(input: HomeworkEventInput) {
  try {
    await supabase.from("smart_evidence_events").insert({
      event_type: input.eventType,
      owner_type: input.childId ? "child" : "user",
      user_id: input.ownerUserId ?? null,
      child_id: input.childId ?? null,
      algorithm_version: "homework_v1",
      input_summary: {
        assignment_id: input.assignmentId,
        booking_id: input.bookingId ?? null,
        learning_domain_id: input.learningDomainId ?? null,
        education_level_id: input.educationLevelId ?? null,
        competency_id: input.competencyId ?? null,
        skill_area_label: input.skillAreaLabel ?? null,
        source: input.source ?? null,
      },
      output_summary: {
        score: input.score ?? null,
        percentage: input.percentage ?? null,
      },
      metrics: {},
      created_by: input.userId,
    } as never);
  } catch {
    /* non-blocking */
  }
}
