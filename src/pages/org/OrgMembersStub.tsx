import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export default function OrgMembersStub() {
  const { t } = useTranslation();
  const { orgId } = useParams<{ orgId: string }>();
  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader title={t("orgPage.viewMembers")} icon={<Users className="h-6 w-6" />} />
        <Card className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">{t("orgPage.phaseBStub")}</p>
          <Button asChild variant="outline"><Link to={`/org/${orgId}`}>{t("common.back")}</Link></Button>
        </Card>
      </DashboardShell>
    </AppShell>
  );
}
