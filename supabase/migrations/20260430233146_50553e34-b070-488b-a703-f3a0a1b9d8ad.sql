-- FK tutor_profiles.user_id -> profiles.id (umożliwia embed w PostgREST)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_profiles_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.tutor_profiles
      ADD CONSTRAINT tutor_profiles_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Przy okazji: tutor_payment_methods.tutor_id -> profiles.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_payment_methods_tutor_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.tutor_payment_methods
      ADD CONSTRAINT tutor_payment_methods_tutor_id_profiles_fkey
      FOREIGN KEY (tutor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tutor_subjects.tutor_id -> profiles.id, subject_id -> subjects.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_subjects_tutor_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.tutor_subjects
      ADD CONSTRAINT tutor_subjects_tutor_id_profiles_fkey
      FOREIGN KEY (tutor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_subjects_subject_id_fkey'
  ) THEN
    ALTER TABLE public.tutor_subjects
      ADD CONSTRAINT tutor_subjects_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
END $$;