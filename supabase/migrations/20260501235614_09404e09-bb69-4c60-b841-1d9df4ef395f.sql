
-- Live Lesson Room v1: per-booking live sessions and event log

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  started_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_status_check CHECK (status IN ('scheduled','live','ended','failed'))
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_booking ON public.live_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);

CREATE TRIGGER trg_live_sessions_updated_at
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- Helper: is user a participant of a booking (student, parent, tutor) or admin
CREATE OR REPLACE FUNCTION public.can_access_booking(_booking uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = _booking
      AND (
        b.student_id = _user
        OR b.tutor_id = _user
        OR b.parent_user_id = _user
        OR public.has_role(_user, 'admin')
      )
  );
$$;

CREATE POLICY "live_sessions_select_participants"
ON public.live_sessions FOR SELECT
TO authenticated
USING (public.can_access_booking(booking_id, auth.uid()));

CREATE POLICY "live_sessions_insert_participants"
ON public.live_sessions FOR INSERT
TO authenticated
WITH CHECK (public.can_access_booking(booking_id, auth.uid()));

-- Tutor / admin can update status
CREATE POLICY "live_sessions_update_tutor_admin"
ON public.live_sessions FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tutor_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tutor_id = auth.uid())
);

CREATE POLICY "live_sessions_admin_all"
ON public.live_sessions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- live_session_events
CREATE TABLE IF NOT EXISTS public.live_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_session_events_type_check CHECK (event_type IN (
    'room_opened','participant_joined','participant_left',
    'chat_message','whiteboard_event','session_started','session_ended'
  ))
);

CREATE INDEX IF NOT EXISTS idx_live_session_events_booking ON public.live_session_events(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_session_events_type ON public.live_session_events(event_type);

ALTER TABLE public.live_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_session_events_select_participants"
ON public.live_session_events FOR SELECT
TO authenticated
USING (public.can_access_booking(booking_id, auth.uid()));

CREATE POLICY "live_session_events_insert_self"
ON public.live_session_events FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_booking(booking_id, auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid())
);

CREATE POLICY "live_session_events_admin_all"
ON public.live_session_events FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_session_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
