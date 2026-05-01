
-- =====================================================================
-- TutorOS AI — Security sweep migration
-- Fixes: payment self-confirmation, session_reports ownership,
-- audit_logs table. Realtime RLS for session_chat/transcripts already OK
-- via is_session_participant; tutor_payment_methods already scoped.
-- user_roles already restricts self-insert to student/tutor (no admin).
-- =====================================================================

-- A) PAYMENTS: prevent student self-confirmation
-- Drop overly-permissive update policy and split per-role with WITH CHECK.
DROP POLICY IF EXISTS "payments participants update" ON public.payments;

-- Tutor can update freely (including confirming)
CREATE POLICY "payments tutor update"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = tutor_id)
WITH CHECK (auth.uid() = tutor_id);

-- Student can update ONLY non-confirmation fields and ONLY to status in {pending, marked_paid}.
-- Cannot set status='confirmed' nor set confirmed_at.
CREATE POLICY "payments student update non confirm"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id
  AND status <> 'confirmed'
  AND confirmed_at IS NULL
);

-- B) SESSION_REPORTS: add created_by + restrict update to author/admin
ALTER TABLE public.session_reports
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill: leave NULL for legacy rows; future inserts require it via policy.
DROP POLICY IF EXISTS "reports insert" ON public.session_reports;
DROP POLICY IF EXISTS "reports update" ON public.session_reports;

CREATE POLICY "reports insert participants"
ON public.session_reports
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_session_participant(session_id, auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "reports update author or admin"
ON public.session_reports
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- C) AUDIT_LOGS: minimal table, admin-only read
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs admin read"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT/UPDATE/DELETE policies for non-admin: only service_role (edge functions) can write.
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id);
