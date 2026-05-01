
# Plan: doprowadzenie Mądrzej do stanu „działa, nie tylko istnieje"

Aplikacja ma już wszystkie moduły, ale są pourywane: nie ma strony startowej po zalogowaniu, sesja to placeholder bez wideo, peer/krąg po kliknięciu nic nie robi, tutor i uczeń widzą ten sam interfejs. Plan robimy w 4 fazach — każda samodzielnie podnosi jakość.

---

## Faza 1 — Szybkie UX-pain fixes (1 iteracja)

Drobne rzeczy, które najbardziej irytują w 5 sekund po wejściu.

- **Strona startowa po zalogowaniu** — `/` po loginie pokazuje Landing zamiast dashboardu. Dodajemy redirect `/` → `/dashboard` gdy `user`.
- **„Dołącz" do kręgu nic nie zmienia** — przycisk znika dopiero po reloadzie, nie ma stanu „już dołączyłem", nie ma wejścia do kręgu. Dorzucamy: ładowanie membershipów, zamiana przycisku na „Wejdź", licznik członków.
- **„Pomogę" w peer** — przycisk jest, ale nic nie robi. Implementacja: ustawia `helper_id`, status `in_progress`, otwiera czat 1-na-1 (re-używamy `session_chat` w trybie peer, lub prosty wątek).
- **Stawka w zł zamiast groszy** — zrobione, ale to samo trzeba wszędzie gdzie pokazujemy cenę (TutorProfile, Calendar, PaymentPage — sprawdzić formaty).
- **Discover: filtry** — przedmiot, zakres ceny, sortowanie (rating/cena). Dziś jest tylko search po tekście.
- **Pusty stan wszędzie** — Brain bez sesji, Calendar bez rezerwacji, Discover bez tutorów: zamiast suchego „brak", pokazujemy CTA do następnego kroku (np. „Znajdź tutora", „Zostań tutorem").

## Faza 2 — Dashboard + nawigacja świadoma roli

- **`/dashboard`** — nowa strona startowa po loginie:
  - dla **ucznia**: nadchodzące sesje, niezapłacone faktury, ostatnie fiszki, sugerowani tutorzy, otwarte prośby peer
  - dla **tutora**: nadchodzące sesje, oczekujące rezerwacje do potwierdzenia, niepotwierdzone wpłaty, statystyki (rating, sesje, zarobek tygodnia), CTA do uzupełnienia profilu jeśli niepublikowany
  - dla **obu ról**: tabs „Jako uczeń / Jako tutor"
- **Header role-aware** — jeśli user nie jest tutorem, ukryj zakładki które tylko dla tutora będą miały sens. Dodaj wskaźnik „● niepotwierdzone (3)" przy Calendar gdy są bookingi `pending`.
- **Profil użytkownika** — strona `/profile` z avatar upload (Storage bucket `avatars`), display_name, bio, timezone. Dziś nigdzie tego nie da się ustawić poza onboardingiem.
- **Link do własnego profilu tutora** — `/tutor/:id` z własnym id pokazuje przycisk „Edytuj" zamiast „Zarezerwuj".

## Faza 3 — Sesja na żywo (serce produktu)

Dziś sesja to placeholder „Wideo (LiveKit — placeholder)". Bez tego cały produkt jest udawany.

- **LiveKit wideo** — klucz `LIVEKIT_API_KEY/SECRET` (secret), edge function `livekit-token` która wystawia JWT dla `room_name` sesji. Komponent `<LiveKitRoom>` z `@livekit/components-react`: kafelki uczestników, mute, kamera, share screen.
- **Transcriber realny** — dziś `LiveTranscriber` używa Web Speech API tylko po stronie mówcy. Wymieniamy na **Lovable AI Gateway / OpenAI Realtime** (lub ElevenLabs Scribe — wymaga klucza). Diaryzacja po `speaker_id` z LiveKit.
- **Whiteboard współdzielony** — tldraw + Yjs jest, ale trzeba zweryfikować że provider naprawdę synchronizuje (Supabase Realtime broadcast jako transport zamiast y-websocket).
- **Emotion Engine — opt-in z toggle** — face-api.js ciągle mieli kamerę, to baterio- i prywatno-żerne. Dodać switch „Włącz analizę emocji" z dialogiem zgody.
- **Auto-end** — gdy `ends_at` minie + 30min, sesja sama dostaje `ended_at` i odpala `session-summary` (cron lub trigger przy zamykaniu okna).

