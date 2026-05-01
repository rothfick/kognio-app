import { supabase } from "@/integrations/supabase/client";

export interface GenerateHomeworkInput {
  source_type: "diagnosis" | "learning_plan" | "booking" | "session_note" | "manual";
  source_id?: string | null;
  owner_type: "user" | "child";
  child_id?: string | null;
  skill_area_label?: string | null;
  competency_id?: string | null;
  learning_domain_id?: string | null;
  education_level_id?: string | null;
  diagnostic_attempt_id?: string | null;
  learning_plan_id?: string | null;
  learning_plan_item_id?: string | null;
  booking_id?: string | null;
  session_note_id?: string | null;
  language?: "pl" | "en" | "es";
  title_hint?: string | null;
}

export interface GenerateHomeworkResult {
  ok: boolean;
  assignment_id?: string;
  error?: string;
}

export async function generateHomework(input: GenerateHomeworkInput): Promise<GenerateHomeworkResult> {
  try {
    const { data, error } = await supabase.functions.invoke("homework-generate", { body: input });
    if (error) return { ok: false, error: error.message };
    const d = (data || {}) as { assignment_id?: string; error?: string };
    if (d.error) return { ok: false, error: d.error };
    return { ok: true, assignment_id: d.assignment_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function langCode(lang: string | undefined): "pl" | "en" | "es" {
  const c = (lang || "pl").split("-")[0];
  return c === "en" || c === "es" ? c : "pl";
}
