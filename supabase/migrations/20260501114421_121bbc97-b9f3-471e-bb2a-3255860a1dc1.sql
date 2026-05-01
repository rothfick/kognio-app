-- ============================================
-- expert_reviews
-- ============================================
CREATE TABLE public.expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL,
  owner_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  learning_plan_id uuid REFERENCES public.learning_plans(id) ON DELETE SET NULL,
  checkpoint_id uuid REFERENCES public.learning_checkpoints(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL DEFAULT 'expert',
  status text NOT NULL DEFAULT 'draft',
  ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  expert_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  agreement_score numeric,
  correction_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  algorithm_version text NOT NULL DEFAULT 'expert_review_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expert_reviews_review_type_chk CHECK (review_type IN ('diagnostic','learning_plan','checkpoint')),
  CONSTRAINT expert_reviews_owner_type_chk CHECK (owner_type IN ('user','child')),
  CONSTRAINT expert_reviews_status_chk CHECK (status IN ('draft','submitted','archived')),
  CONSTRAINT expert_reviews_owner_xor_chk CHECK (
    (user_id IS NOT NULL AND child_id IS NULL) OR (user_id IS NULL AND child_id IS NOT NULL)
  ),
  CONSTRAINT expert_reviews_agreement_range_chk CHECK (agreement_score IS NULL OR (agreement_score >= 0 AND agreement_score <= 1))
);

CREATE INDEX idx_expert_reviews_reviewer ON public.expert_reviews(reviewer_id);
CREATE INDEX idx_expert_reviews_user ON public.expert_reviews(user_id);
CREATE INDEX idx_expert_reviews_child ON public.expert_reviews(child_id);
CREATE INDEX idx_expert_reviews_diag ON public.expert_reviews(diagnostic_attempt_id);
CREATE INDEX idx_expert_reviews_plan ON public.expert_reviews(learning_plan_id);
CREATE INDEX idx_expert_reviews_checkpoint ON public.expert_reviews(checkpoint_id);
CREATE INDEX idx_expert_reviews_status ON public.expert_reviews(status);

ALTER TABLE public.expert_reviews ENABLE ROW LEVEL SECURITY;

-- Reviewer manages own reviews (draft/submitted)
CREATE POLICY "expert_reviews reviewer manage own"
ON public.expert_reviews
FOR ALL
TO authenticated
USING (auth.uid() = reviewer_id)
WITH CHECK (auth.uid() = reviewer_id);

-- Admin full access
CREATE POLICY "expert_reviews admin manage"
ON public.expert_reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Owner user can read submitted reviews about themselves
CREATE POLICY "expert_reviews owner user read submitted"
ON public.expert_reviews
FOR SELECT
TO authenticated
USING (
  status = 'submitted'
  AND user_id IS NOT NULL
  AND auth.uid() = user_id
);

-- Parent can read submitted reviews about their child
CREATE POLICY "expert_reviews parent read submitted"
ON public.expert_reviews
FOR SELECT
TO authenticated
USING (
  status = 'submitted'
  AND child_id IS NOT NULL
  AND public.is_parent_of_child(auth.uid(), child_id)
);

CREATE TRIGGER trg_expert_reviews_updated_at
BEFORE UPDATE ON public.expert_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- expert_review_items
-- ============================================
CREATE TABLE public.expert_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_review_id uuid NOT NULL REFERENCES public.expert_reviews(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  skill_area_label text,
  ai_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  expert_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  verdict text NOT NULL DEFAULT 'pending',
  confidence numeric,
  correction_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eri_item_type_chk CHECK (item_type IN ('skill_gap','mastery_score','competency_mapping','recommendation','plan_step','checkpoint_delta')),
  CONSTRAINT eri_verdict_chk CHECK (verdict IN ('pending','agree','partially_agree','disagree','unsure')),
  CONSTRAINT eri_confidence_range_chk CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_eri_review ON public.expert_review_items(expert_review_id);
CREATE INDEX idx_eri_competency ON public.expert_review_items(competency_id);

ALTER TABLE public.expert_review_items ENABLE ROW LEVEL SECURITY;

-- All access flows through parent expert_reviews row
CREATE POLICY "eri access via review"
ON public.expert_review_items
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.expert_reviews r
  WHERE r.id = expert_review_items.expert_review_id
    AND (
      r.reviewer_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR (r.status = 'submitted' AND r.user_id IS NOT NULL AND r.user_id = auth.uid())
      OR (r.status = 'submitted' AND r.child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), r.child_id))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.expert_reviews r
  WHERE r.id = expert_review_items.expert_review_id
    AND (
      r.reviewer_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
));

CREATE TRIGGER trg_eri_updated_at
BEFORE UPDATE ON public.expert_review_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- Extend smart_evidence_events.event_type if a check constraint exists
-- ============================================
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM information_schema.tables
  WHERE table_schema='public' AND table_name='smart_evidence_events';

  IF cnt > 0 THEN
    -- Drop any existing event_type check constraint(s)
    PERFORM 1;
    EXECUTE (
      SELECT COALESCE(string_agg('ALTER TABLE public.smart_evidence_events DROP CONSTRAINT ' || quote_ident(conname) || ';', ' '), '')
      FROM pg_constraint
      WHERE conrelid = 'public.smart_evidence_events'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%event_type%'
    );

    EXECUTE $sql$
      ALTER TABLE public.smart_evidence_events
      ADD CONSTRAINT smart_evidence_events_event_type_chk
      CHECK (event_type IN (
        'diagnostic_completed',
        'learning_plan_generated',
        'learning_plan_activated',
        'learning_plan_item_completed',
        'learning_plan_completed',
        'checkpoint_created',
        'checkpoint_completed',
        'expert_review_submitted'
      ))
    $sql$;
  END IF;
END $$;