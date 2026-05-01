
# TutorOS AI — Planning Document (v2, po korektach)

> Status: planning only. Zmiany vs v1: (a) usunięta niepotwierdzona statystyka 70%, (b) usunięta gwarancja zwrotu pieniędzy z MVP, zastąpiona obietnicą raportu, (c) MVP odchudzony — LiveKit/transkrypcja/emocje/co-pilot przesunięte z MVP do Fazy 3. MVP koncentruje się na: role, dashboardy, diagnoza, graf wiedzy, raport rodzica, booking.

---

## 1. Product Vision

**TutorOS AI = AI Learning Intelligence Platform.** Każda sesja, test i zadanie to dane, które zasilają trwały model wiedzy ucznia, dobierają tutora i adaptują plan nauki.

**Problem.** Rynek korepetycji traktuje lekcje jako pojedyncze transakcje — nikt nie utrzymuje długoterminowego modelu *co uczeń realnie umie*. **Duża część wydatków rodziców na korepetycje jest trudna do oceny pod kątem rzeczywistych efektów uczenia się** (brak twardych danych Δ-mastery, raporty subiektywne, re-diagnoza co lekcję).

**Rozwiązanie.** Trwały **Student Knowledge Graph (SKG)** + **Adaptive Learning Engine** pod warstwą tutoringu. Tutor staje się wysoko-dźwigniowym operatorem AI-driven curriculum; rodzic dostaje raport oparty na dowodach; uczeń ma plan adaptujący się po każdej interakcji.

**Czym się różni.**
| Standardowy marketplace | TutorOS AI |
|---|---|
| Booking + płatność + chat | Booking jako efekt planu nauki |
| Tutor posiada metodologię | Platforma posiada metodologię, tutor wykonuje i wzbogaca |
| Recenzje = gwiazdki | Recenzje = mierzalna Δ-mastery (cel długoterminowy) |
| Re-diagnoza co lekcję | Ciągła diagnoza, każdy sygnał aktualizuje SKG |

**One-liner.** *"TutorOS AI to system operacyjny spersonalizowanej edukacji — diagnozuje, planuje, uczy i dokumentuje postęp."*

---

## 2. Innovation Angle (R&D / FENG SMART)

R&D core: **wieloagentowy adaptacyjny system uczenia trenowany na danych z sesji korepetycyjnych, produkujący wyjaśnialne rekomendacje i mierzalne wyniki edukacyjne.**

1. **Adaptive Diagnostic Engine (ADE)** — IRT-lite + LLM-driven pula zadań; konwergencja w <15 itemach.
2. **Student Knowledge Graph (SKG)** — graf KCs z prawdopodobieństwem mastery + model zapominania; wieloźródłowa aktualizacja Bayesowska.
3. **Tutor–Student Matching Algorithm** — multi-objective optimizer scorowany na *przewidywanym Δ-mastery*, nie preferencjach.
4. **Lesson Intelligence Layer** *(Phase 3)* — NLP na transkrypcie → strukturalny `lesson_outcome`.
5. **Personalized Material Generator** — homework/flashcards w strefie najbliższego rozwoju.
6. **Explainable Educational Insights (XEI)** — każda rekomendacja ma rationale + evidence chain. Krytyczne dla rodziców i regulatora (małoletni).
7. **Outcome Attribution Model** *(Phase 5+)* — model przyczynowo-skutkowy Δ-mastery → interwencja.

R&D risk i WP-y mapują się 1:1.

---

## 3. Core User Roles

| Rola | Opis | Uprawnienia kluczowe |
|---|---|---|
| **student** | Uczeń (często małoletni 12–19) | Diagnoza, własny SKG, booking, homework, chat z tutorem |
| **parent** | Płaci, monitoruje, zgoda RODO za małoletniego | Konta dzieci, raporty, akceptacja tutorów, płatności |
| **tutor** | Zweryfikowany ekspert | Dostępność, lekcje, notatki, SKG przypisanych uczniów |
| **org_admin** | Manager szkoły / centrum | Org-wide students/tutors, analytics, billing |
| **org_member** | Pracownik (nauczyciel, koordynator) | Cohort read-only |
| **platform_admin** | My | Pełna moderacja, weryfikacje, analytics |

Egzekucja przez `user_roles` + `has_role()` SECURITY DEFINER + RLS. Parent–child przez `parent_links(parent_id, student_id, relation, consent_signed_at)`.

---

## 4. Main User Journeys (zwięźle)

