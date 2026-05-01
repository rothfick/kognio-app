
-- ============================================================================
-- PART 2: Extend tutor_profiles
-- ============================================================================
ALTER TABLE public.tutor_profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS teaching_domains text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS education_levels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS reviews_count integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_profiles_verification_status_chk') THEN
    ALTER TABLE public.tutor_profiles
      ADD CONSTRAINT tutor_profiles_verification_status_chk
      CHECK (verification_status IN ('pending','approved','rejected','suspended'));
  END IF;
END $$;

-- Backfill hourly_rate from hourly_rate_cents where missing
UPDATE public.tutor_profiles
   SET hourly_rate = (hourly_rate_cents::numeric / 100)
 WHERE hourly_rate IS NULL AND hourly_rate_cents IS NOT NULL;

-- Replace public read policy: only verified+approved profiles are visible
DROP POLICY IF EXISTS "tutor read published" ON public.tutor_profiles;
CREATE POLICY "tutor_profiles read verified"
  ON public.tutor_profiles FOR SELECT
  TO authenticated
  USING (
    (is_verified = true AND verification_status = 'approved')
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admin manage-all policy
DROP POLICY IF EXISTS "tutor_profiles admin manage" ON public.tutor_profiles;
CREATE POLICY "tutor_profiles admin manage"
  ON public.tutor_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tutor self-manage policy already exists ("tutor manage own")
-- Allow ANY authenticated user to INSERT their own pending tutor_profile (self-request)
DROP POLICY IF EXISTS "tutor_profiles self insert pending" ON public.tutor_profiles;
CREATE POLICY "tutor_profiles self insert pending"
  ON public.tutor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status = 'pending'
    AND is_verified = false
  );

-- Prevent tutor from self-promoting verification: enforce via trigger
CREATE OR REPLACE FUNCTION public.tutor_profiles_protect_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.is_verified := OLD.is_verified;
    NEW.verification_status := OLD.verification_status;
    NEW.verification_notes := OLD.verification_notes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tutor_profiles_protect_verification_trg ON public.tutor_profiles;
CREATE TRIGGER tutor_profiles_protect_verification_trg
BEFORE UPDATE ON public.tutor_profiles
FOR EACH ROW EXECUTE FUNCTION public.tutor_profiles_protect_verification();

-- ============================================================================
-- PART 3: tutor_competencies
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tutor_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_user_id uuid NOT NULL REFERENCES public.tutor_profiles(user_id) ON DELETE CASCADE,
  learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  skill_area_label text,
  years_experience numeric(4,1),
  confidence_level text NOT NULL DEFAULT 'comfortable'
    CHECK (confidence_level IN ('beginner','comfortable','expert')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_competencies_tutor ON public.tutor_competencies(tutor_user_id);
ALTER TABLE public.tutor_competencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_competencies self manage" ON public.tutor_competencies;
CREATE POLICY "tutor_competencies self manage"
  ON public.tutor_competencies FOR ALL
  TO authenticated
  USING (auth.uid() = tutor_user_id)
  WITH CHECK (auth.uid() = tutor_user_id);

DROP POLICY IF EXISTS "tutor_competencies read verified" ON public.tutor_competencies;
CREATE POLICY "tutor_competencies read verified"
  ON public.tutor_competencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tutor_profiles tp
            WHERE tp.user_id = tutor_user_id
              AND tp.is_verified = true
              AND tp.verification_status = 'approved')
    OR auth.uid() = tutor_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tutor_competencies admin manage" ON public.tutor_competencies;
CREATE POLICY "tutor_competencies admin manage"
  ON public.tutor_competencies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- PART 4: tutor_availability_slots (new — distinct from legacy tutor_availability)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tutor_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_user_id uuid NOT NULL REFERENCES public.tutor_profiles(user_id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Warsaw',
  is_recurring boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_avail_slots_tutor ON public.tutor_availability_slots(tutor_user_id);
ALTER TABLE public.tutor_availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_avail_slots self manage" ON public.tutor_availability_slots;
CREATE POLICY "tutor_avail_slots self manage"
  ON public.tutor_availability_slots FOR ALL
  TO authenticated
  USING (auth.uid() = tutor_user_id)
  WITH CHECK (auth.uid() = tutor_user_id);

DROP POLICY IF EXISTS "tutor_avail_slots read verified" ON public.tutor_availability_slots;
CREATE POLICY "tutor_avail_slots read verified"
  ON public.tutor_availability_slots FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tutor_profiles tp
            WHERE tp.user_id = tutor_user_id
              AND tp.is_verified = true
              AND tp.verification_status = 'approved')
    OR auth.uid() = tutor_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tutor_avail_slots admin manage" ON public.tutor_availability_slots;
