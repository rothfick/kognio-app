import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { AdminSubNav } from "./AdminSubNav";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent layout for every admin module page.
 * Enforces admin role guard and renders the shared admin sub-navigation.
 *
 * `wide` switches the container to a larger max-width for data-dense pages
 * (Operational Console, Research, Grant Pack) so tables don't get cramped.
 */
export function AdminPageShell({
  title,
  subtitle,
  actions,
  primaryAction,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  primaryAction?: { label: string; to: string };
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <RoleGate allow={["admin"]} fallback="/dashboard">
      <AppShell>
        <div
          className={cn(
            "container mx-auto px-4 py-6 md:py-8",
            wide ? "max-w-7xl" : "max-w-6xl",
          )}
        >
          <AdminSubNav />
          <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                  {subtitle}
                </p>
              )}
            </div>
            {actions ? (
              <div className="self-start md:self-auto flex flex-wrap gap-2">
                {actions}
              </div>
            ) : primaryAction ? (
              <Button
                asChild
                className="bg-accent-gradient text-accent-foreground shadow-glow self-start md:self-auto"
              >
                <Link to={primaryAction.to}>
                  {primaryAction.label} <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
          {children}
        </div>
      </AppShell>
    </RoleGate>
  );
}