- **Student onboarding (małoletni):** rodzic tworzy konto rodzica → tworzy/zaprasza dziecko → zgoda RODO → dziecko loguje się → przedmioty + cele → diagnoza ADE (15 min) → pierwszy snapshot SKG + plan → lista dopasowanych tutorów → booking pierwszej lekcji.
- **Parent onboarding:** signup → weryfikacja email → dodaj dziecko(i) → RODO + metoda płatności → dashboard z pustym SKG i CTA "zacznij od diagnozy".
- **Tutor onboarding:** signup → weryfikacja tożsamości (dokument, ręczna recenzja) → przedmioty + poziomy → opcjonalna demo-lekcja → akceptacja admina → dostępność + cena → aktywny.
- **AI diagnostic:** 5–15 adaptacyjnych itemów → LLM ocenia otwarte → posterior nad KCs → SKG init → uzgodnienie celów → learning path v1.
- **Booking lekcji:** student/rodzic widzi "następny rekomendowany krok" → AI sugeruje tutora + temat + długość → kalendarz → potwierdzenie → płatność (P2P, BLIK/IBAN) → notyfikacja.
- **Conducting a lesson (MVP):** prosty pokój sesji — link do zewnętrznego wideo (Meet/Zoom — wybór tutora) + tablica notatek tekstowych w aplikacji + checklista KCs do omówienia. **Brak LiveKit/transkrypcji/emocji w MVP.**
- **Lesson notes:** tutor po lekcji wypełnia formularz: omówione KCs (checklist z planu), obserwacje, ocena postępu per KC (-2..+2), sugestia następnego kroku. AI może zasugerować draft notatki na podstawie checklisty (bez transkrypcji).
- **AI parent report:** cykliczny (tygodniowy) — raport oparty na danych: ukończone lekcje, notatki tutora, wyniki diagnoz/homework, mastery delta. PDF + dashboard.
- **Homework:** generator → uczeń rozwiązuje → auto-grade (zamknięte) + LLM-grade (otwarte) → SKG update.
- **Reviewing progress:** rodzic widzi trend mastery, heatmapa, nadchodzące lekcje, faktury.
- **Admin moderation:** kolejka (weryfikacje tutorów, zgłoszenia, AI flags, spory płatności).
- **Org management:** *(Phase 5)* org_admin zaprasza tutorów + uczniów → cohorts → KPI → fakturowanie.

---

## 5. MVP Scope (zaktualizowany — odchudzony)

**Cel MVP:** 8–10 tyg., demonstrowalny grant-reviewerom i 5 płacącym rodzinom-pilotom. **Bez LiveKit i bez warstwy live-AI.**

**Must-have (MVP)**
- Auth + role (student/parent/tutor/admin) + parent–child link + zgoda RODO.
- Profile tutora + workflow weryfikacji (ręczny).
- KC ontology dla matematyki klasy 7–9 (~80 KCs).
- ADE v1 (jeden przedmiot, 15 itemów, IRT-lite + LLM grading dla otwartych).
- SKG v1 — `student_kc_mastery` z aktualizacją z diagnozy + notatki tutora + homework.
- Matching v1 — rule-based (przedmiot + poziom + dostępność + rating) z hookiem ML na później.
- Booking + kalendarz + płatność P2P (BLIK/IBAN, proof upload, 7-dniowy auto-dispute) — model jak obecnie.
- Pokój lekcji **lekki**: zewnętrzny link wideo (Meet/Zoom) + tablica notatek tekstowych + checklista KCs + formularz post-lekcyjny.
- Lesson summary "asystent" (na podstawie checklisty + notatek tutora, **bez transkrypcji**) → tutor zatwierdza → SKG update.
- Homework generator v1 (tylko zamknięte itemy) + auto-grade.
- Tygodniowy AI parent report (PDF + dashboard, oparty na strukturalnych danych — nie na transkrypcji).
- Dashboardy: student / parent / tutor / admin.
- PL/EN i18n.
- Wszystkie obecne security findings rozwiązane.

**Should-have (po MVP, przed pilotem płatnym)**
- Notyfikacje (in-app + email).
- Reviews tutora (gwiazdki + komentarz).
- Wizualizacja grafu wiedzy (read-only).
- Generator homework: itemy otwarte + LLM-grading.
- Spaced repetition flashcards (SM-2) na bazie SKG decay.

**Could-have (Phase 3 — Lesson Intelligence)**
- LiveKit pokój wideo wbudowany.
- Transkrypcja realtime (ElevenLabs Scribe).
- Emotion engine (face-api.js lokalnie).
- AI co-pilot w sesji (tutor-only).
- RAG-powered "Drugi Mózg" student-side.

**Later / Enterprise (Phase 5+)**
- Org accounts, white-label, LMS integracje, Stripe Connect, więcej przedmiotów, predicted exam score, causal attribution, mobile PWA.

---

## 6. R&D / Grant-Oriented Feature Map (skrót)

| Feature | Co robi | Innowacja | Dane | Output | Metryki | R&D narrative |
|---|---|---|---|---|---|---|
| ADE | <15 itemów do profilu wiedzy | IRT + LLM gen | item bank, odp. | posterior KC | items-to-converge, kalibracja | Polski item bank + pipeline |
| SKG | Mastery + decay | Wieloźródłowa aktualizacja Bayesowska | diagnoza, notatki tutora, homework (+ NLP later) | mastery prob | predicted vs actual | Schemat grafu dla PL curriculum |
| Matching | Optymalizacja predicted gain | Multi-objective + uczony tutor effect | profil tutora, historyczna Δ-mastery, SKG ucznia | ranking + rationale | acceptance, post-lesson Δ | Algorytm trenowany na realnych wynikach |
| Lesson Intelligence *(Phase 3)* | Transkrypt → strukturalny outcome | PL educational NLP | transkrypt, whiteboard, emotion | lesson_outcome | inter-rater agreement | Pierwszy strukturalny PL korpus tutoringowy |
| Material Gen | Homework/flashcards z luk | ZPD-calibrated gen | SKG, item bank | homework set | completion, success vs predicted | Adaptacyjna generacja w PL |
| XEI | Każda rekomendacja = rationale + evidence | Evidence-chain UX dla AI w edu | wszystko powyżej | wyjaśnienie | parent comprehension survey | Explainable AI dla małoletnich |
| Outcome Attribution *(Phase 5+)* | Δ-mastery → interwencja | Causal-flavored | event log | per-intervention effect | stabilność cohort | Outcome-based pricing fundament |

