# Rebrand to Kogni + PL / EN / ES i18n audit

Scope: copy, branding, translations, language switcher. **No** changes to diagnostic logic, DB schema, edge functions, payments, sessions, or any feature behavior.

## Current state (audit)

**i18n setup** — `src/i18n/index.ts` registers only `pl` + `en`, fallback `pl`, persistence via `localStorage` (already works). No Spanish file.

**Brand leaks** — visible "TutorOS AI" in:
- `index.html` (title, description, og/twitter tags, author)
- `src/components/layout/AppShell.tsx` (footer)
- `src/i18n/locales/pl.json` + `en.json` (brand.name, hero, pillarsTitle, signupTitle, tutorSubtitle)
- `src/pages/Onboarding.tsx` (toast + welcome heading + tutor verification copy)
- `src/pages/dashboard/ParentDashboard.tsx`, `TutorDashboard.tsx`, `OrgDashboard.tsx`
- `src/pages/OrgInviteAccept.tsx`
- `src/index.css` header comment (cosmetic, will update)
- `supabase/migrations/...sql` comment (historical, leave — not visible)

No occurrences of "Mądrzej" or "Kognio" in code.

**Hardcoded PL strings** (no `t()`) found in: `Diagnose.tsx`, `Onboarding.tsx`, `ParentDashboard.tsx`, `TutorDashboard.tsx`, `OrgDashboard.tsx`, `OrgInviteAccept.tsx`, `parent/ChildKnowledge.tsx`, `parent/ChildDiagnostic.tsx` (partial), `AddChildDialog.tsx` (partial), `EmptyState.tsx`, `ProtectedRoute.tsx`, `AppShell.tsx` footer, `Settings.tsx` toasts. Many `toast.error("…")` strings in Polish across pages.

**Language switcher** — `Header.tsx` toggles only PL↔EN; `Settings.tsx` has a 2-option Select. Both must become PL / EN / ES.

---

## Plan

### 1. i18n infrastructure
- Edit `src/i18n/index.ts`: import `es.json`, add to resources, `supportedLngs: ["pl","en","es"]`. Keep `fallbackLng: "pl"` and existing localStorage persistence.
- Create `src/i18n/locales/es.json` mirroring the full PL/EN structure.

### 2. Translation files — restructure & extend
Reorganize all three locale files (`pl.json`, `en.json`, `es.json`) under these top-level namespaces (preserving existing keys where possible to avoid breaking current `t("…")` calls — only add/rename brand strings):

```
brand, common, errors, status, nav, landing, auth, onboarding,
dashboard, parent, diagnostic, knowledge, path, admin,
discover, circles, peer, brain, calendar, settings
```

- Replace every `TutorOS AI` with `Kogni` in `brand.name`, hero/subtitle/pillars/onboarding/dashboard copy.
- Apply the new landing copy from PART 5 of the brief verbatim (PL/EN/ES) to `landing.heroTitle`, `heroSubtitle`, `ctaPrimary`, `ctaSecondary`, `pillar1/2/3Title`, `landing.safetyNote`.
- Add missing keys for: onboarding (welcome, role selection, tutor-pending notice), parent dashboard (weekly report blurb, add-child, consent), diagnostic flow (domain pick, level pick, question, "I don't know", progress, result, strengths, gaps, recommendations, safety note, generate-path CTA), child knowledge page, admin dashboard stats/labels, EmptyState defaults, ProtectedRoute messages, generic toasts (`errors.generic`, `errors.role`, `errors.tutorProfile`, `status.saved`, `status.tutorBecame`, etc.).
- Spanish copy follows neutral European Spanish, formal warm tone, terminology table from PART 4.

### 3. Language switcher → PL / EN / ES
- `src/components/layout/Header.tsx`: replace toggle button with a small dropdown (Popover or `DropdownMenu` already in ui kit) listing PL / EN / ES; current language shown as flag-letter chip.
- `src/pages/Settings.tsx`: extend the existing Select to three options using `t("settings.languagePl|En|Es")`.

### 4. Brand replacement (non-locale files)

