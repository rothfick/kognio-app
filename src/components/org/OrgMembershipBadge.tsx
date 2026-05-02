import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { useMyOrganizations } from "@/hooks/useMyOrganizations";

/**
 * Small badge surfaced on dashboards for users that belong to one or more organizations.
 * No PII; only org names + role.
 */
export function OrgMembershipBadge() {
  const { t } = useTranslation();
  const { orgs, loading } = useMyOrganizations();
  if (loading || orgs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {orgs.slice(0, 3).map((o) => (
        <Link
          key={o.organization_id}
          to={`/org/${o.organization_id}`}
          className="no-underline"
          aria-label={`${t("orgPage.title")}: ${o.name}`}
        >
          <Badge variant="secondary" className="gap-1.5 hover:bg-secondary/80">
            <Building2 className="h-3 w-3" />
            <span className="font-medium">{o.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs">{t(`orgRole.${o.member_role}`, o.member_role)}</span>
          </Badge>
        </Link>
      ))}
    </div>
  );
}
