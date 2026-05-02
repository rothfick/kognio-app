import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setOnboarded(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setOnboarded(!!data?.onboarded_at);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading || (user && onboarded === null)) {
    return <div className="grid min-h-[50vh] place-items-center text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
