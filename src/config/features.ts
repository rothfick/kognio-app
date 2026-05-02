/**
 * Frontend feature flags for the Kogni live pilot v1.
 *
 * These flags control:
 *  - which navigation items render,
 *  - which routes are accessible (others show NotAvailableYet),
 *  - which dashboard cards / CTAs are visible.
 *
 * They are deliberately static booleans — no DB-backed flag system yet.
 * Flip a flag to `true` once the underlying module is pilot-ready.
 */
export type FeatureFlag =
  | "discover"
  | "circles"
  | "peerHelp"
  | "calendar"
  | "secondBrain"
  | "tutorMarketplace"
  | "booking"
  | "homework"
  | "operationsConsole"
  | "researchDashboard"
  | "grantPack"
  | "notifications"
  | "checkpoints"
  | "expertReviews"
  | "diagnosis"
  | "learningPlan"
  | "parentChildren"
  | "lessonIntelligence"
  | "lessonTranscription"
  | "lessonEngagementSignals"
  | "lessonAiCopilot"
  | "lessonSummaries"
  | "lessonFlashcards";

export const FEATURES: Record<FeatureFlag, boolean> = {
  // Live pilot v2 — marketplace + booking + calendar enabled
  tutorMarketplace: true,
  booking: true,
  calendar: true,

  // Hidden / future modules
  discover: false,
  circles: false,
  peerHelp: false,
  secondBrain: false,
  homework: true,

  // Live pilot v1 — enabled
  operationsConsole: true,
  researchDashboard: true,
  grantPack: true,
  notifications: true,
  checkpoints: true,
  expertReviews: true,
  diagnosis: true,
  learningPlan: true,
  parentChildren: true,

  // Lesson Intelligence v1
  lessonIntelligence: true,
  lessonTranscription: true,
  lessonEngagementSignals: true,
  lessonAiCopilot: true,
  lessonSummaries: true,
  lessonFlashcards: true,
};

export const isFeatureEnabled = (flag: FeatureFlag): boolean => FEATURES[flag] === true;
