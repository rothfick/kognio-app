import { Navigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";

/** Routes /dashboard to the right role-specific dashboard. */
const DashboardRouter = () => {
  const { loading, isAdmin, isTutor, isStudent, roles } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">Ładowanie pulpitu…</div>
      </AppShell>
    );
  }

  if (isAdmin) return <Navigate to="/dashboard/admin" replace />;
  // parent role isn't in the DB enum yet — once it ships, redirect first.
  if (roles.includes("parent" as any)) return <Navigate to="/dashboard/parent" replace />;
  if (isTutor && !isStudent) return <Navigate to="/dashboard/tutor" replace />;
  if (isStudent) return <Navigate to="/dashboard/student" replace />;
  if (isTutor) return <Navigate to="/dashboard/tutor" replace />;

  // Fallback: send to onboarding to pick a role.
  return <Navigate to="/onboarding" replace />;
};

export default DashboardRouter;
