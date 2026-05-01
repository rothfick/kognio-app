-- 1) Extend smart_evidence_events.event_type check constraint to include admin_reminder_sent
ALTER TABLE public.smart_evidence_events
  DROP CONSTRAINT IF EXISTS smart_evidence_events_event_type_chk;

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
    'expert_review_submitted',
    'consent_accepted',
    'consent_withdrawn',
    'pilot_participant_joined',
    'feedback_submitted',
    'notification_created',
    'notification_read',
    'notification_dismissed',
    'admin_reminder_sent'
  ));

-- 2) Allow admins to insert smart_evidence_events for any user (operational reminder logging)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='smart_evidence_events'
      AND policyname='see admin insert any'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "see admin insert any" ON public.smart_evidence_events
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role))
    $p$;
  END IF;
END $$;
