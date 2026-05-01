import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";

const DashboardRouter = () => {
  const { t } = useTranslation();
  const { loading, isAdmin, isTutor, isStudent, isParent, isSchool, isCompany } = useUserRoles();
  const { user } = useAuth();
  const [progressChecked, setProgressChecked] = useState(false);
  const [hasMeaningfulProgress, setHasMeaningfulProgress] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // Only check for self/parent — admins, tutors, orgs go straight to their dashboards
    if (isAdmin || isSchool || isCompany || (isTutor && !isStudent && !isParent)) {
      setProgressChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      let progress = false;
      if (isParent) {
        const { count: childCount } = await supabase
          .from("parent_children").select("id", { count: "exact", head: true }).eq("parent_id", user.id);
        if ((childCount || 0) > 0) progress = true;
      }
      if (!progress) {
        const { count: diagCount } = await supabase
          .from("diagnostic_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        if ((diagCount || 0) > 0) progress = true;
      }
      if (!cancelled) {
        setHasMeaningfulProgress(progress);
        setProgressChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user, isAdmin, isSchool, isCompany, isTutor, isStudent, isParent]);

  if (loading || !progressChecked) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">{t("common.loadingDashboard")}</div>
      </AppShell>
    );
  }

  if (isAdmin) return <Navigate to="/dashboard/admin" replace />;
  if (isSchool) return <Navigate to="/dashboard/school" replace />;
  if (isCompany) return <Navigate to="/dashboard/company" replace />;

  // Rodzic ZAWSZE ma własny pulpit — bez getting-started, bez przekierowań na widoki uczniowskie
  if (isParent) return <Navigate to="/dashboard/parent" replace />;

  // First-success guidance: send students without meaningful progress to /getting-started
  if (isStudent && !hasMeaningfulProgress) {
    return <Navigate to="/getting-started" replace />;
  }
  if (isTutor && !isStudent) return <Navigate to="/dashboard/tutor" replace />;
  if (isStudent) return <Navigate to="/dashboard/student" replace />;
  if (isTutor) return <Navigate to="/dashboard/tutor" replace />;

  return <Navigate to="/onboarding" replace />;
};

export default DashboardRouter;
