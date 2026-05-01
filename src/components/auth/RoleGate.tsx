import { ReactNode } from "react";
import { useUserRoles, AppRole } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

/** Wraps a dashboard page so that only users with the right role can see it. */
export function RoleGate({
  allow,
  children,
  fallback = "/dashboard",
}: {
  allow: AppRole[];
  children: ReactNode;
  fallback?: string;
}) {
  const { loading, roles } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">Ładowanie panelu…</div>
      </AppShell>
    );
  }

  const ok = allow.some((r) => roles.includes(r));
  if (!ok) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
