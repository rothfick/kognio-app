ALTER TABLE public.learning_plans
  ADD COLUMN IF NOT EXISTS education_system_id uuid REFERENCES public.education_systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_version text DEFAULT 'learning_plan_prompt_v1';

CREATE INDEX IF NOT EXISTS idx_learning_plans_domain ON public.learning_plans (learning_domain_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_level ON public.learning_plans (education_level_id);