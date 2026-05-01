
# Roadmapa Mądrzej — od „działa po nitce" do MVP gotowego do publikacji

Poniżej plan w 5 sprintach. Każdy sprint to jedna sensowna iteracja (1 wiadomość = 1 sprint), kończy się czymś, co realnie zmienia odczucie produktu. Kolejność jest świadoma: najpierw fundament UX, potem serce produktu (sesja live), potem monetyzacja i retencja.

---

## Sprint 1 — Profil, role, nawigacja (fundament)

**Cel UX:** użytkownik po zalogowaniu wie kim jest w aplikacji i co ma zrobić.

1. **`/` → redirect do `/dashboard`** gdy zalogowany (dziś leci na Landing — dziwne).
2. **Strona `/profile`** — edycja `display_name`, `bio`, `timezone`, `ui_language`, upload avatara do bucketu `avatars` (Storage public + RLS owner-write).
3. **Tutor onboarding fix** — własny `/tutor/:id` pokazuje „Edytuj profil tutora" zamiast „Zarezerwuj". Przycisk „Zostań tutorem" w Profilu (dodaje rolę + tworzy `tutor_profiles` szkielet).
4. **Header role-aware** — wskaźnik liczby `pending` przy Calendar (kropka + liczba), avatar w prawym rogu z dropdownem (Profil / Wyloguj / Przełącz rolę jeśli ma obie).
5. **Empty states wszędzie** (Brain, Discover, Calendar, Circles, Peer) — zamiast suchego „brak", komponent `<EmptyState icon title cta />` z ilustracją i jasnym CTA do kolejnego kroku.

**Migracje:** bucket `avatars` (public) + 3 polityki Storage (read all / insert/update/delete by owner).

---

## Sprint 2 — Sesja na żywo z prawdziwym wideo (LiveKit)

**Cel UX:** sesja przestaje być atrapą. To 60% wartości produktu.

