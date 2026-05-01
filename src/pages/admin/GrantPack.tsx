import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Download, FileJson, FileText, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Lang = "pl" | "en" | "es";

type Metrics = {
  diagnosticAttempts: number;
  diagnosticsWithTaxonomy: number;
  taxonomyCoverageRate: number | null;
  learningPlans: number;
  checkpointsCompleted: number;
  avgScoreDelta: number | null;
  avgMasteryDelta: number | null;
  expertReviewsSubmitted: number;
  avgAgreement: number | null;
  smartEvidenceEvents: number;
  masteryMapped: number;
  masteryUnmapped: number;
  competencyMatchRate: number | null;
  algorithmVersionsCount: number;
  hasPilotData: boolean;
};

type AlgoRow = { version: string; source: string; count: number; latest: string | null };

// ---------- Deterministic localized content templates ----------

const positioning: Record<Lang, string> = {
  pl: "Kogni to uniwersalna platforma adaptacyjnej inteligencji edukacyjnej, która diagnozuje wiedzę użytkownika, mapuje luki do grafu kompetencji, generuje plan nauki, mierzy postęp w checkpointach oraz umożliwia ekspercką walidację rekomendacji AI.",
  en: "Kogni is a universal adaptive learning intelligence platform that diagnoses a user's knowledge, maps gaps to a competency graph, generates a learning plan, measures progress through checkpoints, and enables expert validation of AI recommendations.",
  es: "Kogni es una plataforma universal de inteligencia adaptativa para el aprendizaje que diagnostica el conocimiento del usuario, asigna las lagunas a un grafo de competencias, genera un plan de estudio, mide el progreso mediante checkpoints y permite la validación experta de las recomendaciones de IA.",
};

const problemStatement: Record<Lang, string> = {
  pl: "Tradycyjna nauka oraz korepetycje opierają się na intuicji nauczyciela i ogólnych testach poziomujących. Brakuje narzędzi, które jednoznacznie i powtarzalnie diagnozują luki kompetencyjne ucznia, mapują je do uznanej taksonomii, a następnie mierzą realny postęp. W rezultacie środki publiczne i prywatne są kierowane na materiały, które nie odpowiadają faktycznym deficytom uczących się, a skuteczność trudno udowodnić ewaluatorom programów edukacyjnych.",
  en: "Traditional learning and tutoring rely on the teacher's intuition and generic placement tests. There is a lack of tools that diagnose a learner's competency gaps in a clear, reproducible way, map them to a recognized taxonomy, and then measure real progress. As a result, public and private resources are directed to materials that do not match learners' actual deficits, and effectiveness is hard to prove to educational program evaluators.",
  es: "El aprendizaje tradicional y las clases particulares dependen de la intuición del docente y de tests de nivel genéricos. Faltan herramientas que diagnostiquen las lagunas competenciales del alumno de forma clara y reproducible, las asignen a una taxonomía reconocida y midan el progreso real. Como consecuencia, los recursos públicos y privados se dirigen a materiales que no se ajustan a las carencias reales y la eficacia es difícil de demostrar.",
};

const proposedSolution: Record<Lang, string> = {
  pl: "Kogni łączy uniwersalny graf kompetencji, adaptacyjną diagnostykę AI, plan nauki oparty na luki, pomiar postępu w checkpointach oraz warstwę walidacji eksperckiej. Każdy artefakt (diagnoza, plan, checkpoint, recenzja) jest zapisywany jako zdarzenie SMART Evidence z wersją algorytmu i promptu, co pozwala odtwarzać i niezależnie weryfikować wyniki.",
  en: "Kogni combines a universal competency graph, adaptive AI diagnostics, a gap-driven learning plan, checkpoint-based progress measurement, and an expert validation layer. Every artifact (diagnosis, plan, checkpoint, review) is stored as a SMART Evidence event with algorithm and prompt version, enabling reproducible and independently verifiable outcomes.",
  es: "Kogni combina un grafo universal de competencias, diagnóstico adaptativo con IA, un plan de estudio basado en lagunas, medición de progreso mediante checkpoints y una capa de validación experta. Cada artefacto (diagnóstico, plan, checkpoint, revisión) se registra como un evento SMART Evidence con versión de algoritmo y prompt, lo que permite reproducir y verificar de forma independiente los resultados.",
};

type ComponentRow = { id: string; title: string; what: string; why: string; data: string; output: string; evidence: string };