---

## 7. System Architecture

```text
Client (React 18 + Vite + TS + Tailwind + shadcn, i18n pl/en, TanStack Query)
   │
   │  HTTPS / WSS (realtime tylko dla notifications + chat 1:1 tutor↔student/parent)
   ▼
Lovable Cloud (Supabase)
   ├── Auth (email + Google + parent consent flow)
   ├── Postgres + pgvector (later) + RLS + triggers
   ├── Storage (avatars, payment-proofs, homework, reports, consent-docs)
   ├── Realtime (notifications, 1:1 chat) — RLS-gated
   └── Edge Functions:
        • ade-next-item, ade-grade
        • matching, lesson-summary, skg-update
        • homework-gen, homework-grade
        • parent-report (cron weekly)
        • notify-emit, payments-auto-dispute
        ── (Phase 3): livekit-token, transcribe, ai-copilot, embed-knowledge
   │
   ▼
Lovable AI Gateway (Gemini 2.5 Flash domyślnie, eskalacja do GPT-5 / Gemini 2.5 Pro dla raportów)

(Phase 3 only) LiveKit Cloud (WebRTC SFU) + ElevenLabs Scribe Realtime (PL STT)
```

- Frontend: React/Vite/TS (Lovable-native).
- Backend: Lovable Cloud only.
- AI: Lovable AI Gateway (bez API keys użytkownika).
- Płatności: P2P do Phase 4. Stripe Connect dopiero gdy wolumen uzasadnia.
- Observability: Supabase logs + edge function logs + `audit_logs` (model+prompt version na każdym AI artefakcie).

---

## 8. Database Schema (v1)

> Bazuje na istniejących tabelach (profiles, user_roles, tutor_profiles, bookings, sessions, payments). Nowe = **(NEW)**. Tabele związane z transkryptem/emocjami pozostają w schemacie ale nie są zasilane w MVP.

| Tabela | Cel | Pola kluczowe | Relacje | RLS |
|---|---|---|---|---|
| `profiles` | Profil użytkownika | id, display_name, locale, timezone, avatar_url, dob, is_minor | 1:1 auth.users | Owner; tutor public fields |
| `user_roles` | Role | user_id, role (student/parent/tutor/org_admin/org_member/admin) | → profiles | Self-insert tylko `student` |
| `parent_links` **(NEW)** | Rodzic–dziecko + zgoda | parent_id, student_id, relation, consent_signed_at, consent_doc_url | → profiles ×2 | Rodzic + dziecko + admin |
| `organizations` **(NEW, Phase 5)** | Szkoła/centrum | id, name, type, billing_email, country | — | Members |
| `org_members` **(NEW, Phase 5)** | Członkostwo | org_id, user_id, role_in_org | → orgs, profiles | Same-org |
| `subjects` | Przedmioty | id, code, name_pl, name_en, level | — | Public read |
| `knowledge_components` **(NEW)** | KCs curriculum | id, subject_id, code, name_pl, name_en, parent_kc_id, grade_level | → subjects | Public read; admin write |
| `kc_prerequisites` **(NEW)** | DAG | from_kc, to_kc, strength | → KCs | Public read |
| `tutor_profiles` | Public tutor | user_id, headline, bio, hourly_rate, languages, rating, sessions_completed, is_verified | → profiles | Public read; owner write |
| `tutor_subjects` | Co uczy | tutor_id, subject_id, level, years_experience | → tutors, subjects | Public read |
| `tutor_payment_methods` | BLIK/IBAN | tutor_id, kind, details (jsonb) | → tutors | Owner-only; **fix obecnego findingu (nie eksponować studentom)** |
| `availability_slots` | Dostępność | tutor_id, weekday, start_time, end_time, valid_from, valid_to | → tutors | Public read; owner write |
| `bookings` | Bookingi | id, student_id, tutor_id, subject_id, kc_focus[], starts_at, duration_min, status, recommended_by_ai, external_meeting_url | → users, subjects | Participants |
| `sessions` | Lekcja | id, booking_id, started_at, ended_at, lesson_notes_url | → bookings | Participants |
| `session_chat` *(istnieje, MVP: tylko 1:1 tutor↔student/parent, RLS ostre)* | Wiadomości | id, session_id, user_id, role, content | → sessions | Participants only (fix realtime RLS) |
| `session_transcripts` *(istnieje, nieaktywne w MVP)* | STT | — | — | Participants only |
| `session_emotions` *(istnieje, nieaktywne w MVP)* | Emotion samples | — | — | Participants only |
| `session_reports` | AI summary | id, session_id, **created_by (NEW)**, summary, kcs_covered[], misconceptions[], homework_suggested | → sessions | Insert by participant; update by created_by; read by participants + parent (fix findingu) |
| `lesson_outcomes` **(NEW)** | Strukturalne Δ-mastery | session_id, kc_id, delta_mastery, evidence (jsonb) | → KCs, sessions | Read przez student/parent/tutor sesji |
| `diagnostic_tests` **(NEW)** | Instancja diagnozy | id, student_id, subject_id, status, started_at, completed_at, score | → students | Owner+parent |
| `diagnostic_items` **(NEW)** | Item bank | id, subject_id, kc_id, type, prompt, choices, correct, difficulty (b), discrimination (a), language, approved_by_admin | → KCs | Public read approved; admin write |
| `diagnostic_responses` **(NEW)** | Odpowiedzi | test_id, item_id, response, correct, time_ms, ai_grade_rationale | → tests, items | Owner+parent |
| `student_kc_mastery` **(NEW)** | SKG payload | student_id, kc_id, mastery_prob, last_updated, sources (jsonb) | → KCs | Owner+parent+assigned tutor |
| `learning_goals` **(NEW)** | Cele | student_id, title, target_date, target_kcs[], created_by | → students | Owner+parent+tutor |
| `learning_paths` **(NEW)** | Plan | id, student_id, goal_id, status, generated_at, model_version | → goals | Owner+parent+tutor |
| `learning_path_items` **(NEW)** | Kroki | path_id, order, kind, kc_focus[], estimated_min, status | → paths | Same as path |
| `homework` **(NEW)** | Przydziały | id, student_id, session_id, due_at, items (jsonb), generated_by_ai | → students, sessions | Owner+parent+tutor |
| `homework_submissions` **(NEW)** | Odpowiedzi | homework_id, submitted_at, answers (jsonb), ai_score, ai_feedback | → homework | Owner+parent+tutor |
| `ai_reports` **(NEW)** | Raporty cykliczne | id, student_id, audience (parent/student/tutor), period_start, period_end, content (jsonb), pdf_url | → students | Per-audience RLS |
| `ai_recommendations` **(NEW)** | Next-best-action | id, student_id, kind, payload, rationale, evidence_refs, created_at, acted_on | → students | Owner+parent+tutor |
| `progress_metrics` **(NEW)** | KPI snapshoty | student_id, ts, avg_mastery, kcs_mastered | → students | Owner+parent |
| `flashcards` *(Should-have, post-MVP)* | SM-2 | user_id, kc_id, front, back, ease, interval, due_at | → KCs | Owner |
| `knowledge_chunks` *(Phase 3, RAG)* | RAG store | user_id, content, embedding | — | Owner |
| `payments` | Płatności | id, booking_id, student_id, tutor_id, amount, status, marked_paid_at, confirmed_at, proof_url, disputed_at | → bookings | Field-level CHECK (student nie może ustawić status='confirmed' — fix findingu) |
| `reviews` **(NEW)** | Recenzje | booking_id (uniq), student_id, tutor_id, rating, comment | → bookings | Owner write; tutor public read |
| `notifications` **(NEW)** | In-app | user_id, kind, payload, read_at | → users | Owner-only |
| `audit_logs` **(NEW)** | Wrażliwe akcje | actor_id, action, target_table, target_id, payload, at | — | Admin-only |

