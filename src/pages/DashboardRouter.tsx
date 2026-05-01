import { Navigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";

const DashboardRouter = () => {
  const { loading, isAdmin, isTutor, isStudent, isParent, isSchool, isCompany } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">Ładowanie pulpitu…</div>
      </AppShell>
    );
  }

  if (isAdmin) return <Navigate to="/dashboard/admin" replace />;
  if (isSchool) return <Navigate to="/dashboard/school" replace />;
  if (isCompany) return <Navigate to="/dashboard/company" replace />;
  if (isParent) return <Navigate to="/dashboard/parent" replace />;
  if (isTutor && !isStudent) return <Navigate to="/dashboard/tutor" replace />;
  if (isStudent) return <Navigate to="/dashboard/student" replace />;
  if (isTutor) return <Navigate to="/dashboard/tutor" replace />;

  return <Navigate to="/onboarding" replace />;
};

export default DashboardRouter;