CREATE POLICY "tutor_avail_slots admin manage"
  ON public.tutor_availability_slots FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- PART 5: Extend bookings
-- ============================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.parent_children(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_plan_id uuid REFERENCES public.learning_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_plan_item_id uuid REFERENCES public.learning_plan_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnostic_attempt_id uuid REFERENCES public.diagnostic_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_area_label text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Warsaw',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_amount numeric(10,2);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_status_chk') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_status_chk
      CHECK (payment_status IN ('unpaid','payment_sent','confirmed','refunded','disputed'));
  END IF;
END $$;

-- Make student_id nullable to allow parent-booking-for-child
ALTER TABLE public.bookings ALTER COLUMN student_id DROP NOT NULL;

-- Backfill price_amount
UPDATE public.bookings
   SET price_amount = (price_cents::numeric / 100)
 WHERE price_amount IS NULL;

-- Add parent + admin RLS
DROP POLICY IF EXISTS "bookings parent read own" ON public.bookings;
CREATE POLICY "bookings parent read own"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    parent_user_id = auth.uid()
    OR (child_id IS NOT NULL AND public.is_parent_of_child(auth.uid(), child_id))
  );

DROP POLICY IF EXISTS "bookings parent create" ON public.bookings;
CREATE POLICY "bookings parent create"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = parent_user_id
    AND (child_id IS NULL OR public.is_parent_of_child(auth.uid(), child_id))
  );

