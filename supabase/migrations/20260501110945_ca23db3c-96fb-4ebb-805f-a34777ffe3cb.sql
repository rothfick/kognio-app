CREATE TABLE IF NOT EXISTS public.learning_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  learning_plan_id uuid REFERENCES public.learning_plans(id) ON DELETE SET NULL,
  baseline_diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  checkpoint_diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  trigger_reason text NOT NULL DEFAULT 'manual',
  baseline_score numeric,
  checkpoint_score numeric,
  score_delta numeric,
  mastery_delta jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version text NOT NULL DEFAULT 'checkpoint_compare_v1',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_owner_type_chk CHECK (owner_type IN ('user','child')),
  CONSTRAINT lc_owner_xor_chk CHECK (
    (user_id IS NOT NULL AND child_id IS NULL)
    OR (user_id IS NULL AND child_id IS NOT NULL)
  ),
  CONSTRAINT lc_status_chk CHECK (status IN ('pending','in_progress','completed','cancelled')),
  CONSTRAINT lc_trigger_chk CHECK (trigger_reason IN ('manual','plan_progress','plan_completed','admin_test'))
);

CREATE INDEX IF NOT EXISTS idx_lc_user ON public.learning_checkpoints (user_id);
CREATE INDEX IF NOT EXISTS idx_lc_child ON public.learning_checkpoints (child_id);
CREATE INDEX IF NOT EXISTS idx_lc_plan ON public.learning_checkpoints (learning_plan_id);
CREATE INDEX IF NOT EXISTS idx_lc_status ON public.learning_checkpoints (status);

ALTER TABLE public.learning_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkpoints owner user all"
ON public.learning_checkpoints
FOR ALL
TO authenticated
USING ((user_id IS NOT NULL) AND ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK ((user_id IS NOT NULL) AND ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "checkpoints parent child all"
ON public.learning_checkpoints
FOR ALL
TO authenticated
USING ((child_id IS NOT NULL) AND (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK ((child_id IS NOT NULL) AND (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE TRIGGER trg_learning_checkpoints_touch
BEFORE UPDATE ON public.learning_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();