## Faza 4 — Pętla ucznia: pieniądze + spaced repetition + powiadomienia

- **Powiadomienia** — tabela `notifications(user_id, kind, payload, read_at)` + dzwoneczek w headerze. Eventy: nowa rezerwacja, potwierdzona, opłacona, sesja za 15min, nowy raport.
- **Recenzje** — po zakończonej sesji uczeń wystawia `rating 1-5 + komentarz`. Trigger w bazie aktualizuje `tutor_profiles.rating` (avg) i `sessions_completed`.
- **Spaced repetition (SM-2)** — w Brain dzisiejsze fiszki są tylko listą. Dodajemy widok „Powtórki dziś (12)" z mechanizmem: pokazuję front → user klika Łatwe/Średnie/Trudne → update `ease`, `due_at` formułą SM-2. Liczba czeka w headerze jako badge.
- **PaymentPage** — proof_url upload (zdjęcie potwierdzenia), countdown 24h dla tutora, automatyczny status `disputed` jeśli student oznaczył a tutor 7 dni nie potwierdził.
- **Karma** — po peer help / circle session insert do `karma_events`. Profil pokazuje sumę.

---

## Sekcja techniczna

**Nowe pliki** (faza po fazie):
- F1: `src/pages/Dashboard.tsx`, rozbudowa `Discover.tsx` (filtry), patch `Circles.tsx`/`Peer.tsx`
- F2: `src/pages/Profile.tsx`, hook `useUserRole()`, modyfikacja `Header.tsx` i `App.tsx` (redirect `/` → `/dashboard`)
- F3: `src/components/session/LiveKitVideo.tsx`, edge function `supabase/functions/livekit-token/index.ts`, refaktor `LiveTranscriber` na realtime API
- F4: `src/pages/Reviews.tsx` (modal), `src/lib/sm2.ts`, komponent `NotificationBell`, edge function `notify-send`

**Nowe migracje SQL**:
- `notifications` table + RLS owner-scoped + realtime publication
- `reviews` table (booking_id unique, rating 1-5, comment) + trigger aktualizujący `tutor_profiles.rating`
- index na `flashcards(user_id, due_at)` dla widoku powtórek
- pole `payments.proof_url` (jeśli brak), pole `payments.disputed_at`
- bucket Storage `avatars` (public) + policies, bucket `payment-proofs` (private)

**Sekrety wymagane**:
- F3: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` — poproszę przez add_secret kiedy zaczniemy fazę
- F3 (opcjonalnie zamiast Web Speech): `OPENAI_API_KEY` lub `ELEVENLABS_API_KEY` — jeśli nie chcesz, lecimy na Web Speech ulepszone

**Co NIE jest w planie** (świadomie):
- Stripe/Paddle — zgodnie z core memory: platforma nie pośredniczy w płatnościach
- Mobile app — tylko PWA później jeśli będzie potrzeba
- Płatne plany subskrypcji platformy — to później, po MVP

---

## Sugerowana kolejność wykonania

1. **Zacznijmy od Fazy 1** (1 wiadomość, ~30 min pracy) — od razu poczujesz że appka żyje.
2. Potem **Faza 2** (dashboard) — to nada produktowi sens po loginie.
3. **Faza 3** (LiveKit) — wymaga Twojej decyzji o kluczach, robimy gdy będziesz gotowy.
4. **Faza 4** dorzucamy iteracyjnie.

Powiedz „lecimy" lub które fazy/elementy chcesz przestawić, dorzucić albo wyrzucić.
