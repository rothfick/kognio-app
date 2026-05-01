import {
  LayoutDashboard, Search, Users, HandHelping, Calendar, Brain,
  Sparkles, ClipboardList, TrendingUp, FileText, FlaskConical, ShieldCheck,
  Bell, Settings as SettingsIcon, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRoles";
import type { FeatureFlag } from "@/config/features";

export type NavStatus = "live" | "beta" | "internal" | "hidden";

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** If empty/undefined, visible to any signed-in user. */
  allowedRoles?: AppRole[];
  /** If set, item only shows when this feature flag is true. */
  featureFlag?: FeatureFlag;
  showInHeader: boolean;
  showInSidebar?: boolean;
  status: NavStatus;
}

/**
 * Single source of truth for top-level navigation across the app.
 * The Header consumes this list and filters by role + feature flag + status.
 */
export const NAV_ITEMS: NavItem[] = [
  // ── Student ───────────────────────────────────────────────────────────
  {
    id: "studentDashboard",
    labelKey: "nav.dashboard",
    href: "/dashboard/student",
    icon: LayoutDashboard,
    allowedRoles: ["student"],
    showInHeader: true,
    status: "live",
  },
  {
    id: "diagnose",
    labelKey: "nav.diagnose",
    href: "/diagnose",
    icon: Sparkles,
    allowedRoles: ["student"],
    featureFlag: "diagnosis",
    showInHeader: true,
    status: "live",
  },

  // ── Parent ────────────────────────────────────────────────────────────
  {
    id: "parentDashboard",
    labelKey: "nav.parentDashboard",
    href: "/dashboard/parent",
    icon: LayoutDashboard,
    allowedRoles: ["parent"],
    showInHeader: true,
    status: "live",
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    id: "adminDashboard",
    labelKey: "nav.adminDashboard",
    href: "/dashboard/admin",
    icon: ShieldCheck,
    allowedRoles: ["admin"],
    showInHeader: true,
    status: "internal",
  },
  {
    id: "research",
    labelKey: "nav.research",
    href: "/admin/research",
    icon: FlaskConical,
    allowedRoles: ["admin"],
    featureFlag: "researchDashboard",
    showInHeader: true,
    status: "internal",
  },
  {
    id: "grantPack",
    labelKey: "nav.grantPack",
    href: "/admin/grant-pack",
    icon: FileText,
    allowedRoles: ["admin"],
    featureFlag: "grantPack",
    showInHeader: true,
    status: "internal",
  },

  // ── Tutor (kept for tutor accounts only) ──────────────────────────────
  {
    id: "tutorDashboard",
    labelKey: "nav.dashboard",
    href: "/dashboard/tutor",
    icon: LayoutDashboard,
    allowedRoles: ["tutor"],
    showInHeader: true,
    status: "live",
  },

  // ── Hidden / future modules (kept for reference, never rendered) ──────
  {
    id: "discover",
    labelKey: "nav.discover",
    href: "/discover",
    icon: Search,
    allowedRoles: ["student"],
    featureFlag: "discover",
    showInHeader: true,
    status: "hidden",
  },
  {
    id: "circles",
    labelKey: "nav.circles",
    href: "/circles",
    icon: Users,
    allowedRoles: ["student"],
    featureFlag: "circles",
    showInHeader: true,
    status: "hidden",
  },
  {
    id: "peer",
    labelKey: "nav.peer",
    href: "/peer",
    icon: HandHelping,
    allowedRoles: ["student"],
    featureFlag: "peerHelp",
    showInHeader: true,
    status: "hidden",
  },
  {
    id: "calendar",
    labelKey: "nav.calendar",
    href: "/calendar",
    icon: Calendar,
    featureFlag: "calendar",
    showInHeader: true,
    status: "hidden",
  },
  {
    id: "brain",
    labelKey: "nav.brain",
    href: "/brain",
    icon: Brain,
    featureFlag: "secondBrain",
    showInHeader: true,
    status: "hidden",
  },
];

/**
 * Returns visible nav items for a given set of roles.
 * Hidden / disabled items are always filtered out — they exist in code
 * only as future modules.
 */
export function getVisibleNavItems(opts: {
  roles: AppRole[];
  isFeatureEnabled: (flag: FeatureFlag) => boolean;
}): NavItem[] {
  const { roles, isFeatureEnabled } = opts;
  return NAV_ITEMS.filter((item) => {
    if (!item.showInHeader) return false;
    if (item.status === "hidden") return false;
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
    if (item.allowedRoles && item.allowedRoles.length > 0) {
      return item.allowedRoles.some((r) => roles.includes(r));
    }
    return true;
  });
}
