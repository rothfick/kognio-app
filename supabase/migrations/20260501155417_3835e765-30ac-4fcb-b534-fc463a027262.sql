-- 1. Tabela linków rodzic-uczeń (owner = student)
CREATE TABLE public.student_parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_email text,
  pairing_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','declined','expired')),
  scopes jsonb NOT NULL DEFAULT '{"stats":true,"plans":true,"sessions":true,"full":false}'::jsonb,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (invited_email IS NOT NULL OR pairing_code IS NOT NULL OR parent_id IS NOT NULL)
);

CREATE UNIQUE INDEX student_parent_links_active_unique
  ON public.student_parent_links (student_id, parent_id)
  WHERE parent_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX student_parent_links_code_pending_unique
  ON public.student_parent_links (pairing_code)
  WHERE pairing_code IS NOT NULL AND status = 'pending';

CREATE INDEX student_parent_links_student_idx ON public.student_parent_links (student_id);
CREATE INDEX student_parent_links_parent_idx ON public.student_parent_links (parent_id);
CREATE INDEX student_parent_links_email_idx ON public.student_parent_links (lower(invited_email));

ALTER TABLE public.student_parent_links ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER student_parent_links_touch
  BEFORE UPDATE ON public.student_parent_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Helper: czy _parent ma aktywne upoważnienie od _student
CREATE OR REPLACE FUNCTION public.is_linked_parent_of(_parent_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_parent_links
    WHERE parent_id = _parent_id AND student_id = _student_id AND status = 'active'
  );
$$;

-- 3. Helper: zaakceptuj link po kodzie (rodzic) — dopasuje też email, jeśli jest
CREATE OR REPLACE FUNCTION public.accept_student_parent_link(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.student_parent_links%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  SELECT * INTO v_link FROM public.student_parent_links
   WHERE pairing_code = upper(_code) AND status = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_or_used_code'; END IF;
  IF v_link.expires_at < now() THEN
    UPDATE public.student_parent_links SET status='expired' WHERE id = v_link.id;
    RAISE EXCEPTION 'expired';
  END IF;
  IF v_link.invited_email IS NOT NULL AND lower(v_link.invited_email) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;
  IF v_link.student_id = auth.uid() THEN RAISE EXCEPTION 'cannot_link_self'; END IF;

  UPDATE public.student_parent_links
     SET parent_id = auth.uid(), status='active', accepted_at = now(), updated_at = now()
   WHERE id = v_link.id;

  RETURN v_link.id;
END;
$$;

-- 4. Helper: zaakceptuj link po emailu (rodzic znajduje swoje zaproszenia bez kodu)
CREATE OR REPLACE FUNCTION public.accept_student_parent_link_by_id(_link_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_link public.student_parent_links%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  SELECT * INTO v_link FROM public.student_parent_links WHERE id = _link_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_link.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF v_link.expires_at < now() THEN
    UPDATE public.student_parent_links SET status='expired' WHERE id = v_link.id;
    RAISE EXCEPTION 'expired';
  END IF;
  IF v_link.invited_email IS NULL OR lower(v_link.invited_email) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;
  IF v_link.student_id = auth.uid() THEN RAISE EXCEPTION 'cannot_link_self'; END IF;

  UPDATE public.student_parent_links
     SET parent_id = auth.uid(), status='active', accepted_at = now(), updated_at = now()
   WHERE id = v_link.id;
  RETURN v_link.id;
END;
$$;

-- 5. RLS dla student_parent_links
CREATE POLICY "spl student manage own"
  ON public.student_parent_links
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "spl parent read own"
  ON public.student_parent_links
  FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR (
      status = 'pending'
      AND invited_email IS NOT NULL
      AND lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  );

CREATE POLICY "spl parent decline own pending"
  ON public.student_parent_links
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND invited_email IS NOT NULL
    AND lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
  WITH CHECK (
    status IN ('declined','pending')
    AND invited_email IS NOT NULL
    AND lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE POLICY "spl admin manage"
  ON public.student_parent_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. Rozszerzenie RLS innych tabel — dostęp do odczytu dla zalinkowanego rodzica

-- profiles: rodzic widzi profil ucznia
CREATE POLICY "profiles linked parent read"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_linked_parent_of(auth.uid(), id));

-- diagnostic_attempts (read-only dla rodzica zalinkowanego)
CREATE POLICY "diag_attempts linked parent read"
  ON public.diagnostic_attempts FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND is_linked_parent_of(auth.uid(), user_id));

-- diagnostic_responses (read-only via attempt)
CREATE POLICY "diag_responses linked parent read"
  ON public.diagnostic_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diagnostic_attempts a
     WHERE a.id = diagnostic_responses.attempt_id
       AND a.user_id IS NOT NULL
       AND is_linked_parent_of(auth.uid(), a.user_id)
  ));

-- diagnostic_items (read-only via attempt)
CREATE POLICY "diag_items linked parent read"
  ON public.diagnostic_items FOR SELECT TO authenticated
  USING (
    attempt_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.diagnostic_attempts a
       WHERE a.id = diagnostic_items.attempt_id
         AND a.user_id IS NOT NULL
         AND is_linked_parent_of(auth.uid(), a.user_id)
    )
  );

-- learning_plans
CREATE POLICY "plans linked parent read"
  ON public.learning_plans FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND is_linked_parent_of(auth.uid(), user_id));

-- learning_plan_items via plan
CREATE POLICY "lpi linked parent read"
  ON public.learning_plan_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.learning_plans p
     WHERE p.id = learning_plan_items.plan_id
       AND p.user_id IS NOT NULL
       AND is_linked_parent_of(auth.uid(), p.user_id)
  ));

-- learning_checkpoints
CREATE POLICY "checkpoints linked parent read"
  ON public.learning_checkpoints FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND is_linked_parent_of(auth.uid(), user_id));

-- bookings (sesje) — rodzic widzi sesje, w których uczeń był studentem
CREATE POLICY "bookings linked parent read"
  ON public.bookings FOR SELECT TO authenticated
  USING (is_linked_parent_of(auth.uid(), student_id));