DROP POLICY IF EXISTS "bookings admin manage" ON public.bookings;
CREATE POLICY "bookings admin manage"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- PART 6: payment_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tutor_user_id uuid REFERENCES public.tutor_profiles(user_id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PLN',
  method text NOT NULL DEFAULT 'manual'
    CHECK (method IN ('blik','bank_transfer','revolut','manual','stripe_future')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','proof_uploaded','confirmed','disputed','refunded')),
  proof_url text,
  marked_paid_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_booking ON public.payment_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_tutor ON public.payment_records(tutor_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payer ON public.payment_records(payer_user_id);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- Payer: read own + insert (proof upload via update of proof_url + status='proof_uploaded')
DROP POLICY IF EXISTS "payment_records payer read" ON public.payment_records;
CREATE POLICY "payment_records payer read"
  ON public.payment_records FOR SELECT
  TO authenticated
  USING (payer_user_id = auth.uid());

DROP POLICY IF EXISTS "payment_records payer insert" ON public.payment_records;
CREATE POLICY "payment_records payer insert"
  ON public.payment_records FOR INSERT
  TO authenticated
  WITH CHECK (payer_user_id = auth.uid());

-- Payer can update only proof_url, marked_paid_at, status (to 'proof_uploaded') — enforced by trigger
DROP POLICY IF EXISTS "payment_records payer update proof" ON public.payment_records;
CREATE POLICY "payment_records payer update proof"
  ON public.payment_records FOR UPDATE
  TO authenticated
  USING (payer_user_id = auth.uid())
  WITH CHECK (payer_user_id = auth.uid());

-- Tutor: read + update (confirm/dispute)
DROP POLICY IF EXISTS "payment_records tutor read" ON public.payment_records;
CREATE POLICY "payment_records tutor read"
  ON public.payment_records FOR SELECT
  TO authenticated
  USING (tutor_user_id = auth.uid());

DROP POLICY IF EXISTS "payment_records tutor update" ON public.payment_records;
CREATE POLICY "payment_records tutor update"
  ON public.payment_records FOR UPDATE
  TO authenticated
  USING (tutor_user_id = auth.uid())
  WITH CHECK (tutor_user_id = auth.uid());

-- Admin manage all
DROP POLICY IF EXISTS "payment_records admin manage" ON public.payment_records;
CREATE POLICY "payment_records admin manage"
  ON public.payment_records FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: prevent payer from confirming payment; sync booking.payment_status
CREATE OR REPLACE FUNCTION public.payment_records_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Payer cannot transition to 'confirmed' or 'refunded'
    IF NEW.payer_user_id = auth.uid() AND NOT is_admin AND NEW.tutor_user_id <> auth.uid() THEN
      IF NEW.status IN ('confirmed','refunded') AND OLD.status <> NEW.status THEN
        RAISE EXCEPTION 'payer_cannot_confirm_payment';
      END IF;
      -- Lock other fields
      NEW.amount := OLD.amount;
      NEW.currency := OLD.currency;
      NEW.tutor_user_id := OLD.tutor_user_id;
      NEW.booking_id := OLD.booking_id;
      NEW.confirmed_at := OLD.confirmed_at;
    END IF;

    -- Auto-stamp timestamps
    IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
      NEW.confirmed_at := now();
    END IF;
    IF NEW.status = 'disputed' AND OLD.status <> 'disputed' THEN
      NEW.disputed_at := now();
    END IF;
    IF NEW.status = 'proof_uploaded' AND OLD.status <> 'proof_uploaded' THEN
      NEW.marked_paid_at := COALESCE(NEW.marked_paid_at, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_records_guard_trg ON public.payment_records;
CREATE TRIGGER payment_records_guard_trg
BEFORE UPDATE ON public.payment_records
FOR EACH ROW EXECUTE FUNCTION public.payment_records_guard();

-- Sync booking.payment_status when payment_records changes
CREATE OR REPLACE FUNCTION public.sync_booking_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE public.bookings SET payment_status = 'confirmed' WHERE id = NEW.booking_id;
  ELSIF NEW.status = 'proof_uploaded' THEN
    UPDATE public.bookings SET payment_status = 'payment_sent' WHERE id = NEW.booking_id AND payment_status IN ('unpaid','payment_sent');
  ELSIF NEW.status = 'disputed' THEN
    UPDATE public.bookings SET payment_status = 'disputed' WHERE id = NEW.booking_id;
  ELSIF NEW.status = 'refunded' THEN
    UPDATE public.bookings SET payment_status = 'refunded' WHERE id = NEW.booking_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_records_sync_booking_trg ON public.payment_records;
CREATE TRIGGER payment_records_sync_booking_trg
AFTER INSERT OR UPDATE ON public.payment_records
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_payment_status();

-- ============================================================================
-- PART 7: Storage bucket — payment-proofs (private)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <booking_id>/<filename>
DROP POLICY IF EXISTS "payment-proofs payer upload" ON storage.objects;
CREATE POLICY "payment-proofs payer upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (b.student_id = auth.uid() OR b.parent_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "payment-proofs participant read" ON storage.objects;
CREATE POLICY "payment-proofs participant read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id::text = (storage.foldername(name))[1]
          AND (b.student_id = auth.uid()
               OR b.parent_user_id = auth.uid()
               OR b.tutor_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "payment-proofs payer delete own" ON storage.objects;
CREATE POLICY "payment-proofs payer delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (b.student_id = auth.uid() OR b.parent_user_id = auth.uid())
    )
  );

-- ============================================================================
-- Self-grant tutor role helper (used by onboarding)
-- ============================================================================
-- We DO NOT auto-grant the tutor role on profile submission.
-- The role is granted by the admin verification flow:
CREATE OR REPLACE FUNCTION public.admin_verify_tutor(_tutor_user_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF _approve THEN
    UPDATE public.tutor_profiles
       SET is_verified = true,
           verification_status = 'approved',
           verification_notes = COALESCE(_notes, verification_notes),
           updated_at = now()
     WHERE user_id = _tutor_user_id;
    -- grant tutor role if missing
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_tutor_user_id, 'tutor')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    UPDATE public.tutor_profiles
       SET is_verified = false,
           verification_status = 'rejected',
           verification_notes = COALESCE(_notes, verification_notes),
           updated_at = now()
     WHERE user_id = _tutor_user_id;
  END IF;
END;
$$;
