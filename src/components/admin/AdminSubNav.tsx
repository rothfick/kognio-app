import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Activity, ShieldCheck, Telescope, Network, BadgeCheck,
  ShoppingBag, Building2, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; labelKey: string; icon: LucideIcon };
type Group = { labelKey: string; items: Item[] };

const GROUPS: Group[] = [
  {
    labelKey: "adminNav.groupPlatform",
    items: [
      { to: "/dashboard/admin", labelKey: "adminNav.overview", icon: LayoutDashboard },
      { to: "/admin/operations", labelKey: "adminNav.operations", icon: Activity },
      { to: "/admin/launch-checklist", labelKey: "adminNav.launchChecklist", icon: ShieldCheck },
    ],
  },
  {
    labelKey: "adminNav.groupLearning",
    items: [
      { to: "/admin/research", labelKey: "adminNav.research", icon: Telescope },
      { to: "/admin/curriculum", labelKey: "adminNav.curriculum", icon: Network },
      { to: "/admin/expert-reviews", labelKey: "adminNav.expertReviews", icon: BadgeCheck },
    ],
  },
  {
    labelKey: "adminNav.groupBusiness",
    items: [
      { to: "/admin/marketplace", labelKey: "adminNav.marketplace", icon: ShoppingBag },
      { to: "/admin/organizations", labelKey: "adminNav.organizations", icon: Building2 },
    ],
  },
  {
    labelKey: "adminNav.groupFunding",
    items: [
      { to: "/admin/grant-pack", labelKey: "adminNav.grantPack", icon: FileText },
    ],
  },
];

/**
 * Compact secondary navigation rendered at the top of every admin page.
 * Single-row, horizontally scrollable on small screens, with subtle
 * dividers between groups so it never grows tall enough to push content.
 */
export function AdminSubNav() {
  const { t } = useTranslation();
  const allItems = GROUPS.flatMap((g, gi) =>
    g.items.map((it, ii) => ({ ...it, groupIdx: gi, isFirstInGroup: ii === 0 })),
  );

  return (
    <nav
      aria-label={t("adminNav.aria")}
      className="mb-4 -mx-1 overflow-x-auto scrollbar-thin"
    >
      <div className="flex items-center gap-1 px-1 pb-1 min-w-max">
        {allItems.map((it, idx) => (
          <div key={it.to} className="flex items-center gap-1">
            {it.isFirstInGroup && idx !== 0 && (
              <span aria-hidden className="mx-1 h-4 w-px bg-border/70" />
            )}
            <NavLink
              to={it.to}
              end
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )
              }
            >
              <it.icon className="h-3.5 w-3.5" />
              <span>{t(it.labelKey)}</span>
            </NavLink>
          </div>
        ))}
      </div>
    </nav>
  );
}