**Cross-cutting RLS:**
- Wszystkie tabele `enable row level security`.
- Role przez `has_role(auth.uid(), 'X')` SECURITY DEFINER.
- Helpers: `is_parent_of(auth.uid(), student_id)`, `has_active_booking(tutor, student)`, `is_session_participant(session_id, auth.uid())`.
- Realtime RLS na `session_chat`, `notifications` (fix findingu).

---

## 9. AI System Design (MVP-set + Phase 3)

Wszystkie agenty: Edge Function → Lovable AI Gateway. Model default: `gemini-2.5-flash`; eskalacja do `gpt-5` lub `gemini-2.5-pro` dla raportów rodzica i grading otwartych itemów.

**MVP agents:**

**9.1 Diagnostic Agent (ADE)**
- *In:* `{student_id, subject_id, response_history}`
- *Out:* next item + posterior KC.
- *Safety:* generowane itemy → `diagnostic_items.approved_by_admin=false`; w MVP tylko admin-approved itemy są używane do scoringu (LLM-gen początkowo to tylko propozycje do bank-fill).

**9.2 Learning Path Planner**
- *In:* `{student_id, current_skg, goals, time_budget}`
- *Out:* `learning_path_items[]` z rationale.
- *Safety:* validator odrzuca plany pomijające prereq KCs.

**9.3 Lesson Summary Assistant** *(MVP — bez transkryptu)*
- *In:* tutor's checklist (omówione KCs), notatki tekstowe tutora, homework_suggested.
- *Out:* draft `session_reports` + propozycja `lesson_outcomes[]` (delta_mastery per KC).
- *Safety:* **tutor ZATWIERDZA przed commitem do SKG**. Brak tutora-w-pętli → brak update SKG.

**9.4 Homework Generator**
- *In:* `{student_id, kcs[], target_count, difficulty_target}`
- *Out:* itemy zamknięte (MVP) z rozwiązaniami.
- *Safety:* drugi LLM-call jako verifier rozwiązania; reject on disagreement. Log do `audit_logs`.

**9.5 Parent Report Generator**
- *In:* tygodniowe dane dziecka (lekcje, notatki, homework, mastery delta).
- *Out:* PDF + dashboard JSON.
- *Safety:* **żadnych claimów medycznych/psychologicznych** (banned-phrases: ADHD, depresja, dysleksja jako diagnoza); zawsze stopka "Wygenerowano przez AI na podstawie X sesji". Spokojny ton, bez alarmizmu.

**Phase 3 agents (NIE w MVP):**
- Lesson Intelligence (transkrypt → outcome).
- Tutor Co-pilot in-session.
- Admin QC agent (analiza nagrań).
- RAG "Drugi Mózg" dla studenta.

