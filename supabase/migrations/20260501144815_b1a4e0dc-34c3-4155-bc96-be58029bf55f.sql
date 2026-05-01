DROP POLICY IF EXISTS "user_roles insert self basic" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles insert self student" ON public.user_roles;

CREATE POLICY "user_roles insert self basic"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN (
    'student'::public.app_role,
    'tutor'::public.app_role,
    'parent'::public.app_role,
    'school'::public.app_role,
    'training_company'::public.app_role
  )
);