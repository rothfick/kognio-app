import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { useTranslation } from "react-i18next";

/**
 * Blokuje wybrane trasy dla użytkowników, którzy są WYŁĄCZNIE rodzicami
 * (nie są jednocześnie uczniem/tutorem/adminem). Rodzic nie powinien
 * wchodzić w interakcje uczniowskie (Discover, Circles, Peer, Diagnose itp.).
 */
export function ParentRouteGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, isParent, isStudent, isTutor, isAdmin } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">
          {t("common.loadingPanel")}
        </div>
      </AppShell>
    );
  }

  // Tylko rodzic (bez innej roli aktywnej) -> kierunek pulpit rodzica
  if (isParent && !isStudent && !isTutor && !isAdmin) {
    return <Navigate to="/dashboard/parent" replace />;
  }

  return <>{children}</>;
}
