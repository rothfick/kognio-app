import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Users, Layers, GraduationCap } from "lucide-react";

interface OrgInfo {
  id: string;
  name: string;
  org_type: string;
  status: string;
  description: string | null;
  country_code: string | null;
  owner_id: string;
}

export default function OrgPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState(0);
  const [cohortsCount, setCohortsCount] = useState(0);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!orgId || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: o, error } = await supabase
        .from("organizations")
        .select("id,name,org_type,status,description,country_code,owner_id")
        .eq("id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !o) { setForbidden(true); setLoading(false); return; }
      setOrg(o as OrgInfo);

      const [{ count: m }, { count: c }, { data: meRow }] = await Promise.all([
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("cohorts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("organization_members").select("member_role").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setMembers(m || 0);
      setCohortsCount(c || 0);
      setMyRole((meRow as any)?.member_role || (o.owner_id === user.id ? "owner" : null));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, user]);

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={org?.name || t("orgPage.title")}
          subtitle={org ? `${t(`adminOrgs.type.${org.org_type}`)} · ${t(`adminOrgs.status.${org.status}`)}${myRole ? ` · ${t("orgPage.yourRole")}: ${t(`orgRole.${myRole}`, myRole)}` : ""}` : t("common.loadingPanel")}
          icon={<Building2 className="h-6 w-6" />}
        />

        {loading ? (
          <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <StatCard icon={Users} label={t("orgPage.stats.members")} value={String(members)} />
              <StatCard icon={Layers} label={t("orgPage.stats.cohorts")} value={String(cohortsCount)} />
              <StatCard icon={GraduationCap} label={t("orgPage.stats.status")} value={t(`adminOrgs.status.${org?.status || "active"}`)} />
            </div>

            {org?.description && (
              <Card className="p-4">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{org.description}</div>
              </Card>
            )}

            <Card className="p-4 space-y-3">
              <div className="font-medium">{t("orgPage.quickActions")}</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><Link to={`/org/${orgId}/cohorts`}>{t("orgPage.viewCohorts")}</Link></Button>
                <Button asChild variant="outline"><Link to={`/org/${orgId}/members`}>{t("orgPage.viewMembers")}</Link></Button>
                <Button asChild variant="outline" disabled><Link to="#">{t("orgPage.viewProgress")} · {t("common.comingSoon")}</Link></Button>
                <Button asChild variant="outline" disabled><Link to="#">{t("orgPage.viewReports")} · {t("common.comingSoon")}</Link></Button>
              </div>
              <div className="text-xs text-muted-foreground">{t("orgPage.phaseANote")}</div>
            </Card>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
