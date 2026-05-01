-- =========================================
-- HOMEWORK V1 — assignments, items, submissions
-- =========================================

-- 1. Extend smart_evidence_events allowed event_type values
ALTER TABLE public.smart_evidence_events
  DROP CONSTRAINT IF EXISTS smart_evidence_events_event_type_chk;

ALTER TABLE public.smart_evidence_events
  ADD CONSTRAINT smart_evidence_events_event_type_chk
  CHECK (event_type = ANY (ARRAY[
    'diagnostic_completed','learning_plan_generated','learning_plan_activated',
    'learning_plan_item_completed','learning_plan_completed',
    'checkpoint_created','checkpoint_completed','expert_review_submitted',
    'consent_accepted','consent_withdrawn','pilot_participant_joined',
    'feedback_submitted','notification_created','notification_read','notification_dismissed',
    'admin_reminder_sent',
    'booking_created','payment_proof_uploaded','payment_confirmed','session_completed','tutor_note_submitted',
    'homework_generated','homework_submitted','homework_auto_graded','homework_reviewed','mastery_updated_from_homework'
  ]));

-- 2. assignments
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  learning_plan_id uuid REFERENCES public.learning_plans(id) ON DELETE SET NULL,
  learning_plan_item_id uuid REFERENCES public.learning_plan_items(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  session_note_id uuid REFERENCES public.session_notes(id) ON DELETE SET NULL,
  diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  skill_area_label text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  due_at timestamptz,
  generated_by text DEFAULT 'homework_generator_v1',
  algorithm_version text DEFAULT 'homework_generator_v1',
  prompt_version text DEFAULT 'homework_prompt_v1',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_owner_type_chk CHECK (owner_type IN ('user','child')),
  CONSTRAINT assignments_owner_xor_chk CHECK (
    (owner_type = 'user' AND user_id IS NOT NULL AND child_id IS NULL) OR
    (owner_type = 'child' AND child_id IS NOT NULL AND user_id IS NULL)
  ),
  CONSTRAINT assignments_source_type_chk CHECK (source_type IN ('diagnosis','learning_plan','booking','session_note','manual')),
  CONSTRAINT assignments_status_chk CHECK (status IN ('draft','assigned','in_progress','submitted','graded','archived'))
);

CREATE INDEX assignments_user_id_idx ON public.assignments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX assignments_child_id_idx ON public.assignments(child_id) WHERE child_id IS NOT NULL;
CREATE INDEX assignments_booking_id_idx ON public.assignments(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX assignments_session_note_id_idx ON public.assignments(session_note_id) WHERE session_note_id IS NOT NULL;
CREATE INDEX assignments_status_idx ON public.assignments(status);
CREATE INDEX assignments_competency_id_idx ON public.assignments(competency_id) WHERE competency_id IS NOT NULL;

CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Helper: tutor of the linked booking?
CREATE OR REPLACE FUNCTION public.is_assignment_tutor(_assignment uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.assignments a
    JOIN public.bookings b ON b.id = a.booking_id
    WHERE a.id = _assignment AND b.tutor_id = _user
  );
$$;

-- assignments policies
CREATE POLICY assignments_self_select ON public.assignments
  FOR SELECT TO authenticated USING (
    (owner_type = 'user' AND user_id = auth.uid())
    OR (owner_type = 'child' AND public.is_parent_of_child(auth.uid(), child_id))
    OR public.has_role(auth.uid(), 'admin')
    OR (booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tutor_id = auth.uid()))
  );

CREATE POLICY assignments_self_insert ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (
    -- self for user
    (owner_type = 'user' AND user_id = auth.uid() AND created_by = auth.uid())
    -- parent inserting for own child
    OR (owner_type = 'child' AND public.is_parent_of_child(auth.uid(), child_id) AND created_by = auth.uid())
    -- tutor inserting for booking they teach
    OR (booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tutor_id = auth.uid()) AND created_by = auth.uid())
    -- admin
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY assignments_self_update ON public.assignments
  FOR UPDATE TO authenticated USING (
    (owner_type = 'user' AND user_id = auth.uid())
    OR (owner_type = 'child' AND public.is_parent_of_child(auth.uid(), child_id))
    OR (booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tutor_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY assignments_self_delete ON public.assignments
  FOR DELETE TO authenticated USING (
    (owner_type = 'user' AND user_id = auth.uid())
    OR (owner_type = 'child' AND public.is_parent_of_child(auth.uid(), child_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3. assignment_items
CREATE TABLE public.assignment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  item_type text NOT NULL DEFAULT 'multiple_choice',
  prompt text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  skill_area_label text,
  difficulty_level int DEFAULT 2,
  points numeric DEFAULT 1,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_items_type_chk CHECK (item_type IN ('multiple_choice','true_false','short_answer'))
);
CREATE INDEX assignment_items_assignment_idx ON public.assignment_items(assignment_id, order_index);

ALTER TABLE public.assignment_items ENABLE ROW LEVEL SECURITY;

-- helper to check assignment access via parent table
CREATE OR REPLACE FUNCTION public.can_access_assignment(_assignment uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.assignments a
    WHERE a.id = _assignment AND (
      (a.owner_type = 'user' AND a.user_id = _user)
      OR (a.owner_type = 'child' AND public.is_parent_of_child(_user, a.child_id))
      OR (a.booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = a.booking_id AND b.tutor_id = _user))
      OR public.has_role(_user, 'admin')
    )
  );
$$;

CREATE POLICY assignment_items_select ON public.assignment_items
  FOR SELECT TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_items_insert ON public.assignment_items
  FOR INSERT TO authenticated WITH CHECK (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_items_update ON public.assignment_items
  FOR UPDATE TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_items_delete ON public.assignment_items
  FOR DELETE TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));

-- 4. assignment_submissions
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  max_score numeric,
  percentage numeric,
  status text NOT NULL DEFAULT 'submitted',
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submissions_status_chk CHECK (status IN ('submitted','auto_graded','needs_review','reviewed'))
);
CREATE INDEX assignment_submissions_assignment_idx ON public.assignment_submissions(assignment_id);
CREATE INDEX assignment_submissions_submitted_by_idx ON public.assignment_submissions(submitted_by);

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignment_submissions_select ON public.assignment_submissions
  FOR SELECT TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_submissions_insert ON public.assignment_submissions
  FOR INSERT TO authenticated WITH CHECK (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_submissions_update ON public.assignment_submissions
  FOR UPDATE TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));
CREATE POLICY assignment_submissions_delete ON public.assignment_submissions
  FOR DELETE TO authenticated USING (public.can_access_assignment(assignment_id, auth.uid()));