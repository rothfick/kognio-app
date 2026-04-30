DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_profiles_user_id_key'
      AND conrelid = 'public.tutor_profiles'::regclass
  ) THEN
    ALTER TABLE public.tutor_profiles
      ADD CONSTRAINT tutor_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;