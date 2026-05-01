-- ===== PART 1: diagnostic_attempts taxonomy columns =====
ALTER TABLE public.diagnostic_attempts
  ADD COLUMN IF NOT EXISTS education_system_id uuid REFERENCES public.education_systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taxonomy_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS algorithm_version text DEFAULT 'diagnostic_ai_adaptive_v1',
  ADD COLUMN IF NOT EXISTS prompt_version text DEFAULT 'diagnostic_prompt_v1';

CREATE INDEX IF NOT EXISTS idx_diag_attempts_domain ON public.diagnostic_attempts(learning_domain_id);
CREATE INDEX IF NOT EXISTS idx_diag_attempts_level ON public.diagnostic_attempts(education_level_id);

-- ===== PART 2: child_kc_mastery taxonomy/competency columns =====
-- kc_id is currently NOT NULL; allow null so we can store unmapped AI areas with synthetic ids OR null.
-- Keep as-is (synthetic UUID strategy already works) but add traceability columns.
ALTER TABLE public.child_kc_mastery
  ADD COLUMN IF NOT EXISTS competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_area_label text,
  ADD COLUMN IF NOT EXISTS algorithm_version text,
  ADD COLUMN IF NOT EXISTS confidence_reason text;

CREATE INDEX IF NOT EXISTS idx_child_mastery_competency ON public.child_kc_mastery(competency_id);
CREATE INDEX IF NOT EXISTS idx_child_mastery_domain ON public.child_kc_mastery(learning_domain_id);

-- ===== PART 3: user_competency_mastery (self) =====
CREATE TABLE IF NOT EXISTS public.user_competency_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  skill_area_label text,
  mastery_prob numeric NOT NULL DEFAULT 0.0 CHECK (mastery_prob >= 0 AND mastery_prob <= 1),
  confidence numeric NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL DEFAULT 'diagnostic_ai_adaptive',
  algorithm_version text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one row per user+competency when competency known
CREATE UNIQUE INDEX IF NOT EXISTS uq_ucm_user_competency
  ON public.user_competency_mastery(user_id, competency_id)
  WHERE competency_id IS NOT NULL;

-- Best-effort dedup for unmapped areas (lowercased label + domain + level)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ucm_user_label
  ON public.user_competency_mastery(user_id, lower(skill_area_label), learning_domain_id, education_level_id)
  WHERE competency_id IS NULL AND skill_area_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ucm_user ON public.user_competency_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_ucm_competency ON public.user_competency_mastery(competency_id);

ALTER TABLE public.user_competency_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucm self all"
  ON public.user_competency_mastery
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ===== PART 6: learning_plan_items traceability =====
ALTER TABLE public.learning_plan_items
  ADD COLUMN IF NOT EXISTS competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS algorithm_version text;

-- skill_area_label alias kept compatible: existing skill_area column is reused.

CREATE INDEX IF NOT EXISTS idx_lpi_competency ON public.learning_plan_items(competency_id);