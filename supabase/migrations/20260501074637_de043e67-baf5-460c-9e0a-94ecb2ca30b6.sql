-- Tighten bookings UPDATE: prevent students from self-confirming or zeroing the price
DROP POLICY IF EXISTS "bookings participants update" ON public.bookings;

-- Student can update their own booking but cannot change identities, price, or status
CREATE POLICY "bookings student update limited"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id
  AND student_id = (SELECT b.student_id FROM public.bookings b WHERE b.id = bookings.id)
  AND tutor_id   = (SELECT b.tutor_id   FROM public.bookings b WHERE b.id = bookings.id)
  AND price_cents = (SELECT b.price_cents FROM public.bookings b WHERE b.id = bookings.id)
  AND status      = (SELECT b.status      FROM public.bookings b WHERE b.id = bookings.id)
);

-- Tutor can update their own booking, including status, but cannot change identities or price
CREATE POLICY "bookings tutor update"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = tutor_id)
WITH CHECK (
  auth.uid() = tutor_id
  AND student_id = (SELECT b.student_id FROM public.bookings b WHERE b.id = bookings.id)
  AND tutor_id   = (SELECT b.tutor_id   FROM public.bookings b WHERE b.id = bookings.id)
  AND price_cents = (SELECT b.price_cents FROM public.bookings b WHERE b.id = bookings.id)
);