**`index.html`** — update `<title>`, `meta[name=description]`, `meta[name=author]`, all `og:*` and `twitter:*` title/description tags. Use Polish positioning line from the brief as default (server-rendered HTML, single language ok — Polish):
- title: `Kogni — inteligentna platforma nauki`
- description: the PL positioning sentence from PART 1.

**`src/components/layout/AppShell.tsx`** — footer becomes `© {year} Kogni` via `t("common.footer")` (translated PL/EN/ES).

**`src/index.css`** — top comment "TutorOS AI — premium…" → "Kogni — premium…". Cosmetic only.

**No PWA manifest exists** — skip.

### 5. Convert hardcoded text → i18n
For each file below, replace inline PL strings with `t("…")` and add corresponding keys to all three locale files:

- `src/pages/Onboarding.tsx` — welcome heading, role selector copy, tutor-blocked toast & banner, all section labels.
- `src/pages/Diagnose.tsx` — UI labels (keep AI prompts inside the edge function untouched; only translate user-facing UI shell).
- `src/pages/dashboard/ParentDashboard.tsx`, `TutorDashboard.tsx`, `AdminDashboard.tsx`, `StudentDashboard.tsx`, `OrgDashboard.tsx` — replace remaining PL paragraphs/labels including the "TutorOS AI" weekly-report blurb and tutor-verification notes, now reading "Kogni" from `brand.name`.
- `src/pages/parent/ChildKnowledge.tsx`, `ChildDiagnostic.tsx` — finish translating remaining PL labels & toasts.
- `src/pages/OrgInviteAccept.tsx` — invitation copy.
- `src/components/parent/AddChildDialog.tsx` — labels, consent checkbox, validation errors.
- `src/components/EmptyState.tsx` — default title/CTA props use `t()` fallbacks.
- `src/components/auth/ProtectedRoute.tsx` & `RoleGate.tsx` — loading + access-denied messages.
- `src/pages/Settings.tsx` — all `toast.success/error` messages and section headings.

Toasts/errors converted opportunistically; AI prompt strings inside `supabase/functions/**` stay English (internal, not user-visible).

### 6. QA pass (manual, after implementation)
- `rg -n "TutorOS|Mądrzej"` → only the historical SQL migration comment may remain (non-visible).
- Switch language to ES on landing → fully Spanish; same for onboarding, dashboards, diagnostic flow, parent flow, admin.
- Switch PL ↔ EN ↔ ES updates instantly without refresh, persists after reload.
- Diagnostic flow still runs end-to-end (no logic touched).

---

## Files to change

**Edit**
- `src/i18n/index.ts` (add `es`)
- `src/i18n/locales/pl.json`, `en.json` (rebrand + new keys)
- `index.html` (meta + og + title)
- `src/index.css` (comment)
- `src/components/layout/AppShell.tsx` (footer via t)
- `src/components/layout/Header.tsx` (3-language switcher)
- `src/pages/Settings.tsx` (3-language Select + i18n toasts)
- `src/pages/Onboarding.tsx`
- `src/pages/Diagnose.tsx`
- `src/pages/OrgInviteAccept.tsx`
- `src/pages/dashboard/ParentDashboard.tsx`
- `src/pages/dashboard/TutorDashboard.tsx`
- `src/pages/dashboard/StudentDashboard.tsx`
- `src/pages/dashboard/AdminDashboard.tsx`
- `src/pages/dashboard/OrgDashboard.tsx`
- `src/pages/parent/ChildKnowledge.tsx`
- `src/pages/parent/ChildDiagnostic.tsx`
- `src/components/parent/AddChildDialog.tsx`
- `src/components/EmptyState.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/RoleGate.tsx`

**Create**
- `src/i18n/locales/es.json`

**Untouched**: DB schema, all `supabase/functions/**` runtime logic (only consider translating any user-facing string returned by `diagnostic-adaptive` if trivially keyed; otherwise leave), `src/integrations/supabase/*`, business logic, routes.

## Out of scope (explicit)
No new features, no diagnostic logic changes, no DB migrations, no new edge functions, no payments/LiveKit/booking work. Any newly-discovered bugs unrelated to rebrand/i18n will be noted in the changelog, not fixed in this step.

After approval I'll implement, then deliver the changelog + manual QA checklist requested in PART 7.