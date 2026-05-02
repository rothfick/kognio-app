
-- ============================================================
-- Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_tutor_of_booking(_booking uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = _booking AND b.tutor_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.has_lesson_consent(_booking uuid, _consent_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.consent_records cr ON cr.consent_type = _consent_type
      AND cr.status = 'accepted'
      AND (
        (b.child_id IS NOT NULL AND cr.child_id = b.child_id)
        OR (b.child_id IS NULL AND cr.user_id = b.student_id)
      )
    WHERE b.id = _booking
      AND cr.id IS NOT NULL
  );
$$;

-- ============================================================
-- consent_records: expand allowed types
-- ============================================================
ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_type_chk;
ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_type_chk
  CHECK (consent_type = ANY (ARRAY[
    'terms_of_service','privacy_policy','ai_diagnosis_notice','research_participation',
    'parent_child_data_processing','expert_review_notice',
    'lesson_recording_notice','lesson_transcription_notice',
    'lesson_engagement_analysis_notice','ai_copilot_notice'
  ]));

-- ============================================================
-- lesson_transcripts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  speaker_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  speaker_role text NOT NULL DEFAULT 'unknown' CHECK (speaker_role IN ('student','parent','tutor','admin','unknown')),
  text text NOT NULL,
  start_ms integer,
  end_ms integer,
  confidence numeric,
  source text NOT NULL DEFAULT 'browser_stt',
  language text NOT NULL DEFAULT 'pl',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_transcripts_booking ON public.lesson_transcripts(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_transcripts_session ON public.lesson_transcripts(live_session_id);

ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_transcripts_admin_all" ON public.lesson_transcripts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "lesson_transcripts_tutor_read" ON public.lesson_transcripts
  FOR SELECT TO authenticated
  USING (public.is_tutor_of_booking(booking_id, auth.uid()));

CREATE POLICY "lesson_transcripts_participant_read" ON public.lesson_transcripts
  FOR SELECT TO authenticated
  USING (
    public.can_access_booking(booking_id, auth.uid())
    AND public.has_lesson_consent(booking_id, 'lesson_transcription_notice')
  );

CREATE POLICY "lesson_transcripts_participant_insert" ON public.lesson_transcripts
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_booking(booking_id, auth.uid()));

-- ============================================================
-- lesson_engagement_signals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_engagement_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  observed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signal_type text NOT NULL CHECK (signal_type IN (
    'focus','confusion','frustration','boredom','satisfaction','engagement','participation','uncertainty'
  )),
  value numeric,
  label text,
  confidence numeric,
  source text NOT NULL DEFAULT 'local_client',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_engagement_booking ON public.lesson_engagement_signals(booking_id, created_at);

ALTER TABLE public.lesson_engagement_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engagement_admin_all" ON public.lesson_engagement_signals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "engagement_tutor_read" ON public.lesson_engagement_signals
  FOR SELECT TO authenticated
  USING (public.is_tutor_of_booking(booking_id, auth.uid()));

CREATE POLICY "engagement_participant_insert" ON public.lesson_engagement_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_booking(booking_id, auth.uid())
    AND (observed_by_user_id IS NULL OR observed_by_user_id = auth.uid())
  );

-- ============================================================
-- lesson_ai_copilot_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_ai_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('tutor','assistant','system')),
  content text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  prompt_version text NOT NULL DEFAULT 'lesson_copilot_v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_booking ON public.lesson_ai_copilot_messages(booking_id, created_at);

ALTER TABLE public.lesson_ai_copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_admin_all" ON public.lesson_ai_copilot_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "copilot_tutor_read" ON public.lesson_ai_copilot_messages
  FOR SELECT TO authenticated
  USING (public.is_tutor_of_booking(booking_id, auth.uid()));

CREATE POLICY "copilot_tutor_insert" ON public.lesson_ai_copilot_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tutor_of_booking(booking_id, auth.uid()) AND user_id = auth.uid());

-- ============================================================
-- lesson_summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  audience text NOT NULL CHECK (audience IN ('tutor','student','parent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  markdown text,
  generated_by text NOT NULL DEFAULT 'lesson_summary_v1',
  model text,
  prompt_version text NOT NULL DEFAULT 'lesson_summary_v1',
  approved_by_tutor uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_summaries_booking ON public.lesson_summaries(booking_id);
CREATE INDEX IF NOT EXISTS idx_summaries_audience ON public.lesson_summaries(booking_id, audience, status);

CREATE TRIGGER trg_lesson_summaries_updated_at
BEFORE UPDATE ON public.lesson_summaries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.lesson_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "summaries_admin_all" ON public.lesson_summaries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "summaries_tutor_manage" ON public.lesson_summaries
  FOR ALL TO authenticated
  USING (public.is_tutor_of_booking(booking_id, auth.uid()))
  WITH CHECK (public.is_tutor_of_booking(booking_id, auth.uid()));

CREATE POLICY "summaries_student_parent_read_approved" ON public.lesson_summaries
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND audience IN ('student','parent')
    AND public.can_access_booking(booking_id, auth.uid())
    AND NOT public.is_tutor_of_booking(booking_id, auth.uid())
  );

-- ============================================================
-- flashcards: extend
-- ============================================================
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'user' CHECK (owner_type IN ('user','child')),
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'lesson_summary',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_area_label text,
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repetitions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Make user_id nullable so child-owned flashcards work
ALTER TABLE public.flashcards ALTER COLUMN user_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER trg_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

CREATE INDEX IF NOT EXISTS idx_flashcards_child ON public.flashcards(child_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_booking ON public.flashcards(booking_id);

-- Replace permissive policy with role-aware policies
DROP POLICY IF EXISTS "fc own all" ON public.flashcards;

CREATE POLICY "flashcards_admin_all" ON public.flashcards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "flashcards_owner_user_all" ON public.flashcards
  FOR ALL TO authenticated
  USING (owner_type = 'user' AND user_id = auth.uid())
  WITH CHECK (owner_type = 'user' AND user_id = auth.uid());

CREATE POLICY "flashcards_owner_child_all" ON public.flashcards
  FOR ALL TO authenticated
  USING (owner_type = 'child' AND child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  WITH CHECK (owner_type = 'child' AND child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id));

CREATE POLICY "flashcards_tutor_insert_from_booking" ON public.flashcards
  FOR INSERT TO authenticated
  WITH CHECK (booking_id IS NOT NULL AND public.is_tutor_of_booking(booking_id, auth.uid()));

CREATE POLICY "flashcards_tutor_read_from_booking" ON public.flashcards
  FOR SELECT TO authenticated
  USING (booking_id IS NOT NULL AND public.is_tutor_of_booking(booking_id, auth.uid()));
