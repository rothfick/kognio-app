import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { isFeatureEnabled, type FeatureFlag } from "@/config/features";

interface Props {
  feature: FeatureFlag;
  /** When true, admins bypass the guard for internal previews. */
  allowAdminPreview?: boolean;
  children: ReactNode;
}

/**
 * Gates a route behind a frontend feature flag. When the feature is
 * disabled, renders a polished, translated "not available yet" page.
 * Admins can optionally bypass for internal previews.
 */
export function FeatureRouteGuard({ feature, allowAdminPreview = false, children }: Props) {
  const { t } = useTranslation();
  const { isAdmin, loading } = useUserRoles();

  if (loading) {
    return (
      <AppShell>
        <div className="container py-12 text-muted-foreground text-sm">
          {t("common.loadingPanel")}
        </div>
      </AppShell>
    );
  }

  const enabled = isFeatureEnabled(feature);
  if (enabled || (allowAdminPreview && isAdmin)) {
    return <>{children}</>;
  }

  return (
    <AppShell>
      <div className="container py-16 max-w-xl">
        <Surface className="p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold mb-2">{t("routeGuard.notAvailableTitle")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("routeGuard.notAvailableBody")}</p>
          <Button asChild className="bg-accent-gradient text-accent-foreground">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("routeGuard.backToDashboard")}
            </Link>
          </Button>
        </Surface>
      </div>
    </AppShell>
  );
}
