
-- Student AI assistant messages: separate from tutor co-pilot.
CREATE TABLE IF NOT EXISTS public.lesson_student_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('student','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_student_ai_messages_booking ON public.lesson_student_ai_messages(booking_id, created_at);

ALTER TABLE public.lesson_student_ai_messages ENABLE ROW LEVEL SECURITY;

-- Student or parent of booking can read their own conversation. Tutor cannot read student's private chat.
DROP POLICY IF EXISTS "lsai_select_own" ON public.lesson_student_ai_messages;
CREATE POLICY "lsai_select_own"
ON public.lesson_student_ai_messages FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND (b.student_id = auth.uid() OR b.parent_user_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Insert: only student/parent participant of the booking can insert their own row.
DROP POLICY IF EXISTS "lsai_insert_self" ON public.lesson_student_ai_messages;
CREATE POLICY "lsai_insert_self"
ON public.lesson_student_ai_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
      AND (b.student_id = auth.uid() OR b.parent_user_id = auth.uid())
  )
);
