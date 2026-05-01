import { ReactNode } from "react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

/** Wraps a dashboard page so that only users with the right role can see it. */
export function RoleGate({
  allow,
  children,
  fallback = "/dashboard",
}: {
  allow: Array<"student" | "tutor" | "admin" | "parent">;
  children: ReactNode;
  fallback?: string;
}) {
  const { roles, loading, isStudent, isTutor, isAdmin } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">Ładowanie panelu…</div>
      </AppShell>
    );
  }

  const ok =
    (allow.includes("student") && isStudent) ||
    (allow.includes("tutor") && isTutor) ||
    (allow.includes("admin") && isAdmin) ||
    (allow.includes("parent") && roles.includes("parent" as any));

  if (!ok) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
