-- Expand smart_evidence_events.event_type CHECK to include organization/cohort events.
ALTER TABLE public.smart_evidence_events
  DROP CONSTRAINT IF EXISTS smart_evidence_events_event_type_chk;

ALTER TABLE public.smart_evidence_events
  ADD CONSTRAINT smart_evidence_events_event_type_chk
  CHECK (event_type = ANY (ARRAY[
    'diagnostic_completed','learning_plan_generated','learning_plan_activated',
    'learning_plan_item_completed','learning_plan_completed','checkpoint_created',
    'checkpoint_completed','expert_review_submitted','consent_accepted','consent_withdrawn',
    'pilot_participant_joined','feedback_submitted','notification_created','notification_read',
    'notification_dismissed','admin_reminder_sent','booking_created','payment_proof_uploaded',
    'payment_confirmed','session_completed','tutor_note_submitted','homework_generated',
    'homework_submitted','homework_auto_graded','homework_reviewed','mastery_updated_from_homework',
    'organization_created','organization_member_added','organization_invite_created',
    'organization_invite_accepted','organization_role_changed','cohort_created',
    'cohort_member_added','org_report_exported'
  ]));

-- Allow org admins to insert org-level events with org_id stored in input_summary.organization_id.
-- We keep existing insert policies and add a permissive one specifically for org event types.
CREATE POLICY "see insert org events by org admin"
  ON public.smart_evidence_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_type = ANY (ARRAY[
      'organization_created','organization_member_added','organization_invite_created',
      'organization_invite_accepted','organization_role_changed','cohort_created',
      'cohort_member_added','org_report_exported'
    ])
    AND created_by = auth.uid()
    AND (
      has_role(auth.uid(), 'admin')
      OR (
        (input_summary ? 'organization_id')
        AND public.is_org_admin(auth.uid(), (input_summary->>'organization_id')::uuid)
      )
    )
  );

-- Allow org admins to read org-level events for their organization.
CREATE POLICY "see read org events by org admin"
  ON public.smart_evidence_events
  FOR SELECT
  TO authenticated
  USING (
    event_type = ANY (ARRAY[
      'organization_created','organization_member_added','organization_invite_created',
      'organization_invite_accepted','organization_role_changed','cohort_created',
      'cohort_member_added','org_report_exported'
    ])
    AND (input_summary ? 'organization_id')
    AND (
      has_role(auth.uid(), 'admin')
      OR public.is_org_admin(auth.uid(), (input_summary->>'organization_id')::uuid)
    )
  );

-- Index to speed up org event lookups by organization_id stored in input_summary.
CREATE INDEX IF NOT EXISTS idx_see_org_id_jsonb
  ON public.smart_evidence_events ((input_summary->>'organization_id'))
  WHERE input_summary ? 'organization_id';