**Cross-cutting AI safety:**
- "If unsure, return `{uncertain: true}`."
- JSON-schema validation przed DB write.
- Wszystko z udziałem małoletnich → `audit_logs`.
- Banned-topic filter (NSFW, self-harm, diagnozy medyczne).
- Rate limits per user na edge.
- Model + prompt version na każdym AI artefakcie (wymóg grantowy).

---

## 10. UI/UX Structure (kluczowe ekrany)

| Ekran | Cel | Komponenty | Dane | Primary CTA | Empty | Mobile |
|---|---|---|---|---|---|---|
| **Landing** | Konwersja rodziców | Hero, "Jak to działa" 3 kroki, **realistyczna obietnica** (raport po 4 lekcjach), FAQ | Marketing | "Zrób darmową diagnozę" | n/a | Single col, sticky CTA |
| **Pricing** | Wartość | Tier cards, FAQ | Static | "Zacznij teraz" | n/a | Stacked |
| **Login/Register** | Wejście | Email + Google, role pre-select | Auth | Continue | n/a | Full-screen |
| **Role selection** | Ścieżka | 4 karty | — | Choose | n/a | Stacked |
| **Student dashboard** | "Co teraz?" | Następna lekcja, dzisiejsze homework, SKG mini-heatmap | Bookings, SKG | Resume / Book | "Zacznij od diagnozy" | Vert + bottom tabs |
| **Parent dashboard** | Trust + ROI (mierzony postępem) | Karty per dziecko, trend tygodniowy, ostatni raport, billing | Reports, payments | "Zobacz raport" | "Dodaj dziecko" | Tabs per child |
| **Tutor dashboard** | Dzień | Dzisiejsze lekcje, oczekujące notatki, earnings | Bookings | "Wejdź do lekcji" (link external) | "Ustaw dostępność" | Day list |
| **Admin dashboard** | Operacje | Verification queue, dispute queue, AI flags | Admin tables | "Zweryfikuj" | n/a | Desktop-first |
| **Diagnostic test** | Skupienie | Question card, progress bar | Items | "Dalej" | n/a | Full-screen |
| **Booking calendar** | 3 tapnięcia | Lista tutorów (matched), week view, AI-suggested slot | Availability, matching | "Zarezerwuj" | "Brak slotów" | Week→day |
| **Lesson detail page (MVP)** | Pre + post | Topic, KC focus, **link do wideo (Meet/Zoom)**, materiały, post-lesson notes form (tutor) lub summary (uczeń/rodzic) | Booking, report | "Dołącz do wideo" / "Wypełnij notatki" | — | Card layout |
| **Homework page** | Bez tarcia | Item list, autosave | Homework | "Wyślij" | "Brak zadań" | Single item per screen |
| **Progress analytics** | Dowód uczenia | Mastery heatmap, KC graph (later), trend | SKG, metrics | "Co dalej?" | "Zrób diagnozę" | Scrollable |
| **AI report page** | Evidence + czytelność | Summary, osiągnięcia, obszary do pracy, evidence refs (klikalne), download PDF | ai_reports | "Pobierz PDF" | "Pierwszy raport po 1. sesji" | Vertical |
| **Tutor profile (public)** | Konwersja | Photo, headline, przedmioty, rating, dostępność | tutor_profiles | "Zarezerwuj" | — | Hero + sticky CTA |

Mobile-first: student/parent. Desktop-first: tutor (notatki) i admin. Skeletons + clear empty states.

---

## 11. Design Direction

Vibe: Linear × Superhuman × Khan × Duolingo Max. Anti-vibe: chalkboard, sowy, comic sans.

