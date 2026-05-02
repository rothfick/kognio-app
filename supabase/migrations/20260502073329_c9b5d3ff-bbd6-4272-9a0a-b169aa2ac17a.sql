-- =========================================================
-- Phase A: Organizations / Schools / Cohorts foundation
-- Additive only. Preserves: organizations, organization_members,
-- organization_invites, org_member_role enum, owner_id, token,
-- accept_org_invite RPC, OrgInviteAccept page, OrgDashboard.
-- =========================================================

-- 1) Organization status enum (new, optional column)
DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Additive columns on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status public.org_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill country_code from existing country (if present)
UPDATE public.organizations SET country_code = country WHERE country_code IS NULL AND country IS NOT NULL;

-- 3) Cohorts
CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  level_code text,
  domain_code text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cohorts_org ON public.cohorts(organization_id);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cohorts read by org members" ON public.cohorts;
CREATE POLICY "cohorts read by org members" ON public.cohorts FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cohorts insert by org admin" ON public.cohorts;
CREATE POLICY "cohorts insert by org admin" ON public.cohorts FOR INSERT
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cohorts update by org admin" ON public.cohorts;
CREATE POLICY "cohorts update by org admin" ON public.cohorts FOR UPDATE
USING (public.is_org_admin(auth.uid(), organization_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cohorts delete by org admin" ON public.cohorts;
CREATE POLICY "cohorts delete by org admin" ON public.cohorts FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id) OR public.has_role(auth.uid(),'admin'));

-- 4) Cohort members
CREATE TABLE IF NOT EXISTS public.cohort_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.parent_children(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','child','tutor','reviewer','observer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohort_member_subject_chk CHECK (
    (user_id IS NOT NULL AND child_id IS NULL)
    OR (user_id IS NULL AND child_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cohort_members_user
  ON public.cohort_members(cohort_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cohort_members_child
  ON public.cohort_members(cohort_id, child_id) WHERE child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON public.cohort_members(cohort_id);

ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- Helpers (security definer)
CREATE OR REPLACE FUNCTION public.is_cohort_member(_user_id uuid, _cohort_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cohort_members cm
    WHERE cm.cohort_id = _cohort_id
      AND cm.status = 'active'
      AND (cm.user_id = _user_id
           OR (cm.child_id IS NOT NULL AND public.is_parent_of_child(_user_id, cm.child_id)))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_cohort(_user_id uuid, _cohort_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cohorts c
    WHERE c.id = _cohort_id
      AND (public.is_org_admin(_user_id, c.organization_id) OR public.has_role(_user_id, 'admin'))
  );
$$;

DROP POLICY IF EXISTS "cohort_members read by org or self" ON public.cohort_members;
CREATE POLICY "cohort_members read by org or self" ON public.cohort_members FOR SELECT
USING (
  public.can_manage_cohort(auth.uid(), cohort_id)
  OR user_id = auth.uid()
  OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  OR EXISTS (
    SELECT 1 FROM public.cohort_members me
    WHERE me.cohort_id = cohort_members.cohort_id
      AND me.user_id = auth.uid()
      AND me.role = 'tutor'
      AND me.status = 'active'
  )
  OR public.has_role(auth.uid(),'admin')
);

DROP POLICY IF EXISTS "cohort_members insert by manager" ON public.cohort_members;
CREATE POLICY "cohort_members insert by manager" ON public.cohort_members FOR INSERT
WITH CHECK (public.can_manage_cohort(auth.uid(), cohort_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cohort_members update by manager" ON public.cohort_members;
CREATE POLICY "cohort_members update by manager" ON public.cohort_members FOR UPDATE
USING (public.can_manage_cohort(auth.uid(), cohort_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cohort_members delete by manager" ON public.cohort_members;
CREATE POLICY "cohort_members delete by manager" ON public.cohort_members FOR DELETE
USING (public.can_manage_cohort(auth.uid(), cohort_id) OR public.has_role(auth.uid(),'admin'));

-- updated_at trigger for cohorts
DROP TRIGGER IF EXISTS trg_cohorts_updated_at ON public.cohorts;
CREATE TRIGGER trg_cohorts_updated_at BEFORE UPDATE ON public.cohorts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- 5) Allow platform admin to INSERT organizations directly (for /admin/organizations)
-- Existing INSERT policy requires owner_id = auth.uid() AND has school/company role,
-- which blocks platform admins. Add an additive ADMIN-only insert policy.
DROP POLICY IF EXISTS "orgs insert by platform admin" ON public.organizations;
CREATE POLICY "orgs insert by platform admin" ON public.organizations FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin'));