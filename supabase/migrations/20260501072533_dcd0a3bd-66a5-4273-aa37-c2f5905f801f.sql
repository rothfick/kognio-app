-- Diagnostic v1 tables
CREATE TABLE public.diagnostic_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  code text NOT NULL,
  language text NOT NULL DEFAULT 'pl',
  question text NOT NULL,
  choices jsonb NOT NULL,
  correct_choice text NOT NULL,
  explanation text,
  difficulty_level int NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  approved_by_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, code)
);

CREATE TABLE public.diagnostic_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.parent_children(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  started_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  score numeric,
  total_items int NOT NULL DEFAULT 0,
  correct_items int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.diagnostic_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.diagnostic_attempts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.diagnostic_items(id) ON DELETE CASCADE,
  selected_choice text,
  is_correct boolean,
  time_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, item_id)
);

CREATE INDEX idx_diag_items_kc ON public.diagnostic_items(kc_id) WHERE is_active AND approved_by_admin;
CREATE INDEX idx_diag_items_subject ON public.diagnostic_items(subject_id) WHERE is_active AND approved_by_admin;
CREATE INDEX idx_diag_attempts_child ON public.diagnostic_attempts(child_id);
CREATE INDEX idx_diag_responses_attempt ON public.diagnostic_responses(attempt_id);

ALTER TABLE public.diagnostic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;

-- diagnostic_items: anyone authenticated can read active+approved; admin manages
CREATE POLICY "diag_items read active approved"
ON public.diagnostic_items FOR SELECT TO authenticated
USING ((is_active AND approved_by_admin) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "diag_items admin manage"
ON public.diagnostic_items FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- diagnostic_attempts: parent of child or admin
CREATE POLICY "diag_attempts parent all"
ON public.diagnostic_attempts FOR ALL TO authenticated
USING (is_parent_of_child(auth.uid(), child_id) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (is_parent_of_child(auth.uid(), child_id) OR has_role(auth.uid(),'admin'::app_role));

-- diagnostic_responses: via attempt -> child -> parent
CREATE POLICY "diag_responses parent all"
ON public.diagnostic_responses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.diagnostic_attempts a
    WHERE a.id = diagnostic_responses.attempt_id
      AND (is_parent_of_child(auth.uid(), a.child_id) OR has_role(auth.uid(),'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diagnostic_attempts a
    WHERE a.id = diagnostic_responses.attempt_id
      AND (is_parent_of_child(auth.uid(), a.child_id) OR has_role(auth.uid(),'admin'::app_role))
  )
);

-- updated_at trigger for items
CREATE TRIGGER trg_diag_items_updated
BEFORE UPDATE ON public.diagnostic_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add 'source' column allowance: child_kc_mastery already has source text. Good.