1. **Edge function `livekit-token`** — przyjmuje `sessionId`, weryfikuje że `auth.uid()` jest uczestnikiem booking, zwraca JWT z `room=session.room_name`, `identity=user.id`, grants do publish/subscribe.
2. **Komponent `LiveKitVideo.tsx`** — `@livekit/components-react`: `LiveKitRoom` + `VideoConference` preset, kontrolki kamera/mikrofon/share screen/leave. Zastępuje placeholder w `SessionRoom.tsx`.
3. **Stan sesji** — przy pierwszym wejściu `started_at = now()`. „Zakończ sesję" (tylko tutor) ustawia `ended_at` i wywołuje `session-summary` automatycznie.
4. **Sekrety:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` — poproszę o nie przez add_secret na początku sprintu.
5. **Fallback** gdy brak kluczy: czytelny komunikat „Wideo niedostępne — skontaktuj się z adminem", reszta sesji (czat/tablica/co-pilot) działa.
6. **Auto-transkrypt z LiveKit audio track** — w drugiej kolejności w tym sprincie, jeśli zostanie czas: wysyłanie audio chunks do edge `transcribe` (Lovable AI gateway → Gemini multimodal lub Web Speech jako tymczasowy fallback z lepszym diarization po `participant identity`).

**UX detale:**
- Layout sesji w pełnym viewport (bez headera), wyjście „X" lewy górny.
- Wskaźnik jakości połączenia (zielony/żółty/czerwony) z LiveKit `ConnectionQuality`.
- „Kopiuj link do pokoju" dla tutora.

---

## Sprint 3 — Pętla pieniędzy + recenzje + powiadomienia

**Cel UX:** uczeń kończy sesję → płaci → ocenia → wraca. Tutor widzi że dostał kasę i ★.

1. **`PaymentPage` polish:**
   - Upload `proof_url` (bucket `payment-proofs` private) — zdjęcie potwierdzenia BLIK.
   - Countdown 24h od `marked_paid_at` z przypomnieniem dla tutora.
   - Status `disputed` jeśli po 7 dniach tutor nie potwierdził (cron edge `payments-auto-dispute`).
   - Pokaż dane do przelewu z `tutor_payment_methods` (kopiuj IBAN, BLIK QR jeśli dostarczy).

2. **Recenzje:**
   - Tabela `reviews(booking_id UNIQUE, student_id, tutor_id, rating 1-5, comment, created_at)` + RLS (owner write, tutor public read).
   - Trigger `after insert reviews`: aktualizuje `tutor_profiles.rating` (avg) i `sessions_completed` (count of completed bookings).
   - Modal recenzji wyskakuje automatycznie po wejściu na Dashboard, jeśli jest `completed && paid && !reviewed` booking.
   - Gwiazdki + komentarz na publicznym `/tutor/:id`.

3. **Powiadomienia:**
   - Tabela `notifications(id, user_id, kind, payload jsonb, read_at, created_at)` + Realtime publication.
   - Trigger eventowy: nowa rezerwacja (→ tutor), potwierdzona (→ student), opłacona (→ tutor), płatność potwierdzona (→ student), 15 min do sesji (cron), nowy raport gotowy.
   - `<NotificationBell />` w headerze: badge z liczbą `read_at IS NULL`, dropdown z listą, klik = oznacz jako przeczytane + nawigacja do kontekstu.

4. **Karma events** — insert przy: peer help resolved, ukończona sesja w kręgu, recenzja 5★ wystawiona dla tutora.

---

## Sprint 4 — Brain z prawdziwą nauką (SM-2) + RAG

**Cel UX:** uczeń ma powód wracać codziennie, nie tylko na sesję raz w tygodniu.

1. **Spaced repetition SM-2:**
   - `src/lib/sm2.ts` — czysta funkcja `nextReview(card, quality 0-5) → {ease, interval, due_at}`.
   - Widok „Powtórki dziś" w Brain: kolejka kart z `due_at <= now()`, flip animation, 3 przyciski Łatwe/Średnie/Trudne (mapują na quality 5/3/1).
   - Badge w headerze przy „Brain" gdy są zaległe powtórki.
   - Index DB: `flashcards(user_id, due_at)`.

2. **Drugi Mózg (RAG) end-to-end:**
   - Edge `embed-knowledge`: po `session_summary` insert, dzielimy summary+transcript na chunki, embeddings przez Lovable AI (`text-embedding-*`), insert do `knowledge_chunks` z pgvector.
   - `brain-chat` doposażony: przy pytaniu robi `match_chunks(query_embedding, user_id, top 5)` i wkleja do system prompt jako kontekst.
   - UI Brain — wyraźne źródła odpowiedzi („Z sesji 12.04 — Trygonometria").

3. **Knowledge Graph** — naprawić jeśli leży, albo wyłączyć z UI do czasu prawdziwych danych (lepiej brak niż udawany).

---

## Sprint 5 — Discover, Circles, Peer dopięte + polish wizualny

**Cel UX:** strony społecznościowe nie są martwe, system wygląda spójnie.

1. **Discover:**
   - Filtry: przedmiot (multiselect), zakres ceny (slider), poziom (multiselect z `tutor_subjects.level`), sortowanie (rating/cena/doświadczenie).
   - Karta tutora: gwiazdki, liczba sesji, „Verified" badge gdy `is_verified`, „Odpowiada szybko" jeśli avg response < 1h (statystyka z bookings).
   - Skeleton loading zamiast spinnera.

2. **Circles:**
   - „Wejdź do kręgu" → strona `/circles/:id` z tablicą postów (nowa tabela `circle_posts`), upcoming sesje grupowe, członkowie.
   - „Utwórz krąg" — modal z formularzem.

3. **Peer:**
   - Po kliknięciu „Pomogę" → `helper_id = me`, `status = in_progress`, otwórz wątek 1-na-1 (re-use `session_chat` z `session_id = peer_request.id` lub osobna tabela `peer_messages`).
   - Po rozwiązaniu: helper dostaje +karma, requester może podziękować.

4. **Polish wizualny (cała appka):**
   - Audyt spacing/typo: zastąpić wszystkie hardcoded `text-white/bg-black` tokenami semantycznymi.
   - Animacje: `transition-all`, hover lifts na kartach, loading shimmer.
   - Mobile sweep: wszystkie strony na 375px szer.
   - Spójna ikonografia (lucide), spójne radius (var(--radius)).

---

## Co świadomie NIE wchodzi do MVP

- Stripe/Paddle (zgodnie z core memory: platforma nie pośredniczy).
- PWA / mobile app — po MVP, jeśli będzie sygnał.
- Subskrypcje / premium plan platformy — po MVP.
- Zaawansowane statystyki tutora (heatmapy, prognozy) — fajne, ale nie blokują launchu.
- Wielojęzyczność EN poza interfejsem (treści generowane AI mogą być EN, ale nie tłumaczymy bio tutorów).

---

## Sekcja techniczna

**Nowe tabele/migracje (po sprintach):**
- S1: bucket `avatars` + Storage policies.
- S2: brak — wszystko w edge function + secrets.
- S3: `reviews`, `notifications`, bucket `payment-proofs`, kolumna `payments.disputed_at`, triggery (review_avg, notification_emitter), realtime publication na `notifications`.
- S4: index `flashcards(user_id, due_at)`, funkcja `match_chunks(vector, uuid, int)` (jeśli jeszcze nie ma).
- S5: `circle_posts`, ewentualnie `peer_messages`.

**Nowe edge functions:**
- S2: `livekit-token`
- S3: `notify-emit` (opcjonalnie, jeśli triggery DB nie wystarczą), `payments-auto-dispute` (cron)
- S4: `embed-knowledge`, rozbudowa `brain-chat` o RAG

**Sekrety wymagane:**
- S2: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- S4: nic (Lovable AI Gateway pokrywa embeddings)

**Pliki nowe (najważniejsze):**
- `src/components/session/LiveKitVideo.tsx`
- `src/components/layout/NotificationBell.tsx`
- `src/components/EmptyState.tsx`
- `src/components/reviews/ReviewModal.tsx`
- `src/lib/sm2.ts`
- `src/pages/CircleDetail.tsx`

---

## Kolejność i sugerowany czas

```text
Sprint 1  ─ Profil + nawigacja          (~30 min) ◄── start tutaj
Sprint 2  ─ LiveKit wideo               (~45 min, wymaga kluczy od Ciebie)
Sprint 3  ─ Płatności + recenzje + 🔔    (~45 min)
Sprint 4  ─ Brain SM-2 + RAG            (~30 min)
Sprint 5  ─ Discover/Circles/Peer + UI  (~30 min)
```

Po S2 produkt jest demo-able. Po S3 jest gotowy do pierwszych płatnych użytkowników. Po S5 jest gotowy do publikacji.

Powiedz **„lecimy S1"** albo wskaż który sprint chcesz wziąć pierwszy / co wyrzucić / co dorzucić.