- **Colors (HSL semantic):** primary `240 60% 30%` (deep indigo), accent `165 70% 42%` (intelligent teal), bg `220 25% 98%` light / `224 30% 8%` dark, surface `0 0% 100%` / `224 28% 12%`. Success/warn/danger w spokojnych tonach.
- **Typography:** Inter UI, KaTeX dla matematyki, JetBrains Mono dla liczb w dashboardach.
- **Components:** shadcn base, radius `0.75rem`, shadows `soft/elegant/glow` (glow tylko AI surfaces).
- **Dashboards:** gęste ale oddychające; duże liczby, małe etykiety uppercase tracking-wide; jeden accent color w wykresach, nie tęcza.
- **Landing:** spokojny hero, 1 testimonial above the fold, **realistyczne obietnice** (raport, nie zwrot pieniędzy), screenshots zamiast stocku.
- **Micro-interactions:** 150–250ms ease-out, bez bounce.
- **Tone PL:** spokojny, kompetentny, konkretny. Nigdy nie ocenia. Cytuje dane.
- **Logo:** wordmark "TutorOS" + mała kropka AI nad O (sugestia node'a w grafie).

---

## 12. Roadmap (zaktualizowana — Lesson Intelligence przesunięta do Phase 3)

| Faza | Cel | Features | Deliverables | Success | Risks |
|---|---|---|---|---|---|
| **0 — Spec** (1–2 tyg) | Lock scope | Ten dokument + KC ontology math 7–9 | Approved doc, ~80 KCs | Sign-off | Scope creep |
| **1 — Clickable prototype** (1 tyg) | Walidacja UX | Wszystkie kluczowe ekrany jako mock | Lovable preview | 5 wywiadów pozytywnych | Visual ≠ feasible |
| **2 — MVP** (8–10 tyg) | Pierwsi pilotażowi | Auth, role, parent-link, weryfikacja tutora, ADE v1, SKG v1, matching v1, booking, **lekki pokój lekcji (link external + checklist + notes form)**, lesson summary assistant (z notatek), parent report, homework v1, dashboardy, admin, PL/EN, fix wszystkich security findings | Live app, 5 pilot rodzin | 80% lekcji ukończonych, NPS≥40, **raport rodzica generuje się automatycznie** | Jakość AI, podaż tutorów |
| **3 — Lesson Intelligence Layer** (4–6 tyg) | Defensibility | LiveKit wbudowany, transkrypcja PL, emotion engine, AI co-pilot tutor-only, NLP → lesson_outcome, RAG "Drugi Mózg", flashcards SM-2 | Updated app + internal eval | Predicted vs actual mastery R²>0.4 | Data sparsity, koszty AI |
| **4 — Paid pilots & scale** (6–8 tyg) | Monetyzacja | Stripe Connect, notyfikacje, reviews → mastery-Δ, mobile PWA, więcej przedmiotów | 30 płacących rodzin, 10 tutorów | MRR €3k, M2 retention ≥60% | Płatności friction |
| **5 — B2B / Schools** (8–12 tyg) | Enterprise | Org dashboards, SSO, LMS integracje, white-label | 2 piloty szkolne | 1 podpisana szkoła | Cykl sprzedaży |
| **6 — Grant + scale** (równolegle) | Finansowanie | Pełna dokumentacja R&D, IP filings, FENG SMART aplikacja | Aplikacja złożona | Wstępna pozytywna ocena | Kompletność dokumentów |

---

## 13. Technical Implementation Plan (Lovable-compatible, sequential)

> Bazuje na obecnym kodzie (Mądrzej). Każdy krok = jeden Lovable prompt, mały i bezpieczny.

1. **Foundation refactor.** Rebrand Mądrzej → TutorOS AI w copy/meta/i18n/footer. Bez DB. Dodanie KC ontology math 7–9 jako JSON w `src/data/kc-math-7-9.json`.
2. **Design system upgrade.** Nowe tokeny (deep indigo + intelligent teal, Inter, 0.75rem). Audit hardcoded kolorów. Nowe primitives: `<Surface>`, `<Stat>`, `<MasteryBadge>`, `<EvidenceRef>`.
3. **Security findings sweep (one migration + edge fixes).** Realtime RLS na `session_chat`/`session_transcripts`; `payments` WITH CHECK (student nie ustawi `confirmed`); `session_reports.created_by` + owner-only update; `user_roles` self-insert ograniczony do `student`; `tutor_payment_methods` scoped do active booking PM only; auth gate w `ai-copilot` (mimo że agent w MVP nieaktywny — i tak); generic 500 error sanitization we wszystkich edge functions.
4. **Roles + parent-child link.** Migracja: rozszerz `user_roles` enum (`parent`, `org_admin`, `org_member`), dodaj `parent_links` + `is_parent_of()`. Auth flow z wyborem roli przy signup. Parent invite → tworzy konto dziecka lub zaprasza emailem.
5. **Role-aware dashboards skeleton.** `/dashboard/student`, `/dashboard/parent`, `/dashboard/tutor` + redirect z `/dashboard` wg roli. Empty states + skeletons z nowymi tokenami.
6. **KC ontology + SKG schema.** Migracje: `subjects`, `knowledge_components`, `kc_prerequisites`, `student_kc_mastery`, `learning_goals`, `learning_paths`, `learning_path_items`. Seed math 7–9. RLS dla wszystkich.
7. **Tutor verification queue.** `/admin/verifications`, `is_verified` toggle gated by admin. Email do tutora po decyzji.
8. **Diagnostic flow.** Migracje: `diagnostic_tests`, `diagnostic_items`, `diagnostic_responses`. Edge: `ade-next-item`, `ade-grade`. UI: `/diagnose/:subject_id` (full-screen, jeden item naraz). Po zakończeniu → SKG init.
9. **Matching v1.** Edge `match-tutors` (rule-based scoring). UI: `/book` z listą rankingowaną + AI rationale ("Dlaczego ten tutor?"). Integracja z istniejącym booking flow.
10. **Lekki pokój lekcji + post-lesson form.** Migracja: `bookings.external_meeting_url`. UI: `/lesson/:id` z linkiem do wideo (tutor wkleja Meet/Zoom URL przy potwierdzeniu bookingu) + checklist KCs z planu + formularz post-lekcyjny dla tutora. Edge `lesson-summary-assistant` (z notatek, **nie z transkryptu**) → tutor zatwierdza → `lesson_outcomes` + SKG update.
11. **Homework v1.** Migracje: `homework`, `homework_submissions`. Edge `homework-gen` (zamknięte itemy + verifier) + `homework-grade`. UI: `/homework`, `/homework/:id`.
12. **Parent report v1.** Migracja: `ai_reports` + bucket `reports` (private). Edge `parent-report-cron` (tygodniowy) — generuje PDF z deno + pdf-lib z danych strukturalnych (lekcje, notatki, homework, Δ-mastery). UI: `/reports/:id` + download. Notification on ready.
13. **Admin panel + audit logs + polish/QA.** Migracja `audit_logs`, `notifications`, `reviews`. UI admin: verifications + disputes + AI flags + audit viewer. Lighthouse, PL/EN audit, mobile sweep.

**Phase 3 (po MVP, osobna kolejka):**
14. LiveKit wbudowany (już prototyp istnieje — ulepszyć stabilność, nie rozszerzać).
15. ElevenLabs Scribe transkrypcja realtime → `session_transcripts`.
16. Emotion engine włączony per-tutor opt-in → `session_emotions`.
17. NLP `lesson-summary-from-transcript` → enhanced `lesson_outcomes`.
18. RAG `embed-knowledge` + brain-chat z evidence refs.
19. Tutor co-pilot in-session.

---

## 14. Risk Analysis

| Ryzyko | Prawd. | Wpływ | Mitygacja |
|---|---|---|---|
| RODO / małoletni | Wys. | Krytyczny | Parent consent flow, signed doc storage, data minimization, retention policy, DPA template, hosting EU, DPO w stopce |
| AI hallucinations w nauce | Wys. | Wys. | **Tutor-in-the-loop na każdym SKG update**, second-LLM verifier dla homework, banned-topics filter, evidence chain, model+prompt versioning |
| **Marketing claim "outcome guarantee"** | — (usunięte z MVP) | — | **Zastąpione obietnicą raportu**: "Po 4 lekcjach mierzalny raport postępów i rekomendacja dalszej ścieżki." Bez gwarancji zwrotu w MVP. |
| **Niesprawdzone statystyki w copy/grant** | Wys. | Średni-Wys. | **Żadnych konkretnych liczb bez źródła.** "Duża część wydatków trudna do oceny pod kątem efektów" zamiast "70%". Każde twierdzenie liczbowe wymaga cytatu (CBOS, GUS, OECD, raport branżowy). |
| Słaby innovation claim do grantu | Średni | Wys. | Dokumentowanie algorytmów od dnia 0, IP na matching, WP-aligned R&D plan, doradca akademicki |
| Brak B+R dokumentacji | Wys. | Wys. | `audit_logs` obowiązkowo, model version na każdym artefakcie, hipotezo-driven changelog, miesięczny R&D log |
| Marketplace liquidity | Wys. | Wys. | Hand-recruit 10 tutorów przed launchem, concierge matching pierwszych 50 uczniów |
| Tutor quality variance | Średni | Wys. | Weryfikacja, demo lesson, monitorowane pierwsze 3 lekcje, off-boarding po niskiej Δ |
| Spory płatnicze (P2P MVP) | Średni | Średni | 24h tutor-confirm, 7d auto-dispute, evidence upload, escrow przez Stripe w Phase 4 |
| Koszty AI / LiveKit (Phase 3+) | Średni | Średni | Per-user rate limits, cache embeddings, Flash domyślnie, monthly cost dashboard, alert 70% budżetu |
| Skalowalność DB | Niski (MVP) | Średni | Indeksy hot paths, materialized views, monitoring w Cloud → Advanced |
| Vendor lock-in (Lovable Cloud) | Niski | Średni | Standard Postgres, exportable schema, Deno edge (portable) |
| Korepetycje jako regulowana działalność w PL | Niski | Średni | Pozycja jako platforma, tutorzy jako kontraktorzy (B2B/UoD), konsultacja prawnika przed launchem |
| Brand / naming conflict | Niski | Niski | Trademark search "TutorOS" PL+EU przed publicznym launchem |
| **Próba budowy live-AI w MVP** | — (zaadresowane) | — | **Lesson Intelligence przesunięte do Phase 3.** MVP używa lekkiego pokoju (link external + checklist + notes). Stabilizujemy fundament zanim dokładamy LiveKit/STT/emotion. |

---

## 15. What NOT To Build Yet

- **LiveKit, transkrypcja, emotion engine, AI co-pilot in-session** — wszystko Phase 3.
- Stripe Connect / escrow / fakturowanie automatyczne — Phase 4.
- Aplikacje mobilne natywne — PWA później.
- Więcej niż jeden przedmiot w MVP (matematyka 7–9 only — głębia > szerokość).
- Lekcje grupowe / kręgi (są w obecnym kodzie — ukryć/wyłączyć w MVP).
- Marketplace tutorów do auto-rekrutacji — hand-recruit.
- Auto-generowane itemy diagnostyczne w produkcyjnym scoringu (tylko admin-approved).
- Causal attribution model — Phase 5+.
- Full LMS integracje, white-label, gamification (XP/badges/streaks), email marketing automation.
- Publiczne recenzje z komentarzami zanim baza tutorów dojrzeje.
- **Outcome guarantee / zwrot pieniędzy** — zbyt ryzykowne prawnie i operacyjnie w MVP. Po Phase 4 z twardymi danymi można rozważyć wąsko zdefiniowany wariant ("brak postępu w X mierzonym Y" → kredyt na konto, nie zwrot).

---

## 16. Final Output

### Recommended MVP feature list (locked)
1. Auth + 4 role + parent–child consent.
2. Tutor onboarding + ręczna weryfikacja.
3. Math 7–9 KC ontology + adaptacyjna diagnoza (15 itemów) → SKG.
4. Rule-based matching z AI rationale.
5. Booking + kalendarz + P2P payment + 7d auto-dispute.
6. **Lekki pokój lekcji** (link wideo external + checklist KCs + post-lesson notes form).
7. Lesson summary assistant (z notatek, **bez transkryptu**) → tutor zatwierdza → SKG update.
8. Tygodniowy AI parent report (PDF + dashboard, na bazie strukturalnych danych).
9. Homework generator v1 (zamknięte) + auto-grade.
10. Dashboardy student/parent/tutor/admin.
11. PL/EN i18n.
12. Wszystkie obecne security findings rozwiązane.

### Recommended first database schema (kolejność migracji)
1. Rozszerz `user_roles` enum, dodaj `parent_links`, helpers `is_parent_of()`, `is_session_participant()`.
2. **Security sweep migration** (RLS realtime + payments WITH CHECK + session_reports.created_by + user_roles self-insert restrict + tutor_payment_methods scope).
3. `subjects`, `knowledge_components`, `kc_prerequisites` + math 7–9 seed.
4. `student_kc_mastery`, `learning_goals`, `learning_paths`, `learning_path_items`.
5. `diagnostic_tests`, `diagnostic_items`, `diagnostic_responses`.
6. `lesson_outcomes`, `bookings.external_meeting_url`.
7. `homework`, `homework_submissions`.
8. `ai_reports`, `ai_recommendations`, `progress_metrics`.
9. `reviews`, `notifications`, `audit_logs`.
10. Storage buckets z owner-scoped policies (no broad listing): `avatars` (public scoped), `payment-proofs` (private), `homework` (private), `reports` (private), `consent-docs` (private).

### Recommended first 10 Lovable build prompts
1. "Rebrand Mądrzej → TutorOS AI: i18n, hero, meta, favicon, footer. Bez DB."
2. "Apply new design tokens (deep indigo `240 60% 30%` + intelligent teal `165 70% 42%`, Inter, radius 0.75rem). Audit i zamień hardcoded kolory na semantyczne."
3. "Resolve all current security findings in one migration + edge updates: realtime RLS na session_chat/session_transcripts; payments WITH CHECK preventing student self-confirmation; session_reports.created_by + owner-only update; restrict user_roles self-insert do 'student'; scope tutor_payment_methods read do active booking PM only; auth check w ai-copilot; sanitize 500 errors."
4. "Add `parent` and `org_admin` roles to user_roles enum, create `parent_links` table z consent fields, build parent invite flow."
5. "Seed `subjects` + `knowledge_components` dla matematyki 7–9 (z dostarczonego JSON), add `kc_prerequisites` (DAG), add `student_kc_mastery` z RLS dla student/parent/assigned tutor."
6. "Build /dashboard/student, /dashboard/parent, /dashboard/tutor z role-aware redirect z /dashboard. Empty states z single clear CTA. Nowe design tokens."
7. "Build adaptive diagnostic flow at /diagnose/:subject_id: edge `ade-next-item` picks/generates next item, `ade-grade` scores responses (LLM dla open), updates student_kc_mastery. UI: full-screen single question, progress bar."
8. "Build matching v1: edge `match-tutors` ranks tutors by subject coverage, KC-overlap z student goals, dostępność, rating. Show ranked list z AI rationale na /book."
9. "Build lekki pokój lekcji: dodaj `bookings.external_meeting_url`, /lesson/:id pokazuje link do wideo + checklist KCs + post-lesson notes form. Edge `lesson-summary-assistant` z checklist+notes (BEZ transkryptu) generuje draft session_report; tutor zatwierdza przed SKG update."
10. "Build weekly parent-report cron edge: generuje PDF (deno + pdf-lib) per dziecko z danych strukturalnych (lekcje, notatki, homework, Δ-mastery), zapisuje w bucket `reports`, tworzy `ai_reports` row, wysyła notyfikację. Page /reports/:id z download."

### Recommended landing page copy (PL) — zaktualizowane
- **H1:** *Korepetycje, które wiedzą, czego nie wie Twoje dziecko.*
- **Sub:** *TutorOS AI diagnozuje luki w wiedzy, dobiera korepetytora i adaptuje plan nauki po każdej lekcji. Oparte na danych. Bez zgadywania.*
- **CTA:** *Zrób darmową diagnozę (15 minut)*
- **Trzy filary:** *Diagnoza AI · Dopasowany tutor · Mierzalny postęp*
- **Realistyczna obietnica (zamiast outcome guarantee):** *Po 4 lekcjach otrzymujesz mierzalny raport postępów i rekomendację dalszej ścieżki nauki.*

### Recommended investor/grant one-liner
*"TutorOS AI to platforma adaptacyjnej inteligencji edukacyjnej, która łączy psychometryczną diagnozę, graf wiedzy ucznia i wieloagentowe AI z pracą żywego korepetytora — by dostarczać udokumentowane wyniki nauczania zamiast sprzedawać godziny."*

---

**Podsumowanie korekt vs v1:**
1. ✅ Usunięta niepotwierdzona statystyka 70% — zastąpiona ostrożnym sformułowaniem.
2. ✅ Outcome guarantee usunięta z MVP — zastąpiona obietnicą raportu po 4 lekcjach. Wpis o ryzyku dodany do §14 i §15.
3. ✅ LiveKit, transkrypcja, emotion engine, AI co-pilot in-session — przesunięte z MVP do **Phase 3 (Lesson Intelligence Layer)**. MVP używa lekkiego pokoju lekcji: link do external wideo + checklist KCs + formularz post-lekcyjny. Lesson summary assistant pracuje na notatkach tutora, nie na transkrypcie.

**Następny krok (po akceptacji):** przejście w build mode i wykonanie kroków 1–3 z §13 (rebrand + design tokens + security sweep) jako pierwszej fali. Potwierdź lub zmień kolejność.
