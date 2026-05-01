-- Revoke EXECUTE on internal SECURITY DEFINER helpers from anon (and PUBLIC)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_booking_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_session_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of_child(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated role keeps EXECUTE on the helpers used by RLS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of_child(uuid, uuid) TO authenticated;

-- Realtime: require authenticated role to subscribe to any channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime authenticated only read" ON realtime.messages;
CREATE POLICY "realtime authenticated only read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "realtime authenticated only write" ON realtime.messages;
CREATE POLICY "realtime authenticated only write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);