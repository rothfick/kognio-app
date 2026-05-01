
-- Extend smart evidence event_type allowed values
ALTER TABLE public.smart_evidence_events DROP CONSTRAINT IF EXISTS smart_evidence_events_event_type_chk;
ALTER TABLE public.smart_evidence_events ADD CONSTRAINT smart_evidence_events_event_type_chk
  CHECK (event_type = ANY (ARRAY[
    'diagnostic_completed','learning_plan_generated','learning_plan_activated',
    'learning_plan_item_completed','learning_plan_completed','checkpoint_created',
    'checkpoint_completed','expert_review_submitted','consent_accepted','consent_withdrawn',
    'pilot_participant_joined','feedback_submitted','notification_created','notification_read',
    'notification_dismissed','admin_reminder_sent',
    'booking_created','payment_proof_uploaded','payment_confirmed','session_completed','tutor_note_submitted'
  ]));

-- Allow authenticated users to insert booking-related smart events for their own bookings (payer or tutor)
CREATE POLICY "see insert booking events" ON public.smart_evidence_events
  FOR INSERT TO authenticated
  WITH CHECK (
    event_type = ANY (ARRAY['booking_created','payment_proof_uploaded','payment_confirmed','session_completed','tutor_note_submitted'])
    AND created_by = auth.uid()
  );

-- session_notes table
CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tutor_user_id uuid NOT NULL,
  learner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  covered_skill_areas text[] NOT NULL DEFAULT '{}',
  recommended_next_step text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_booking ON public.session_notes(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_tutor ON public.session_notes(tutor_user_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_learner ON public.session_notes(learner_user_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_child ON public.session_notes(child_id);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_notes admin manage" ON public.session_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "session_notes tutor manage own" ON public.session_notes
  FOR ALL TO authenticated
  USING (auth.uid() = tutor_user_id)
  WITH CHECK (auth.uid() = tutor_user_id);

CREATE POLICY "session_notes learner read self" ON public.session_notes
  FOR SELECT TO authenticated
  USING (learner_user_id IS NOT NULL AND learner_user_id = auth.uid());

CREATE POLICY "session_notes parent read child" ON public.session_notes
  FOR SELECT TO authenticated
  USING (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id));

CREATE TRIGGER trg_session_notes_updated_at
  BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
