import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { AdminSubNav } from "./AdminSubNav";

/**
 * Consistent layout for every admin module page.
 * Enforces admin role guard and renders the shared admin sub-navigation.
 */
export function AdminPageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RoleGate allow={["admin"]} fallback="/dashboard">
      <AppShell>
        <DashboardShell>
          <AdminSubNav />
          <DashboardHeader title={title} subtitle={subtitle} actions={actions} />
          {children}
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
}
