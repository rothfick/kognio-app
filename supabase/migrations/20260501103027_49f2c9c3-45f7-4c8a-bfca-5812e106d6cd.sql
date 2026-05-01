-- learning_plans
CREATE TABLE IF NOT EXISTS public.learning_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  domain text,
  level text,
  status text NOT NULL DEFAULT 'draft',
  generated_by text NOT NULL DEFAULT 'diagnosis_to_plan_v1',
  algorithm_version text NOT NULL DEFAULT 'learning_plan_rules_ai_v1',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_plans_owner_type_chk CHECK (owner_type IN ('user','child')),
  CONSTRAINT learning_plans_owner_xor_chk CHECK (
    (user_id IS NOT NULL AND child_id IS NULL) OR (user_id IS NULL AND child_id IS NOT NULL)
  ),
  CONSTRAINT learning_plans_status_chk CHECK (status IN ('draft','active','completed','archived'))
);

CREATE INDEX IF NOT EXISTS idx_learning_plans_user ON public.learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_child ON public.learning_plans(child_id);
CREATE INDEX IF NOT EXISTS idx_learning_plans_attempt ON public.learning_plans(diagnostic_attempt_id);

ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans owner user all" ON public.learning_plans
  FOR ALL TO authenticated
  USING (user_id IS NOT NULL AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (user_id IS NOT NULL AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "plans parent child all" ON public.learning_plans
  FOR ALL TO authenticated
  USING (child_id IS NOT NULL AND (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (child_id IS NOT NULL AND (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(), 'admin')));

CREATE TRIGGER learning_plans_touch
  BEFORE UPDATE ON public.learning_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- learning_plan_items
CREATE TABLE IF NOT EXISTS public.learning_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  kind text NOT NULL DEFAULT 'practice',
  skill_area text,
  title text NOT NULL,
  description text,
  rationale text,
  evidence_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_minutes int DEFAULT 30,
  difficulty_level int DEFAULT 2,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lpi_unique_order UNIQUE (plan_id, order_index),
  CONSTRAINT lpi_kind_chk CHECK (kind IN ('review','practice','lesson','quiz','project')),
  CONSTRAINT lpi_status_chk CHECK (status IN ('pending','in_progress','done','skipped')),
  CONSTRAINT lpi_difficulty_chk CHECK (difficulty_level BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_lpi_plan ON public.learning_plan_items(plan_id);

ALTER TABLE public.learning_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lpi access via plan" ON public.learning_plan_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learning_plans p
    WHERE p.id = learning_plan_items.plan_id
      AND (
        (p.user_id IS NOT NULL AND p.user_id = auth.uid())
        OR (p.child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), p.child_id))
        OR public.has_role(auth.uid(), 'admin')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.learning_plans p
    WHERE p.id = learning_plan_items.plan_id
      AND (
        (p.user_id IS NOT NULL AND p.user_id = auth.uid())
        OR (p.child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), p.child_id))
        OR public.has_role(auth.uid(), 'admin')
      )
  ));

CREATE TRIGGER lpi_touch
  BEFORE UPDATE ON public.learning_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- smart_evidence_events
CREATE TABLE IF NOT EXISTS public.smart_evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  owner_type text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE SET NULL,
  diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  learning_plan_id uuid REFERENCES public.learning_plans(id) ON DELETE SET NULL,
  algorithm_version text,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_see_user ON public.smart_evidence_events(user_id);
CREATE INDEX IF NOT EXISTS idx_see_child ON public.smart_evidence_events(child_id);
CREATE INDEX IF NOT EXISTS idx_see_plan ON public.smart_evidence_events(learning_plan_id);
CREATE INDEX IF NOT EXISTS idx_see_event_type ON public.smart_evidence_events(event_type);

ALTER TABLE public.smart_evidence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see read own" ON public.smart_evidence_events
  FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "see insert owner" ON public.smart_evidence_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
    OR public.has_role(auth.uid(), 'admin')
  );