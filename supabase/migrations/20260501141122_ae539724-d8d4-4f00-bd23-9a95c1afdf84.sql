CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  action_label text,
  action_url text,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'unread',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_severity_chk CHECK (severity IN ('info','success','warning','critical')),
  CONSTRAINT notifications_status_chk CHECK (status IN ('unread','read','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON public.notifications(user_id, type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications owner read"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "notifications owner update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "notifications owner insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "notifications admin delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DO $$
DECLARE conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'smart_evidence_events'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%event_type%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.smart_evidence_events DROP CONSTRAINT %I', conname);
  END IF;
END$$;