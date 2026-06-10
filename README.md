<!-- README_PRESENTATION_START -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&height=140&color=0:312E81,100:06B6D4&text=Kognio%20App&fontColor=FFFFFF&fontSize=30&fontAlignY=42&desc=AI%20learning%20platform%20prototype%20with%20role-based%20product%20workflows&descAlignY=68&descSize=15" alt="Kognio App banner" />
</p>

<p align="center">
  <img alt="TypeScript: React" src="https://img.shields.io/badge/TypeScript-React-3178C6?style=for-the-badge" /> <img alt="Product: AI Learning" src="https://img.shields.io/badge/Product-AI%20Learning-7C3AED?style=for-the-badge" /> <img alt="Access: RBAC" src="https://img.shields.io/badge/Access-RBAC-0F766E?style=for-the-badge" /> <img alt="Backend: Supabase" src="https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge" /> <img alt="Testing: Vitest" src="https://img.shields.io/badge/Testing-Vitest-6E9F18?style=for-the-badge" />
</p>

<table>
  <tr><td><strong>Role signal</strong></td><td>AI product QA, multi-role workflow testing, TypeScript frontend</td></tr>
<tr><td><strong>What to inspect</strong></td><td><code>App.tsx</code> routes, role guards, lesson copilot, data model docs</td></tr>
<tr><td><strong>Best for</strong></td><td>AI Assistant QA, product QA, frontend-heavy QA roles</td></tr>
</table>

<!-- README_PRESENTATION_END -->

# Kognio App

AI-assisted learning platform prototype with role-based dashboards, tutoring workflows, live-session surfaces, knowledge modelling, expert review, and operational/admin tooling.

Kognio is a TypeScript/React product prototype that explores how an AI-enabled education platform could support students, parents, tutors, schools, companies, and administrators. It is broader than a landing page: the codebase contains protected routes, role gates, dashboards, session components, curriculum and competency modelling, notifications, homework, booking, expert review, and operational admin surfaces.

## What This Project Demonstrates

- TypeScript React application architecture;
- role-based routing and access control;
- protected routes and feature guards;
- multi-role dashboard design;
- AI learning assistant UI patterns;
- lesson copilot and student-assistant panels;
- knowledge graph / competency thinking;
- live lesson room components;
- booking and tutor marketplace flows;
- parent-child learning journey views;
- expert review workflow;
- admin and operations surfaces;
- data model documentation;
- Supabase-oriented app structure;
- Vite, Tailwind, shadcn/ui, and Vitest setup.

## Product Concept

Kognio models an education platform where different users need different views of the same learning system:

- students need learning plans, checkpoints, homework, flashcards, lesson support, and progress;
- parents need visibility into child progress, diagnostics, knowledge gaps, and next actions;
- tutors need onboarding, availability, public profiles, live-session surfaces, and review workflows;
- schools and companies need cohort and organization views;
- admins need marketplace, curriculum, launch checklist, research, operations, and test-user management.

The platform is designed around a larger idea: AI should help make learning progress visible, explainable, and actionable.

## Technology Stack

| Area | Tools |
|---|---|
| Language | TypeScript |
| UI | React, Vite |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Routing | React Router |
| Data/client state | TanStack Query |
| Backend platform | Supabase-oriented structure |
| Live session surface | LiveKit packages |
| Validation/forms | React Hook Form, Zod |
| Testing | Vitest |
| Internationalization | i18next |
| AI/UX helpers | knowledge graph, AI insight components, lesson copilot surfaces |

## Repository Structure

```text
docs/
  DATA_MODEL_SOT.md

src/
  App.tsx
  contexts/
    AuthContext
    ActiveRoleContext

  components/
    auth/
      ProtectedRoute
      RoleGate
      FeatureRouteGuard

    lesson/
      LessonCopilotPanel
      StudentAssistantPanel
      LessonSummaryPanel
      LessonTranscriptionPanel

    session/
      LiveKitVideo
      LiveTranscriber
      SharedWhiteboard
      EmotionEngine

    brain/
      KnowledgeGraph

    expert-review/
      ExpertReviewAdminPanel
      ExpertReviewBadge

    admin/
    booking/
    homework/
    notifications/
    org/
    parent/
    pilot/
    ui/

  pages/
    dashboards for student, parent, tutor, admin, school, company
    lesson, booking, homework, flashcards, organization, and admin flows
```

## Architecture Notes

### Role-based route structure

`App.tsx` defines a rich route map with protected routes, parent guards, feature guards, and role gates. This is important because the product is not a single-user toy app; it models a multi-actor platform.

### Learning journey surfaces

The app includes learning plans, checkpoints, diagnostics, homework, flashcards, and child knowledge views. These model the operational flow around learning progress rather than only content delivery.

### AI assistant surfaces

Components such as `LessonCopilotPanel`, `StudentAssistantPanel`, AI insight cards, and knowledge graph views show how AI assistance could be embedded into the learning workflow.

### Live-session readiness

The presence of LiveKit-related components, shared whiteboard, live transcription, and emotion/engagement surfaces shows thinking about synchronous learning sessions.

### Operational/admin layer

Admin pages cover curriculum, marketplace, organizations, launch checklist, research dashboard, operations console, expert reviews, and test users. This gives the prototype a product-operations angle.

## Running Locally

Requirements:

- Node.js;
- npm or Bun;
- local environment variables for any Supabase-backed flows.

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Lint:

```bash
npm run lint
```

## Environment Notes

The app is structured for Supabase-backed functionality. Real environment values should live only in local environment files or deployment secrets, not in committed production secrets.

Typical Vite/Supabase variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

## What To Review First

1. `src/App.tsx` for the route and role model.
2. `docs/DATA_MODEL_SOT.md` for the data-model source-of-truth notes.
3. `src/components/lesson/LessonCopilotPanel.tsx` for AI learning assistant UX.
4. `src/components/session/` for live lesson surfaces.
5. `src/components/brain/KnowledgeGraph.tsx` for knowledge modelling.
6. `src/components/expert-review/` for review workflow.

## Recruiter Signal

This project is relevant for roles involving:

- TypeScript frontend engineering;
- AI product QA;
- AI Assistant feature testing;
- multi-role workflow testing;
- complex routing and authorization scenarios;
- education technology;
- product-minded QA / SDET work.

From a QA perspective, it creates many natural test surfaces: role-based access, feature flags, booking flows, live sessions, notifications, homework, expert review, admin operations, and AI-assisted lesson support.
