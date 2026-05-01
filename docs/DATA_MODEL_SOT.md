# Kogni — Data Model: Source of Truth (audit snapshot, 2026-05-01)

This document records which tables are the **current** source of truth and
which are kept for **backward compatibility**. Do not delete legacy tables.

## Curriculum & competencies

- **Current (universal graph):**
  - `education_systems` → `education_levels`
  - `learning_domains`
  - `competencies` (+ `competency_prerequisites`, `competency_source_mappings`)
  - `curriculum_sources`
- **Legacy (Math 7–9 controlled bank, kept for backward compatibility):**
  - `knowledge_components` (+ `kc_prerequisites`)
  - Linked to the universal graph via `knowledge_components.competency_id`.

## Diagnostics

- **Current (primary path):** AI adaptive diagnosis via the
  `diagnostic-adaptive` edge function.
  - Writes `diagnostic_attempts` with full taxonomy
    (`education_system_id`, `education_level_id`, `learning_domain_id`,
    `taxonomy_payload`, `algorithm_version`, `prompt_version`).
  - Generates `diagnostic_items` on-the-fly, attached to the attempt
    (`diagnostic_items.attempt_id`).
  - Stores answers in `diagnostic_responses`.
- **Legacy:** the controlled `diagnostic_items` bank
  (`is_active = true AND approved_by_admin = true AND attempt_id IS NULL`).
  Read-only fallback. Not the primary surface.

## Mastery

- **Self-user (current):** `user_competency_mastery`
  (owner-scoped RLS, `user_id = auth.uid()`).
- **Parent–child (current):** `child_kc_mastery`
  (RLS via `is_parent_of_child(auth.uid(), child_id)`).
  Despite the name, this table now stores **competency-level mastery**
  for children and includes `competency_id`, `learning_domain_id`,
  `education_level_id`, `skill_area_label`, `algorithm_version`,
  `confidence_reason`. The historical KC linkage (`kc_id`) is retained
  for backward compatibility.

## Plans, checkpoints, reviews, evidence

- `learning_plans` + `learning_plan_items` — current plan layer.
- `learning_checkpoints` — baseline ↔ checkpoint comparison.
- `expert_reviews` + `expert_review_items` — human-in-the-loop layer.
- `smart_evidence_events` — append-only audit trail
  (diagnostic, plan, plan-item, checkpoint, expert-review events).

## Access control summary

- All user-owned tables are **owner-scoped** via `auth.uid()` or
  `is_parent_of_child(auth.uid(), child_id)`.
- Admin override via `has_role(auth.uid(), 'admin')`.
- Reviewer-scoped access on `expert_reviews` and `expert_review_items`.
- `audit_logs` — admin-read only.

## What must never happen

- A user reading another user's plan, checkpoint, mastery, or review.
- A parent reading another parent's child data.
- A non-admin opening `/admin/*` routes.
- PII (emails, names, raw `auth.users.id` joins) appearing in the
  SMART evidence export. The export only contains aggregate counts,
  internal record IDs, algorithm versions, and metric values.
