REVOKE EXECUTE ON FUNCTION public.accept_student_parent_link(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_student_parent_link_by_id(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_student_parent_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_student_parent_link_by_id(uuid) TO authenticated;