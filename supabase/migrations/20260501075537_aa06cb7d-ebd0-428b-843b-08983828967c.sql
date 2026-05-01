-- Typy
DO $$ BEGIN
  CREATE TYPE public.org_type AS ENUM ('school', 'training_company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'teacher', 'student', 'observer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabele
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  org_type public.org_type NOT NULL,
  slug text NOT NULL UNIQUE,
  tax_id text,
  city text,
  country text DEFAULT 'PL',
  website text,
  description text,
  logo_url text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_orgs_type ON public.organizations(org_type);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role public.org_member_role NOT NULL DEFAULT 'student',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  member_role public.org_member_role NOT NULL DEFAULT 'student',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.org_invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.organization_invites(lower(email));

-- Helpery
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org_id AND o.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org_id AND m.user_id = _user_id
      AND m.member_role IN ('owner','admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;

-- Trigger updated_at
DROP TRIGGER IF EXISTS organizations_touch ON public.organizations;
CREATE TRIGGER organizations_touch
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs insert by owner with role" ON public.organizations;
CREATE POLICY "orgs insert by owner with role"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND (
    (org_type = 'school' AND public.has_role(auth.uid(), 'school'))
    OR (org_type = 'training_company' AND public.has_role(auth.uid(), 'training_company'))
  )
);

DROP POLICY IF EXISTS "orgs read members or admin" ON public.organizations;
CREATE POLICY "orgs read members or admin"
ON public.organizations FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_org_member(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "orgs update by org admin" ON public.organizations;
CREATE POLICY "orgs update by org admin"
ON public.organizations FOR UPDATE TO authenticated
USING (
  public.is_org_admin(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  owner_id = (SELECT o.owner_id FROM public.organizations o WHERE o.id = organizations.id)
  AND org_type = (SELECT o.org_type FROM public.organizations o WHERE o.id = organizations.id)
);

DROP POLICY IF EXISTS "orgs delete by owner or admin" ON public.organizations;
CREATE POLICY "orgs delete by owner or admin"
ON public.organizations FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org_members read self or org admin" ON public.organization_members;
CREATE POLICY "org_members read self or org admin"
ON public.organization_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "org_members insert by org admin" ON public.organization_members;
CREATE POLICY "org_members insert by org admin"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "org_members update by org admin" ON public.organization_members;
CREATE POLICY "org_members update by org admin"
ON public.organization_members FOR UPDATE TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  organization_id = (SELECT m.organization_id FROM public.organization_members m WHERE m.id = organization_members.id)
  AND user_id = (SELECT m.user_id FROM public.organization_members m WHERE m.id = organization_members.id)
);

DROP POLICY IF EXISTS "org_members delete by org admin or self" ON public.organization_members;
CREATE POLICY "org_members delete by org admin or self"
ON public.organization_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "org_invites read by org admin or invitee" ON public.organization_invites;
CREATE POLICY "org_invites read by org admin or invitee"
ON public.organization_invites FOR SELECT TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "org_invites insert by org admin" ON public.organization_invites;
CREATE POLICY "org_invites insert by org admin"
ON public.organization_invites FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND (public.is_org_admin(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "org_invites update accept or revoke" ON public.organization_invites;
CREATE POLICY "org_invites update accept or revoke"
ON public.organization_invites FOR UPDATE TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "org_invites delete by org admin" ON public.organization_invites;
CREATE POLICY "org_invites delete by org admin"
ON public.organization_invites FOR DELETE TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- Akceptacja zaproszenia po tokenie
CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.organization_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Invite not pending'; END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.organization_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite expired';
  END IF;

  v_user_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF v_user_email = '' OR v_user_email <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'Invite is for a different email';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, member_role, invited_by)
  VALUES (v_invite.organization_id, auth.uid(), v_invite.member_role, v_invite.invited_by)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role;

  UPDATE public.organization_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_invite.id;

  RETURN v_invite.organization_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_org_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;

-- user_roles: pozwól self-insert dla nowych ról
DROP POLICY IF EXISTS "user_roles insert self basic" ON public.user_roles;
CREATE POLICY "user_roles insert self basic"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('student','parent','school','training_company')
);