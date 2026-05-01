
-- ============ PILOT COHORTS ============
CREATE TABLE public.pilot_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  target_group text,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_cohorts_status_chk CHECK (status IN ('draft','active','paused','completed','archived'))
);
ALTER TABLE public.pilot_cohorts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pilot_cohorts_touch
  BEFORE UPDATE ON public.pilot_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PILOT PARTICIPANTS ============
CREATE TABLE public.pilot_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.pilot_cohorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'standard_user',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_participants_type_chk CHECK (participant_type IN ('standard_user','research_pilot_participant','internal_tester','expert_reviewer')),
  CONSTRAINT pilot_participants_status_chk CHECK (status IN ('invited','active','paused','completed','withdrawn'))
);
CREATE UNIQUE INDEX pilot_participants_unique_user
  ON public.pilot_participants (cohort_id, user_id) WHERE child_id IS NULL;
CREATE UNIQUE INDEX pilot_participants_unique_child
  ON public.pilot_participants (cohort_id, user_id, child_id) WHERE child_id IS NOT NULL;
CREATE INDEX idx_pilot_participants_user ON public.pilot_participants(user_id);
CREATE INDEX idx_pilot_participants_child ON public.pilot_participants(child_id);
ALTER TABLE public.pilot_participants ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a participant in cohort?
CREATE OR REPLACE FUNCTION public.is_pilot_participant(_user_id uuid, _cohort_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pilot_participants
    WHERE cohort_id = _cohort_id AND user_id = _user_id AND status IN ('invited','active','paused','completed')
  )
$$;

-- Pilot cohort policies
CREATE POLICY "cohorts admin manage" ON public.pilot_cohorts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cohorts read for participants" ON public.pilot_cohorts
  FOR SELECT TO authenticated
  USING (public.is_pilot_participant(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Pilot participant policies
CREATE POLICY "participants admin manage" ON public.pilot_participants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "participants self read" ON public.pilot_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id)));

CREATE POLICY "participants self insert" ON public.pilot_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (child_id IS NULL OR public.is_parent_of_child(auth.uid(), child_id))
  );

CREATE POLICY "participants self update" ON public.pilot_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id)))
  WITH CHECK (user_id = auth.uid() OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id)));

-- ============ CONSENT RECORDS ============
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  consent_version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'accepted',
  accepted_at timestamptz,
  withdrawn_at timestamptz,
  ip_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_status_chk CHECK (status IN ('accepted','withdrawn')),
  CONSTRAINT consent_records_type_chk CHECK (consent_type IN (
    'terms_of_service','privacy_policy','ai_diagnosis_notice',
    'research_participation','parent_child_data_processing','expert_review_notice'
  )),
  CONSTRAINT consent_records_owner_chk CHECK (user_id IS NOT NULL OR child_id IS NOT NULL)
);
CREATE INDEX idx_consent_user ON public.consent_records(user_id);
CREATE INDEX idx_consent_child ON public.consent_records(child_id);
CREATE INDEX idx_consent_type ON public.consent_records(consent_type);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent admin read all" ON public.consent_records
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "consent owner read" ON public.consent_records
  FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

CREATE POLICY "consent owner insert" ON public.consent_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid() AND child_id IS NULL)
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

CREATE POLICY "consent owner update withdraw" ON public.consent_records
  FOR UPDATE TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  )
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

-- ============ USER FEEDBACK ============
CREATE TABLE public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE SET NULL,
  context_type text NOT NULL,
  context_id uuid,
  rating int,
  feedback_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_feedback_context_chk CHECK (context_type IN (
    'diagnosis','learning_plan','checkpoint','expert_review','onboarding','general'
  )),
  CONSTRAINT user_feedback_rating_chk CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))
);
CREATE INDEX idx_feedback_user ON public.user_feedback(user_id);
CREATE INDEX idx_feedback_child ON public.user_feedback(child_id);
CREATE INDEX idx_feedback_context ON public.user_feedback(context_type, created_at DESC);
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback admin read" ON public.user_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "feedback owner read" ON public.user_feedback
  FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

CREATE POLICY "feedback owner insert" ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

-- ============ EXTEND SMART EVIDENCE EVENTS ============
ALTER TABLE public.smart_evidence_events
  DROP CONSTRAINT IF EXISTS smart_evidence_events_event_type_chk;

ALTER TABLE public.smart_evidence_events
  ADD CONSTRAINT smart_evidence_events_event_type_chk
  CHECK (event_type IN (
    'diagnostic_completed','learning_plan_generated','learning_plan_activated',
    'learning_plan_item_completed','learning_plan_completed','checkpoint_created',
    'checkpoint_completed','expert_review_submitted',
    'consent_accepted','consent_withdrawn','pilot_participant_joined','feedback_submitted'
  ));

-- Allow users to insert their own SMART evidence events for these new pilot/feedback types
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='smart_evidence_events' AND policyname='see owner insert pilot events'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "see owner insert pilot events" ON public.smart_evidence_events
        FOR INSERT TO authenticated
        WITH CHECK (
          event_type IN ('consent_accepted','consent_withdrawn','pilot_participant_joined','feedback_submitted')
          AND (
            (user_id IS NOT NULL AND user_id = auth.uid())
            OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
          )
        )
    $p$;
  END IF;
END $$;

-- ============ SEED INTERNAL ALPHA COHORT ============
INSERT INTO public.pilot_cohorts (code, name, description, target_group, status)
VALUES (
  'kogni_internal_alpha',
  'Kogni Internal Alpha',
  'Internal alpha cohort for Kogni team and early testers. Used to validate flows before broader pilot rollout.',
  'internal',
  'active'
)
ON CONFLICT (code) DO NOTHING;
