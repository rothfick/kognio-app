-- Tighten user_roles self-insert
DROP POLICY IF EXISTS "user_roles insert self student" ON public.user_roles;
CREATE POLICY "user_roles insert self basic"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('student'::public.app_role, 'parent'::public.app_role));

-- parent_links
CREATE TABLE IF NOT EXISTS public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'parent' CHECK (relation IN ('parent','guardian','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  consent_signed_at timestamptz,
  consent_version text DEFAULT 'v1',
  consent_doc_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER parent_links_touch BEFORE UPDATE ON public.parent_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- parent_children
CREATE TABLE IF NOT EXISTS public.parent_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text,
  dob date,
  grade_level text,
  primary_subject text,
  relation text NOT NULL DEFAULT 'parent' CHECK (relation IN ('parent','guardian','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','revoked')),
  consent_signed_at timestamptz NOT NULL DEFAULT now(),
  consent_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER parent_children_touch BEFORE UPDATE ON public.parent_children
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_links
    WHERE parent_id = _parent_id
      AND student_id = _student_id
      AND status = 'active'
      AND consent_signed_at IS NOT NULL
  );
$$;

-- parent_links RLS
CREATE POLICY "parent_links read"
ON public.parent_links FOR SELECT TO authenticated
USING (auth.uid() = parent_id OR auth.uid() = student_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "parent_links insert self"
ON public.parent_links FOR INSERT TO authenticated
WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "parent_links update self or admin"
ON public.parent_links FOR UPDATE TO authenticated
USING (auth.uid() = parent_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = parent_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "parent_links admin delete"
ON public.parent_links FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- parent_children RLS
CREATE POLICY "parent_children parent all"
ON public.parent_children FOR ALL TO authenticated
USING (auth.uid() = parent_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = parent_id OR public.has_role(auth.uid(), 'admin'::public.app_role));