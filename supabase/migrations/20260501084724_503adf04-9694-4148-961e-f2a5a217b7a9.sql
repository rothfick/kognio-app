-- Universal AI-adaptive diagnostic: support both parent->child and self (student/adult) flows.

-- 1) Add user-scoped diagnostic columns
ALTER TABLE public.diagnostic_attempts
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pl',
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'ai_adaptive',
  ADD COLUMN IF NOT EXISTS summary jsonb,
  ALTER COLUMN child_id DROP NOT NULL,
  ALTER COLUMN subject_id DROP NOT NULL;

-- 2) XOR: exactly one of (child_id, user_id) must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_attempts_owner_xor'
  ) THEN
    ALTER TABLE public.diagnostic_attempts
      ADD CONSTRAINT diag_attempts_owner_xor
      CHECK ((child_id IS NOT NULL)::int + (user_id IS NOT NULL)::int = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_diag_attempts_user ON public.diagnostic_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_diag_attempts_child ON public.diagnostic_attempts(child_id);

-- 3) Drop old single-policy and recreate scoped policies
DROP POLICY IF EXISTS "diag_attempts parent all" ON public.diagnostic_attempts;

CREATE POLICY "diag_attempts parent owns child"
  ON public.diagnostic_attempts
  FOR ALL
  TO authenticated
  USING (child_id IS NOT NULL AND (is_parent_of_child(auth.uid(), child_id) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (child_id IS NOT NULL AND (is_parent_of_child(auth.uid(), child_id) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "diag_attempts self owner"
  ON public.diagnostic_attempts
  FOR ALL
  TO authenticated
  USING (user_id IS NOT NULL AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (user_id IS NOT NULL AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)));

-- 4) Update responses policy to also allow self-attempts
DROP POLICY IF EXISTS "diag_responses parent all" ON public.diagnostic_responses;

CREATE POLICY "diag_responses access via attempt"
  ON public.diagnostic_responses
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diagnostic_attempts a
    WHERE a.id = diagnostic_responses.attempt_id
      AND (
        (a.child_id IS NOT NULL AND is_parent_of_child(auth.uid(), a.child_id))
        OR (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.diagnostic_attempts a
    WHERE a.id = diagnostic_responses.attempt_id
      AND (
        (a.child_id IS NOT NULL AND is_parent_of_child(auth.uid(), a.child_id))
        OR (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  ));

-- 5) Allow AI-generated items: relax NOT NULL on subject_id/kc_id for ephemeral items (we'll store generated ones)
ALTER TABLE public.diagnostic_items
  ALTER COLUMN subject_id DROP NOT NULL,
  ALTER COLUMN kc_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS kc_label text,
  ADD COLUMN IF NOT EXISTS generated_by text;

CREATE INDEX IF NOT EXISTS idx_diag_items_attempt ON public.diagnostic_items(attempt_id);

-- Allow users to read items tied to their own attempts (in addition to admin-approved bank)
DROP POLICY IF EXISTS "diag_items read active approved" ON public.diagnostic_items;
CREATE POLICY "diag_items read active approved or own attempt"
  ON public.diagnostic_items
  FOR SELECT
  TO authenticated
  USING (
    (is_active AND approved_by_admin)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.diagnostic_attempts a
      WHERE a.id = diagnostic_items.attempt_id
        AND (
          (a.user_id IS NOT NULL AND a.user_id = auth.uid())
          OR (a.child_id IS NOT NULL AND is_parent_of_child(auth.uid(), a.child_id))
        )
    ))
  );