const innovationComponents: Record<Lang, ComponentRow[]> = {
  pl: [
    { id: "graph", title: "Uniwersalny graf programowy i kompetencyjny", what: "Stała taksonomia: systemy edukacji, poziomy, dziedziny, kompetencje i prerekwizyty.", why: "Pozwala mapować dowolny temat do wspólnej, odtwarzalnej struktury.", data: "education_systems, education_levels, learning_domains, competencies, competency_prerequisites.", output: "Wspólna przestrzeń odniesienia dla diagnoz, planów i checkpointów.", evidence: "Tabele referencyjne + competency_source_mappings." },
    { id: "diag", title: "Silnik diagnostyki AI", what: "Adaptacyjna diagnoza generująca pytania i ocenę umiejętności.", why: "Zastępuje statyczne testy poziomujące.", data: "diagnostic_attempts, diagnostic_items, diagnostic_responses.", output: "Wynik, mapowanie do kompetencji, payload taksonomii.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "trace", title: "Warstwa traceability kompetencji", what: "Każdy wynik AI jest powiązany z konkretną kompetencją lub etykietą skill_area.", why: "Eliminuje hallucynacje i umożliwia audyt.", data: "competency_id, skill_area_label, learning_domain_id.", output: "Stopa zmapowania (mapping rate) i lista nieprzypisanych etykiet.", evidence: "Panel Research Dashboard." },
    { id: "mastery", title: "Modele mastery użytkownika i dziecka", what: "Persystencja prawdopodobieństwa opanowania per kompetencja.", why: "Tworzy długoterminowy obraz wiedzy.", data: "user_competency_mastery, child_kc_mastery.", output: "Profil kompetencji + delty po checkpointach.", evidence: "Owner-scoped RLS, is_parent_of_child()." },
    { id: "plan", title: "Silnik planu nauki", what: "Generuje 7–14 kroków na podstawie diagnozy.", why: "Łączy wynik diagnozy z konkretnymi działaniami.", data: "learning_plans, learning_plan_items.", output: "Plan z uzasadnieniem i statusami.", evidence: "smart_evidence_events: plan_generated, plan_item_completed." },
    { id: "checkpoint", title: "Pętla pomiaru postępu", what: "Powtórna diagnoza w tym samym obszarze i porównanie z baseline.", why: "Pozwala mierzyć realny przyrost wiedzy.", data: "learning_checkpoints.", output: "score_delta, mastery_delta, raport checkpointu.", evidence: "smart_evidence_events: checkpoint_created, checkpoint_completed." },
    { id: "expert", title: "Walidacja ekspercka (human-in-the-loop)", what: "Eksperci oceniają zgadzam się / częściowo / nie zgadzam.", why: "Kalibruje AI i zwiększa zaufanie do rekomendacji.", data: "expert_reviews, expert_review_items.", output: "agreement_score, correction_rate.", evidence: "smart_evidence_events: expert_review_submitted." },
    { id: "evidence", title: "SMART Evidence Events", what: "Append-only log kluczowych zdarzeń.", why: "Stanowi szkielet dowodowy dla raportów ewaluacyjnych.", data: "smart_evidence_events.", output: "Strumień zdarzeń z wersją algorytmu/promptu.", evidence: "Eksport JSON z Research Dashboard." },
    { id: "research", title: "Research & Validation Dashboard", what: "Agreguje metryki lejka, walidacji i traceability.", why: "Daje zespołowi i ewaluatorom widok end-to-end.", data: "Wszystkie powyższe tabele.", output: "Metryki KPI + readiness score.", evidence: "Panel admin /admin/research." },
    { id: "export", title: "Eksport SMART Evidence", what: "Anonimowy raport JSON z metrykami i historią algorytmów.", why: "Wspiera dokumentację grantową i ewaluację zewnętrzną.", data: "Agregaty bez PII.", output: "Plik kogni-smart-evidence-report-*.json.", evidence: "Patrz Research Dashboard → Export." },
  ],
  en: [
    { id: "graph", title: "Universal Curriculum & Competency Graph", what: "Fixed taxonomy: education systems, levels, domains, competencies, prerequisites.", why: "Allows mapping any topic to a shared, reproducible structure.", data: "education_systems, education_levels, learning_domains, competencies, competency_prerequisites.", output: "Shared reference space for diagnoses, plans, and checkpoints.", evidence: "Reference tables + competency_source_mappings." },
    { id: "diag", title: "AI Diagnostic Engine", what: "Adaptive diagnosis that generates questions and a skill estimate.", why: "Replaces static placement tests.", data: "diagnostic_attempts, diagnostic_items, diagnostic_responses.", output: "Score, competency mapping, taxonomy payload.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "trace", title: "Competency Traceability Layer", what: "Every AI output is linked to a competency or skill_area label.", why: "Eliminates hallucinations and enables audit.", data: "competency_id, skill_area_label, learning_domain_id.", output: "Mapping rate and list of unmapped labels.", evidence: "Research Dashboard panel." },
    { id: "mastery", title: "User / Child Mastery Models", what: "Persists per-competency mastery probability.", why: "Builds a long-term knowledge profile.", data: "user_competency_mastery, child_kc_mastery.", output: "Competency profile and post-checkpoint deltas.", evidence: "Owner-scoped RLS, is_parent_of_child()." },
    { id: "plan", title: "Diagnosis-Based Learning Plan Engine", what: "Generates 7–14 steps from a diagnosis.", why: "Bridges diagnosis to concrete actions.", data: "learning_plans, learning_plan_items.", output: "Plan with rationale and statuses.", evidence: "smart_evidence_events: plan_generated, plan_item_completed." },
    { id: "checkpoint", title: "Progress / Checkpoint Measurement Loop", what: "Re-diagnosis in the same area, compared to baseline.", why: "Measures real knowledge gain.", data: "learning_checkpoints.", output: "score_delta, mastery_delta, checkpoint report.", evidence: "smart_evidence_events: checkpoint_created, checkpoint_completed." },
    { id: "expert", title: "Expert Review / Human-in-the-loop Validation", what: "Experts mark agree / partial / disagree.", why: "Calibrates AI and increases trust.", data: "expert_reviews, expert_review_items.", output: "agreement_score, correction_rate.", evidence: "smart_evidence_events: expert_review_submitted." },
    { id: "evidence", title: "SMART Evidence Events", what: "Append-only log of key events.", why: "Forms the evidence backbone for evaluations.", data: "smart_evidence_events.", output: "Stream of events with algorithm/prompt version.", evidence: "JSON export from Research Dashboard." },
    { id: "research", title: "Research & Validation Dashboard", what: "Aggregates funnel, validation, and traceability metrics.", why: "Gives team and evaluators an end-to-end view.", data: "All tables above.", output: "KPI metrics + readiness score.", evidence: "Admin panel /admin/research." },
    { id: "export", title: "SMART Evidence Export", what: "Anonymous JSON report with metrics and algorithm history.", why: "Supports grant documentation and external evaluation.", data: "Aggregates with no PII.", output: "kogni-smart-evidence-report-*.json file.", evidence: "Research Dashboard → Export." },
  ],
  es: [
    { id: "graph", title: "Grafo universal de currículo y competencias", what: "Taxonomía fija: sistemas educativos, niveles, dominios, competencias, prerrequisitos.", why: "Permite asignar cualquier tema a una estructura compartida y reproducible.", data: "education_systems, education_levels, learning_domains, competencies, competency_prerequisites.", output: "Espacio común de referencia para diagnósticos, planes y checkpoints.", evidence: "Tablas de referencia + competency_source_mappings." },
    { id: "diag", title: "Motor de diagnóstico con IA", what: "Diagnóstico adaptativo que genera preguntas y estimación de habilidades.", why: "Reemplaza los tests de nivel estáticos.", data: "diagnostic_attempts, diagnostic_items, diagnostic_responses.", output: "Puntuación, asignación a competencias, payload de taxonomía.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "trace", title: "Capa de trazabilidad de competencias", what: "Cada salida de IA se vincula a una competencia o etiqueta skill_area.", why: "Elimina alucinaciones y permite auditoría.", data: "competency_id, skill_area_label, learning_domain_id.", output: "Tasa de mapeo y lista de etiquetas no asignadas.", evidence: "Panel Research Dashboard." },
    { id: "mastery", title: "Modelos de dominio del usuario / hijo", what: "Persiste la probabilidad de dominio por competencia.", why: "Construye un perfil de conocimiento a largo plazo.", data: "user_competency_mastery, child_kc_mastery.", output: "Perfil de competencias y deltas tras checkpoints.", evidence: "RLS por propietario, is_parent_of_child()." },
    { id: "plan", title: "Motor de plan de estudio basado en diagnóstico", what: "Genera 7–14 pasos a partir del diagnóstico.", why: "Conecta el diagnóstico con acciones concretas.", data: "learning_plans, learning_plan_items.", output: "Plan con justificación y estados.", evidence: "smart_evidence_events: plan_generated, plan_item_completed." },
    { id: "checkpoint", title: "Bucle de medición de progreso / checkpoint", what: "Re-diagnóstico en la misma área comparado con la línea base.", why: "Mide la ganancia real de conocimiento.", data: "learning_checkpoints.", output: "score_delta, mastery_delta, informe de checkpoint.", evidence: "smart_evidence_events: checkpoint_created, checkpoint_completed." },
    { id: "expert", title: "Revisión experta / human-in-the-loop", what: "Los expertos marcan de acuerdo / parcial / en desacuerdo.", why: "Calibra la IA y aumenta la confianza.", data: "expert_reviews, expert_review_items.", output: "agreement_score, correction_rate.", evidence: "smart_evidence_events: expert_review_submitted." },
    { id: "evidence", title: "SMART Evidence Events", what: "Registro append-only de eventos clave.", why: "Es la columna vertebral de evidencia para evaluaciones.", data: "smart_evidence_events.", output: "Flujo de eventos con versión de algoritmo/prompt.", evidence: "Exportación JSON desde Research Dashboard." },
    { id: "research", title: "Panel de Investigación y Validación", what: "Agrega métricas de embudo, validación y trazabilidad.", why: "Ofrece una vista end-to-end al equipo y evaluadores.", data: "Todas las tablas anteriores.", output: "Métricas KPI + readiness score.", evidence: "Panel admin /admin/research." },
    { id: "export", title: "Exportación SMART Evidence", what: "Informe JSON anónimo con métricas e historial de algoritmos.", why: "Apoya la documentación de subvenciones y la evaluación externa.", data: "Agregados sin PII.", output: "Archivo kogni-smart-evidence-report-*.json.", evidence: "Research Dashboard → Export." },
  ],
};

type Hypothesis = { id: string; statement: string };

const hypotheses: Record<Lang, Hypothesis[]> = {
  pl: [
    { id: "H1", statement: "Adaptacyjna diagnostyka AI potrafi identyfikować luki w wiedzy z wystarczającą zgodnością względem oceny eksperckiej." },
    { id: "H2", statement: "Plany nauki oparte na diagnozie poprawiają wyniki w checkpointach względem wyniku bazowego." },
    { id: "H3", statement: "Traceability w grafie kompetencji zwiększa wyjaśnialność i zaufanie do rekomendacji AI w edukacji." },
    { id: "H4", statement: "Recenzje eksperckie typu human-in-the-loop kalibrują rekomendacje AI i redukują false positives oraz false negatives." },
    { id: "H5", statement: "Wersjonowanie algorytmów oraz zdarzenia dowodowe umożliwiają odtwarzalną walidację efektów uczenia." },
  ],
  en: [
    { id: "H1", statement: "Adaptive AI diagnostics can identify knowledge gaps with sufficient agreement compared to expert review." },
    { id: "H2", statement: "Diagnosis-based learning plans improve checkpoint outcomes compared to baseline diagnostic scores." },
    { id: "H3", statement: "Competency graph traceability improves explainability and trust of AI educational recommendations." },
    { id: "H4", statement: "Human-in-the-loop expert reviews can calibrate AI recommendations and reduce false positives and false negatives." },
    { id: "H5", statement: "Algorithm versioning and evidence events enable reproducible validation of learning outcomes." },
  ],
  es: [
    { id: "H1", statement: "El diagnóstico adaptativo con IA puede identificar lagunas de conocimiento con suficiente concordancia frente a la revisión experta." },
    { id: "H2", statement: "Los planes de estudio basados en diagnóstico mejoran los resultados en checkpoints frente a las puntuaciones base." },
    { id: "H3", statement: "La trazabilidad por grafo de competencias mejora la explicabilidad y la confianza en las recomendaciones de IA." },
    { id: "H4", statement: "Las revisiones expertas human-in-the-loop calibran las recomendaciones de IA y reducen falsos positivos y negativos." },
    { id: "H5", statement: "El versionado de algoritmos y los eventos de evidencia permiten una validación reproducible de los resultados de aprendizaje." },
  ],
};

type Risk = { id: string; label: string; severity: "low" | "medium" | "high"; mitigation: string; evidence: string };

const risks: Record<Lang, Risk[]> = {
  pl: [
    { id: "r1", label: "Niedokładna diagnoza AI", severity: "high", mitigation: "Adaptacyjne pytania, walidacja ekspercka, śledzenie agreement_score.", evidence: "expert_reviews, smart_evidence_events." },
    { id: "r2", label: "Halucynowane lub źle zmapowane kompetencje", severity: "high", mitigation: "Stała taksonomia + skill_area_label + raport mapping rate.", evidence: "competencies, child_kc_mastery, Research Dashboard." },
    { id: "r3", label: "Niska zgodność z ekspertami", severity: "medium", mitigation: "Iteracyjne dostrajanie promptów i wersjonowanie algorytmów.", evidence: "expert_reviews.agreement_score, algorithm_version." },
    { id: "r4", label: "Brak istotnej poprawy po planie nauki", severity: "medium", mitigation: "Pętla checkpointu z baseline ↔ checkpoint i score_delta.", evidence: "learning_checkpoints." },
    { id: "r5", label: "Słabe lub niekompletne pokrycie taksonomii", severity: "medium", mitigation: "Ciągłe poszerzanie grafu, monitoring nieprzypisanych etykiet.", evidence: "Research Dashboard → top_skill_labels." },
    { id: "r6", label: "Rzadkie dane we wczesnych pilotach", severity: "medium", mitigation: "Agregaty + pilot multi-cohort + analiza wrażliwości.", evidence: "Research Dashboard → counts." },
    { id: "r7", label: "Prywatność i dane małoletnich", severity: "high", mitigation: "RLS owner-scoped, is_parent_of_child(), brak PII w eksporcie.", evidence: "Polityki RLS, eksport SMART." },
    { id: "r8", label: "Wymagania wyjaśnialności (XAI)", severity: "medium", mitigation: "Każda rekomendacja powiązana z kompetencją i wersją algorytmu.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "r9", label: "Skalowanie analityki przy wzroście danych", severity: "low", mitigation: "Agregaty zapisywane jako liczby, indeksy na kluczowych kolumnach.", evidence: "Schemat bazy + indeksy." },
    { id: "r10", label: "Drift wersji modeli/promptów", severity: "medium", mitigation: "Rejestr wersji algorytmów i promptów na każdym artefakcie.", evidence: "Algorithm version registry." },
  ],
  en: [
    { id: "r1", label: "Inaccurate AI diagnosis", severity: "high", mitigation: "Adaptive questioning, expert validation, agreement_score tracking.", evidence: "expert_reviews, smart_evidence_events." },
    { id: "r2", label: "Hallucinated or poorly mapped competencies", severity: "high", mitigation: "Fixed taxonomy + skill_area_label + mapping rate report.", evidence: "competencies, child_kc_mastery, Research Dashboard." },
    { id: "r3", label: "Weak agreement with human experts", severity: "medium", mitigation: "Iterative prompt tuning and algorithm versioning.", evidence: "expert_reviews.agreement_score, algorithm_version." },
    { id: "r4", label: "Insufficient improvement after a learning plan", severity: "medium", mitigation: "Checkpoint loop with baseline ↔ checkpoint and score_delta.", evidence: "learning_checkpoints." },
    { id: "r5", label: "Low quality or incomplete taxonomy coverage", severity: "medium", mitigation: "Continuous graph expansion, monitor unmapped labels.", evidence: "Research Dashboard → top_skill_labels." },
    { id: "r6", label: "Data sparsity in early pilots", severity: "medium", mitigation: "Aggregate metrics + multi-cohort pilots + sensitivity analysis.", evidence: "Research Dashboard → counts." },
    { id: "r7", label: "Privacy and minors' data", severity: "high", mitigation: "Owner-scoped RLS, is_parent_of_child(), no PII in exports.", evidence: "RLS policies, SMART export." },
    { id: "r8", label: "Explainability requirements (XAI)", severity: "medium", mitigation: "Each recommendation linked to a competency and algorithm version.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "r9", label: "Scaling analytics as the dataset grows", severity: "low", mitigation: "Aggregates stored as numbers, indexes on key columns.", evidence: "DB schema and indexes." },
    { id: "r10", label: "Model / prompt version drift", severity: "medium", mitigation: "Algorithm and prompt version registry on every artifact.", evidence: "Algorithm version registry." },
  ],
  es: [
    { id: "r1", label: "Diagnóstico de IA inexacto", severity: "high", mitigation: "Preguntas adaptativas, validación experta, seguimiento de agreement_score.", evidence: "expert_reviews, smart_evidence_events." },
    { id: "r2", label: "Competencias alucinadas o mal asignadas", severity: "high", mitigation: "Taxonomía fija + skill_area_label + informe de tasa de mapeo.", evidence: "competencies, child_kc_mastery, Research Dashboard." },
    { id: "r3", label: "Baja concordancia con expertos humanos", severity: "medium", mitigation: "Ajuste iterativo de prompts y versionado de algoritmos.", evidence: "expert_reviews.agreement_score, algorithm_version." },
    { id: "r4", label: "Mejora insuficiente tras el plan de estudio", severity: "medium", mitigation: "Bucle de checkpoint con baseline ↔ checkpoint y score_delta.", evidence: "learning_checkpoints." },
    { id: "r5", label: "Baja calidad o cobertura incompleta de taxonomía", severity: "medium", mitigation: "Expansión continua del grafo, monitorizar etiquetas no asignadas.", evidence: "Research Dashboard → top_skill_labels." },
    { id: "r6", label: "Escasez de datos en pilotos iniciales", severity: "medium", mitigation: "Métricas agregadas + pilotos multi-cohorte + análisis de sensibilidad.", evidence: "Research Dashboard → counts." },
    { id: "r7", label: "Privacidad y datos de menores", severity: "high", mitigation: "RLS por propietario, is_parent_of_child(), sin PII en exportaciones.", evidence: "Políticas RLS, exportación SMART." },
    { id: "r8", label: "Requisitos de explicabilidad (XAI)", severity: "medium", mitigation: "Cada recomendación vinculada a una competencia y versión de algoritmo.", evidence: "algorithm_version, prompt_version, smart_evidence_events." },
    { id: "r9", label: "Escalado de la analítica con el crecimiento de datos", severity: "low", mitigation: "Agregados almacenados como números, índices en columnas clave.", evidence: "Esquema de BD e índices." },
    { id: "r10", label: "Deriva de versiones de modelo/prompt", severity: "medium", mitigation: "Registro de versiones de algoritmos y prompts en cada artefacto.", evidence: "Algorithm version registry." },
  ],
};

const evidenceArchitecture: Record<Lang, string> = {
  pl: "Każdy istotny artefakt platformy generuje wpis w smart_evidence_events: utworzenie diagnozy, wygenerowanie planu, zakończenie kroku, utworzenie i zakończenie checkpointu, przesłanie recenzji eksperckiej. Wpisy zawierają wersję algorytmu, wersję promptu, owner_type oraz metryki. Strumień jest tylko-do-dopisywania i służy jako audytowalne źródło dowodu.",
  en: "Each meaningful artifact emits an entry in smart_evidence_events: diagnosis created, plan generated, plan item completed, checkpoint created and completed, expert review submitted. Entries include algorithm_version, prompt_version, owner_type, and metrics. The stream is append-only and serves as the auditable source of evidence.",
  es: "Cada artefacto relevante genera una entrada en smart_evidence_events: creación de diagnóstico, generación de plan, finalización de paso, creación y finalización de checkpoint, envío de revisión experta. Las entradas incluyen algorithm_version, prompt_version, owner_type y métricas. El flujo es solo-añadir y constituye la fuente auditable de evidencia.",
};

const dataModelText: Record<Lang, string> = {
  pl: "Aktualnym źródłem prawdy dla taksonomii jest universal graph (education_systems → education_levels, learning_domains, competencies, competency_prerequisites). Mastery jest zapisywane w user_competency_mastery (self) oraz child_kc_mastery (rodzic-dziecko). Plan, checkpoint i recenzje są powiązane z owner_id, attempt_id lub plan_id. Pełny opis: docs/DATA_MODEL_SOT.md.",
  en: "The current source of truth for taxonomy is the universal graph (education_systems → education_levels, learning_domains, competencies, competency_prerequisites). Mastery is stored in user_competency_mastery (self) and child_kc_mastery (parent–child). Plans, checkpoints, and reviews are linked via owner_id, attempt_id, or plan_id. Full description: docs/DATA_MODEL_SOT.md.",
  es: "La fuente actual de verdad para la taxonomía es el grafo universal (education_systems → education_levels, learning_domains, competencies, competency_prerequisites). El dominio se almacena en user_competency_mastery (propio) y child_kc_mastery (padre-hijo). Planes, checkpoints y revisiones se vinculan vía owner_id, attempt_id o plan_id. Descripción completa: docs/DATA_MODEL_SOT.md.",
};

const algorithmVersioningText: Record<Lang, string> = {
  pl: "Każdy artefakt generowany przez AI (diagnoza, plan, checkpoint, recenzja) zapisuje algorithm_version, a tam gdzie ma to sens — prompt_version. Pozwala to oddzielić skuteczność konkretnej wersji modelu od ogólnej skuteczności platformy oraz przeprowadzać retrospektywne analizy A/B.",
  en: "Every AI-generated artifact (diagnosis, plan, checkpoint, review) records algorithm_version, and where applicable prompt_version. This separates the effectiveness of a specific model version from the overall platform performance and enables retrospective A/B analyses.",
  es: "Cada artefacto generado por IA (diagnóstico, plan, checkpoint, revisión) registra algorithm_version y, cuando procede, prompt_version. Esto separa la eficacia de una versión concreta del modelo del rendimiento general de la plataforma y permite análisis A/B retrospectivos.",
};

const pilotPlanText: Record<Lang, string> = {
  pl: "Pilot v1: 1) zaproszenie kohort uczniów / rodziców / niezależnych ekspertów, 2) baseline diagnoza, 3) plan nauki, 4) realizacja kroków, 5) checkpoint po 2–4 tygodniach, 6) ocena ekspercka próbki diagnoz i planów, 7) raport SMART Evidence + analiza KPI. Sukces operacyjny mierzony jest stopą ukończenia checkpointu, średnią deltą wyniku i AI-expert agreement.",
  en: "Pilot v1: 1) recruit cohorts of learners / parents / independent experts, 2) baseline diagnosis, 3) learning plan, 4) plan execution, 5) checkpoint after 2–4 weeks, 6) expert evaluation of a sample of diagnoses and plans, 7) SMART Evidence report + KPI analysis. Operational success is measured by checkpoint completion rate, mean score delta, and AI–expert agreement.",
  es: "Piloto v1: 1) reclutar cohortes de alumnos / familias / expertos independientes, 2) diagnóstico base, 3) plan de estudio, 4) ejecución del plan, 5) checkpoint a 2–4 semanas, 6) evaluación experta de una muestra de diagnósticos y planes, 7) informe SMART Evidence + análisis KPI. El éxito operativo se mide por la tasa de finalización del checkpoint, la delta media de puntuación y la concordancia IA-experto.",
};

const marketImpactText: Record<Lang, string> = {
  pl: "Kogni adresuje uczniów, rodziców, nauczycieli i organizacje szkoleniowe w Polsce i UE. Wartością dla ewaluatorów programów publicznych jest powtarzalny pomiar przyrostu kompetencji oraz auditowalne dowody działania algorytmów AI. To pozwala kierować środki publiczne tam, gdzie efekt edukacyjny jest mierzalny.",
  en: "Kogni targets learners, parents, teachers, and training organizations in Poland and the EU. The value for public-program evaluators is a reproducible measurement of competency growth and auditable evidence of AI behavior. This enables public funds to be directed where educational impact is measurable.",
  es: "Kogni se dirige a alumnos, familias, docentes y organizaciones de formación en Polonia y la UE. El valor para los evaluadores de programas públicos es la medición reproducible del crecimiento competencial y la evidencia auditable del comportamiento de la IA. Esto permite dirigir los fondos públicos donde el impacto educativo es medible.",
};

// ---------- Page ----------

const fmt = (n: number | null | undefined, digits = 2) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${(Number(n) * 100).toFixed(0)}%`;

function severityVariant(s: "low" | "medium" | "high"): "secondary" | "default" | "destructive" {
  if (s === "high") return "destructive";
  if (s === "medium") return "default";
  return "secondary";
}

function statusBadge(status: "ready" | "partial" | "missing", t: (k: string) => string) {
  if (status === "ready") return <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">{t("grantPack.status.ready")}</Badge>;
  if (status === "partial") return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">{t("grantPack.status.partial")}</Badge>;
  return <Badge variant="secondary" className="bg-destructive/15 text-destructive border-0">{t("grantPack.status.missing")}</Badge>;
}

const GrantPackInner = () => {
  const { t, i18n } = useTranslation();
  const lang = ((i18n.language || "pl").split("-")[0] as Lang);
  const safeLang: Lang = lang === "pl" || lang === "en" || lang === "es" ? lang : "pl";

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [algos, setAlgos] = useState<AlgoRow[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [
        diagAll, diagWithTax, plans, cpsCompleted, expertSubmitted, expertItems,
        smartEvents, masterySelf, masteryChild,
        diagAttemptsRows, learningPlansRows, checkpointsRows, expertRows,
      ] = await Promise.all([
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).not("learning_domain_id", "is", null),
        supabase.from("learning_plans").select("id", { count: "exact", head: true }),
        supabase.from("learning_checkpoints").select("baseline_score, checkpoint_score, score_delta, mastery_delta, status").eq("status", "completed"),
        supabase.from("expert_reviews").select("id, agreement_score").eq("status", "submitted"),
        supabase.from("expert_review_items").select("verdict"),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }),
        supabase.from("user_competency_mastery").select("competency_id, skill_area_label"),
        supabase.from("child_kc_mastery").select("competency_id, skill_area_label"),
        supabase.from("diagnostic_attempts").select("algorithm_version, prompt_version, created_at"),
        supabase.from("learning_plans").select("algorithm_version, prompt_version, created_at"),
        supabase.from("learning_checkpoints").select("algorithm_version, created_at"),
        supabase.from("expert_reviews").select("algorithm_version, created_at"),
      ]);

      const totalDiag = diagAll.count ?? 0;
      const diagTax = diagWithTax.count ?? 0;
      const taxonomyCoverageRate = totalDiag > 0 ? diagTax / totalDiag : null;

      const cpRows = (cpsCompleted.data || []) as any[];
      const scoreDeltas = cpRows.map((r) => r.score_delta).filter((x) => x != null);
      const masteryDeltas = cpRows.map((r) => r.mastery_delta).filter((x) => x != null);
      const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + Number(b), 0) / xs.length : null;

      const expertRowsArr = (expertSubmitted.data || []) as any[];
      const agreements = expertRowsArr.map((r) => r.agreement_score).filter((x) => x != null);

      const allMastery = [...(masterySelf.data || []), ...(masteryChild.data || [])] as any[];
      const mapped = allMastery.filter((m) => m.competency_id).length;
      const unmapped = allMastery.length - mapped;
      const matchRate = allMastery.length ? mapped / allMastery.length : null;

      // Algorithm registry aggregation
      type Key = string;
      const algoMap = new Map<Key, AlgoRow>();
      const ingest = (rows: any[] | null | undefined, source: string) => {
        for (const r of rows || []) {
          const v = r.algorithm_version || "(unversioned)";
          const k = `${source}::${v}`;
          const existing = algoMap.get(k);
          if (existing) {
            existing.count += 1;
            if (r.created_at && (!existing.latest || r.created_at > existing.latest)) existing.latest = r.created_at;
          } else {
            algoMap.set(k, { version: v, source, count: 1, latest: r.created_at || null });
          }
        }
      };
      ingest(diagAttemptsRows.data as any[], "diagnostic_attempts");
      ingest(learningPlansRows.data as any[], "learning_plans");
      ingest(checkpointsRows.data as any[], "learning_checkpoints");
      ingest(expertRows.data as any[], "expert_reviews");
      const algoList = [...algoMap.values()].sort((a, b) => b.count - a.count);

      const m: Metrics = {
        diagnosticAttempts: totalDiag,
        diagnosticsWithTaxonomy: diagTax,
        taxonomyCoverageRate,
        learningPlans: plans.count ?? 0,
        checkpointsCompleted: cpRows.length,
        avgScoreDelta: avg(scoreDeltas),
        avgMasteryDelta: avg(masteryDeltas),
        expertReviewsSubmitted: expertRowsArr.length,
        avgAgreement: avg(agreements),
        smartEvidenceEvents: smartEvents.count ?? 0,
        masteryMapped: mapped,
        masteryUnmapped: unmapped,
        competencyMatchRate: matchRate,
        algorithmVersionsCount: algoList.length,
        hasPilotData: totalDiag > 0 || cpRows.length > 0 || expertRowsArr.length > 0,
      };

      setMetrics(m);
      setAlgos(algoList);
      setLoading(false);
    })();
  }, []);

  // ---------- Section content as plain strings (for rendering, copy, JSON, MD) ----------

  const sections = useMemo(() => {
    if (!metrics) return [] as { id: string; title: string; content: string }[];
    const L = safeLang;
    const noPilot = !metrics.hasPilotData ? `\n\n${t("grantPack.noPilotData")}` : "";

    const componentsBlock = innovationComponents[L]
      .map((c) => `• ${c.title}\n  - ${c.what}\n  - ${c.why}\n  - ${c.data}\n  - ${c.output}\n  - ${c.evidence}`)
      .join("\n\n");

    const hypothesesBlock = hypotheses[L].map((h) => `${h.id}: ${h.statement}`).join("\n");

    const risksBlock = risks[L]
      .map((r) => `• [${r.severity.toUpperCase()}] ${r.label}\n  - ${r.mitigation}\n  - ${r.evidence}`)
      .join("\n\n");

    const kpiLines = [
      `diagnostic_attempts: ${metrics.diagnosticAttempts}`,
      `diagnostics_with_taxonomy: ${metrics.diagnosticsWithTaxonomy}`,
      `taxonomy_coverage_rate: ${pct(metrics.taxonomyCoverageRate)}`,
      `learning_plans: ${metrics.learningPlans}`,
      `checkpoints_completed: ${metrics.checkpointsCompleted}`,
      `avg_score_delta: ${fmt(metrics.avgScoreDelta)}`,
      `avg_mastery_delta: ${fmt(metrics.avgMasteryDelta)}`,
      `expert_reviews_submitted: ${metrics.expertReviewsSubmitted}`,
      `avg_ai_expert_agreement: ${fmt(metrics.avgAgreement)}`,
      `smart_evidence_events: ${metrics.smartEvidenceEvents}`,
      `competency_mapped: ${metrics.masteryMapped}`,
      `competency_unmapped: ${metrics.masteryUnmapped}`,
      `competency_match_rate: ${pct(metrics.competencyMatchRate)}`,
      `algorithm_versions_used: ${metrics.algorithmVersionsCount}`,
    ].join("\n");

    const algoBlock = algos.length === 0
      ? "—"
      : algos.map((a) => `• ${a.source} | ${a.version} | n=${a.count}${a.latest ? ` | last=${a.latest}` : ""}`).join("\n");

    return [
      { id: "executive_summary", title: t("grantPack.sections.executive_summary"), content: positioning[L] + noPilot },
      { id: "problem_statement", title: t("grantPack.sections.problem_statement"), content: problemStatement[L] },
      { id: "proposed_solution", title: t("grantPack.sections.proposed_solution"), content: proposedSolution[L] },
      { id: "innovation_components", title: t("grantPack.sections.innovation_components"), content: componentsBlock },
      { id: "rd_hypotheses", title: t("grantPack.sections.rd_hypotheses"), content: hypothesesBlock },
      { id: "tech_risks", title: t("grantPack.sections.tech_risks"), content: risksBlock },
      { id: "validation_kpis", title: t("grantPack.sections.validation_kpis"), content: kpiLines },
      { id: "evidence_architecture", title: t("grantPack.sections.evidence_architecture"), content: evidenceArchitecture[L] },
      { id: "data_model", title: t("grantPack.sections.data_model"), content: dataModelText[L] },
      { id: "algorithm_versioning", title: t("grantPack.sections.algorithm_versioning"), content: `${algorithmVersioningText[L]}\n\n${algoBlock}` },
      { id: "pilot_validation_plan", title: t("grantPack.sections.pilot_validation_plan"), content: pilotPlanText[L] },
      { id: "market_impact", title: t("grantPack.sections.market_impact"), content: marketImpactText[L] },
    ];
  }, [metrics, algos, safeLang, t]);

  // ---------- KPI rows ----------
  const kpis = useMemo(() => {
    if (!metrics) return [];
    return [
      { key: "diagnostic_attempts", label: "Diagnostic attempts", value: String(metrics.diagnosticAttempts) },
      { key: "diagnostics_with_taxonomy", label: "Diagnostics linked to taxonomy", value: String(metrics.diagnosticsWithTaxonomy) },
      { key: "taxonomy_coverage_rate", label: "Taxonomy coverage rate", value: pct(metrics.taxonomyCoverageRate) },
      { key: "learning_plans", label: "Learning plans generated", value: String(metrics.learningPlans) },
      { key: "checkpoints_completed", label: "Checkpoints completed", value: String(metrics.checkpointsCompleted) },
      { key: "avg_score_delta", label: "Average score delta", value: fmt(metrics.avgScoreDelta) },
      { key: "avg_mastery_delta", label: "Average mastery delta", value: fmt(metrics.avgMasteryDelta) },
      { key: "expert_reviews_submitted", label: "Expert reviews submitted", value: String(metrics.expertReviewsSubmitted) },
      { key: "avg_ai_expert_agreement", label: "Average AI–expert agreement", value: fmt(metrics.avgAgreement) },
      { key: "smart_evidence_events", label: "SMART evidence events", value: String(metrics.smartEvidenceEvents) },
      { key: "competency_match_rate", label: "Competency match rate", value: pct(metrics.competencyMatchRate) },
      { key: "algorithm_versions_used", label: "Algorithm versions used", value: String(metrics.algorithmVersionsCount) },
    ];
  }, [metrics]);

  // ---------- Readiness checklist ----------
  type ChkItem = { id: string; group: string; label: string; status: "ready" | "partial" | "missing"; evidence: string; recommendation: string };
  const readiness: ChkItem[] = useMemo(() => {
    if (!metrics) return [];
    const has = (n: number) => n > 0;
    const partialOrReady = (n: number, target: number): "ready" | "partial" | "missing" =>
      n >= target ? "ready" : n > 0 ? "partial" : "missing";
    return [
      // A. Product
      { id: "p1", group: "product", label: "Universal competency graph", status: "ready", evidence: "competencies, learning_domains", recommendation: "Continue expanding domain coverage." },
      { id: "p2", group: "product", label: "AI diagnostic flow live", status: "ready", evidence: "diagnostic-adaptive edge function", recommendation: "Monitor latency and cost per attempt." },
      { id: "p3", group: "product", label: "Learning plan engine live", status: "ready", evidence: "learning-plan-generate", recommendation: "Iterate on rationale quality." },
      { id: "p4", group: "product", label: "Checkpoint loop live", status: "ready", evidence: "checkpoint-create / checkpoint-finalize", recommendation: "Add reminders for due checkpoints." },
      { id: "p5", group: "product", label: "Expert review workspace", status: "ready", evidence: "/expert/reviews/:id", recommendation: "Recruit calibration reviewers." },

      // B. R&D
      { id: "r1", group: "rd", label: "Algorithm and prompt versioning", status: "ready", evidence: "algorithm_version, prompt_version", recommendation: "Document each version change." },
      { id: "r2", group: "rd", label: "SMART evidence events stream", status: "ready", evidence: "smart_evidence_events", recommendation: "Keep events append-only." },
      { id: "r3", group: "rd", label: "Research dashboard with funnel KPIs", status: "ready", evidence: "/admin/research", recommendation: "Add trend charts when data grows." },
      { id: "r4", group: "rd", label: "AI–expert agreement measured", status: partialOrReady(metrics.expertReviewsSubmitted, 5), evidence: "expert_reviews.agreement_score", recommendation: "Target ≥30 expert reviews per cohort." },

      // C. Data
      { id: "d1", group: "data", label: "Pilot diagnostics collected", status: partialOrReady(metrics.diagnosticAttempts, 30), evidence: "diagnostic_attempts", recommendation: "Recruit pilot cohorts." },
      { id: "d2", group: "data", label: "Pilot checkpoints completed", status: partialOrReady(metrics.checkpointsCompleted, 10), evidence: "learning_checkpoints", recommendation: "Schedule checkpoints 2–4 weeks after plan activation." },
      { id: "d3", group: "data", label: "Competency mapping coverage", status: metrics.competencyMatchRate == null ? "missing" : metrics.competencyMatchRate >= 0.7 ? "ready" : "partial", evidence: "user_competency_mastery + child_kc_mastery", recommendation: "Reduce unmapped skill_area_labels." },

      // D. Legal
      { id: "l1", group: "legal", label: "RLS owner-scoped on user data", status: "ready", evidence: "auth.uid() / is_parent_of_child policies", recommendation: "Re-run security scan after schema changes." },
      { id: "l2", group: "legal", label: "No PII in SMART export", status: "ready", evidence: "Aggregate-only export payload", recommendation: "Keep export schema reviewed." },
      { id: "l3", group: "legal", label: "Independent legal review of consent and minors' data", status: "missing", evidence: "—", recommendation: "Engage qualified counsel before public pilot." },

      // E. Pilot
      { id: "e1", group: "pilot", label: "Pilot cohort recruited", status: has(metrics.diagnosticAttempts) ? "partial" : "missing", evidence: "diagnostic_attempts", recommendation: "Define cohort size and inclusion criteria." },
      { id: "e2", group: "pilot", label: "Independent expert validation completed", status: partialOrReady(metrics.expertReviewsSubmitted, 10), evidence: "expert_reviews", recommendation: "Recruit 3–5 independent experts." },

      // F. Grant application
      { id: "g1", group: "grant", label: "Source of truth document", status: "ready", evidence: "docs/DATA_MODEL_SOT.md", recommendation: "Update on every schema change." },
      { id: "g2", group: "grant", label: "Innovation components documented", status: "ready", evidence: "This document", recommendation: "Refresh before submission." },
      { id: "g3", group: "grant", label: "R&D hypotheses defined", status: "ready", evidence: "This document", recommendation: "Tie each hypothesis to a measurable KPI." },
      { id: "g4", group: "grant", label: "Pilot validation report", status: metrics.checkpointsCompleted > 0 && metrics.expertReviewsSubmitted > 0 ? "partial" : "missing", evidence: "Research Dashboard export", recommendation: "Compile after pilot completes." },
    ];
  }, [metrics]);

  // ---------- Copy / Export ----------
  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((x) => (x === id ? null : x)), 1500);
      toast({ title: t("grantPack.copied") });
    } catch {
      toast({ title: "Clipboard error", variant: "destructive" });
    }
  };

  const buildPayload = () => ({
    generated_at: new Date().toISOString(),
    product: "Kogni",
    report_type: "GRANT_DOCUMENTATION_PACK_V1",
    language: safeLang,
    has_pilot_data: !!metrics?.hasPilotData,
    metrics: metrics ? {
      diagnostic_attempts: metrics.diagnosticAttempts,
      diagnostics_with_taxonomy: metrics.diagnosticsWithTaxonomy,
      taxonomy_coverage_rate: metrics.taxonomyCoverageRate,
      learning_plans: metrics.learningPlans,
      checkpoints_completed: metrics.checkpointsCompleted,
      avg_score_delta: metrics.avgScoreDelta,
      avg_mastery_delta: metrics.avgMasteryDelta,
      expert_reviews_submitted: metrics.expertReviewsSubmitted,
      avg_ai_expert_agreement: metrics.avgAgreement,
      smart_evidence_events: metrics.smartEvidenceEvents,
      competency_mapped: metrics.masteryMapped,
      competency_unmapped: metrics.masteryUnmapped,
      competency_match_rate: metrics.competencyMatchRate,
      algorithm_versions_count: metrics.algorithmVersionsCount,
    } : {},
    sections: sections.map((s) => ({ id: s.id, title: s.title, content: s.content })),
    innovation_components: innovationComponents[safeLang],
    hypotheses: hypotheses[safeLang],
    risks: risks[safeLang],
    kpis,
    algorithm_versions: algos,
    readiness_checklist: readiness,
    disclaimer: t("grantPack.disclaimer"),
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kogni-grant-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# ${t("grantPack.title")}`);
    lines.push("");
    lines.push(`_${t("grantPack.subtitle")}_`);
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()} · Language: ${safeLang}`);
    lines.push("");
    if (!metrics?.hasPilotData) { lines.push(`> ${t("grantPack.noPilotData")}`); lines.push(""); }

    lines.push(`## ${t("grantPack.metricsHeading")}`);
    for (const k of kpis) lines.push(`- **${k.label}**: ${k.value}`);
    lines.push("");

    for (const s of sections) {
      lines.push(`## ${s.title}`);
      lines.push("");
      lines.push(s.content);
      lines.push("");
    }

    lines.push(`## ${t("grantPack.sections.readiness_checklist")}`);
    const groups: Array<{ id: keyof typeof groupTitles; }> = [
      { id: "product" }, { id: "rd" }, { id: "data" }, { id: "legal" }, { id: "pilot" }, { id: "grant" },
    ];
    const groupTitles = {
      product: t("grantPack.readinessGroups.product"),
      rd: t("grantPack.readinessGroups.rd"),
      data: t("grantPack.readinessGroups.data"),
      legal: t("grantPack.readinessGroups.legal"),
      pilot: t("grantPack.readinessGroups.pilot"),
      grant: t("grantPack.readinessGroups.grant"),
    } as const;
    for (const g of groups) {
      lines.push(`### ${groupTitles[g.id]}`);
      for (const it of readiness.filter((r) => r.group === g.id)) {
        lines.push(`- [${it.status}] **${it.label}** — ${it.evidence} — ${it.recommendation}`);
      }
      lines.push("");
    }

    lines.push(`---`);
    lines.push(`_${t("grantPack.disclaimer")}_`);

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kogni-grant-pack-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Render ----------
  const groupTitles: Record<string, string> = {
    product: t("grantPack.readinessGroups.product"),
    rd: t("grantPack.readinessGroups.rd"),
    data: t("grantPack.readinessGroups.data"),
    legal: t("grantPack.readinessGroups.legal"),
    pilot: t("grantPack.readinessGroups.pilot"),
    grant: t("grantPack.readinessGroups.grant"),
  };

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("grantPack.title")}
          subtitle={t("grantPack.subtitle")}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportMarkdown} disabled={loading}>
                <FileText className="h-4 w-4 mr-2" />
                {t("grantPack.exportMarkdown")}
              </Button>
              <Button onClick={exportJson} disabled={loading}>
                <FileJson className="h-4 w-4 mr-2" />
                {t("grantPack.exportJson")}
              </Button>
            </div>
          }
        />

        {loading || !metrics ? (
          <Surface className="p-6 text-sm text-muted-foreground">{t("common.loadingPanel")}</Surface>
        ) : (
          <div className="space-y-6">
            {!metrics.hasPilotData && (
              <Surface className="p-4 text-sm border-l-4 border-amber-500">
                {t("grantPack.noPilotData")}
              </Surface>
            )}

            {/* Aggregate metrics */}
            <Surface className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-accent" />
                  {t("grantPack.metricsHeading")}
                </h2>
                <Button size="sm" variant="ghost" onClick={() => copyText("metrics", kpis.map((k) => `${k.label}: ${k.value}`).join("\n"))}>
                  {copiedId === "metrics" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copiedId === "metrics" ? t("grantPack.copied") : t("grantPack.copy")}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                {kpis.map((k) => (
                  <div key={k.key} className="rounded-lg border p-3 bg-card">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-lg font-semibold tabular-nums mt-1">{k.value}</p>
                  </div>
                ))}
              </div>
            </Surface>

            {/* Generic text sections */}
            {sections.map((s) => (
              <Surface key={s.id} className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-lg font-semibold">{s.title}</h2>
                  <Button size="sm" variant="ghost" onClick={() => copyText(s.id, `# ${s.title}\n\n${s.content}`)}>
                    {copiedId === s.id ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedId === s.id ? t("grantPack.copied") : t("grantPack.copy")}
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">{s.content}</pre>
              </Surface>
            ))}

            {/* Readiness checklist */}
            <Surface className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold">{t("grantPack.sections.readiness_checklist")}</h2>
                <Button size="sm" variant="ghost" onClick={() => copyText("readiness", readiness.map((r) => `[${r.status}] ${r.label} — ${r.evidence} — ${r.recommendation}`).join("\n"))}>
                  {copiedId === "readiness" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copiedId === "readiness" ? t("grantPack.copied") : t("grantPack.copy")}
                </Button>
              </div>
              <div className="space-y-5">
                {(["product", "rd", "data", "legal", "pilot", "grant"] as const).map((g) => (
                  <div key={g}>
                    <h3 className="text-sm font-semibold mb-2">{groupTitles[g]}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b">
                            <th className="py-2 pr-3">{t("grantPack.table.label")}</th>
                            <th className="py-2 pr-3">{t("grantPack.table.status")}</th>
                            <th className="py-2 pr-3">{t("grantPack.table.evidence")}</th>
                            <th className="py-2">{t("grantPack.table.recommendation")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {readiness.filter((r) => r.group === g).map((it) => (
                            <tr key={it.id} className="border-b last:border-0 align-top">
                              <td className="py-2 pr-3 font-medium">{it.label}</td>
                              <td className="py-2 pr-3">{statusBadge(it.status, t)}</td>
                              <td className="py-2 pr-3 text-muted-foreground">{it.evidence}</td>
                              <td className="py-2 text-muted-foreground">{it.recommendation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>

            {/* Risks table */}
            <Surface className="p-6">
              <h2 className="text-lg font-semibold mb-3">{t("grantPack.sections.tech_risks")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">{t("grantPack.table.label")}</th>
                      <th className="py-2 pr-3">{t("grantPack.table.severity")}</th>
                      <th className="py-2 pr-3">{t("grantPack.table.mitigation")}</th>
                      <th className="py-2">{t("grantPack.table.evidence")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks[safeLang].map((r) => (
                      <tr key={r.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 font-medium">{r.label}</td>
                        <td className="py-2 pr-3"><Badge variant={severityVariant(r.severity)}>{r.severity}</Badge></td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.mitigation}</td>
                        <td className="py-2 text-muted-foreground">{r.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>

            {/* Export footer */}
            <Surface className="p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Download className="h-4 w-4 text-accent" />
                {t("grantPack.sections.export")}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={exportJson}><FileJson className="h-4 w-4 mr-2" />{t("grantPack.exportJson")}</Button>
                <Button variant="outline" onClick={exportMarkdown}><FileText className="h-4 w-4 mr-2" />{t("grantPack.exportMarkdown")}</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">{t("grantPack.disclaimer")}</p>
            </Surface>
          </div>
        )}
      </DashboardShell>
    </AppShell>
  );
};

const GrantPack = () => (
  <RoleGate allow={["admin"]} fallback="/dashboard">
    <GrantPackInner />
  </RoleGate>
);

export default GrantPack;
