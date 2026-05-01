import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Target } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { NextAction } from "@/hooks/useJourneyState";

type Props = {
  action: NextAction;
  childName?: string;
  footer?: React.ReactNode;
};

export function NextBestActionCard({ action, childName, footer }: Props) {
  const { t } = useTranslation();
  const pct = action.progress ? Math.round((action.progress.done / action.progress.total) * 100) : 0;
  return (
    <Surface className="p-5 border-accent/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent"><Target className="h-4 w-4" /></span>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{t("firstSuccess.cardTitle")}</p>
        {action.status === "complete" && <Badge variant="secondary" className="text-[10px]">{t("firstSuccess.complete")}</Badge>}
      </div>
      <h2 className="text-base font-semibold mb-1">
        {childName ? `${childName} — ` : ""}{t(action.labelKey)}
      </h2>
      <p className="text-xs text-muted-foreground mb-3 max-w-2xl">{t(action.descriptionKey)}</p>

      {action.progress && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">{t("firstSuccess.stepsProgress", { done: action.progress.done, total: action.progress.total })}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
          <Link to={action.route}>
            {t(action.labelKey)} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/getting-started">{t("firstSuccess.viewChecklist")}</Link>
        </Button>
      </div>

      {footer ?? (
        <p className="mt-3 text-[11px] text-muted-foreground">{t("firstSuccess.pilotNote")}</p>
      )}
    </Surface>
  );
}
