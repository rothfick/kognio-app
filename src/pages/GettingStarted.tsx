import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check, Lock, ArrowRight, Circle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useNextBestAction, useSelfJourney, useParentJourney, computeChildNextAction } from "@/hooks/useJourneyState";

type Step = {
  key: string;
  status: "done" | "current" | "locked";
  route: string;
  ctaKey: string;
  estMin: number;
};

function StepRow({ index, step, titleKey, descKey }: { index: number; step: Step; titleKey: string; descKey: string }) {
  const { t } = useTranslation();
  const Icon = step.status === "done" ? Check : step.status === "current" ? Circle : Lock;
  const tone = step.status === "done"
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : step.status === "current"
      ? "bg-accent/15 text-accent"
      : "bg-muted text-muted-foreground";
  return (
    <li className="flex items-start gap-4 rounded-lg border bg-card-soft p-4">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-sm">
            <span className="text-muted-foreground tabular-nums mr-1.5">{index + 1}.</span>{t(titleKey)}
          </h3>
          <Badge variant="secondary" className="text-[10px]">{t("gettingStarted.estMin", { min: step.estMin })}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t(descKey)}</p>
        {step.status !== "locked" && (
          <Button asChild size="sm" variant={step.status === "done" ? "outline" : "default"} className={step.status === "current" ? "mt-3 bg-accent-gradient text-accent-foreground" : "mt-3"}>
            <Link to={step.route}>{t(step.ctaKey)} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        )}
      </div>
    </li>
  );
}

const SelfChecklist = () => {
  const { t } = useTranslation();
  const j = useSelfJourney();

  if (j.loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const steps: { titleKey: string; descKey: string; step: Step }[] = [
    {
      titleKey: "gettingStarted.self.s1.title", descKey: "gettingStarted.self.s1.desc",
      step: { key: "consent", status: j.hasAiConsent ? "done" : "current", route: "/diagnose?step=consent", ctaKey: "gettingStarted.self.s1.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.self.s2.title", descKey: "gettingStarted.self.s2.desc",
      step: { key: "pick", status: !j.hasAiConsent ? "locked" : (j.hasDiagnosisCompleted || j.hasDiagnosisInProgress) ? "done" : "current", route: "/diagnose", ctaKey: "gettingStarted.self.s2.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.self.s3.title", descKey: "gettingStarted.self.s3.desc",
      step: { key: "diag", status: !j.hasAiConsent ? "locked" : j.hasDiagnosisCompleted ? "done" : "current", route: "/diagnose", ctaKey: "gettingStarted.self.s3.cta", estMin: 4 },
    },
    {
      titleKey: "gettingStarted.self.s4.title", descKey: "gettingStarted.self.s4.desc",
      step: { key: "result", status: !j.hasDiagnosisCompleted ? "locked" : "current", route: j.latestAttemptId ? `/diagnose?attempt=${j.latestAttemptId}` : "/dashboard/student", ctaKey: "gettingStarted.self.s4.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.self.s5.title", descKey: "gettingStarted.self.s5.desc",
      step: { key: "plan", status: !j.hasDiagnosisCompleted ? "locked" : j.hasPlan ? "done" : "current", route: j.planId ? `/plans/${j.planId}` : (j.latestAttemptId ? `/diagnose?attempt=${j.latestAttemptId}` : "/diagnose"), ctaKey: "gettingStarted.self.s5.cta", estMin: 2 },
    },
  ];
  // First non-done is current
  let currentSet = false;
  steps.forEach((s) => {
    if (s.step.status === "done") return;
    if (s.step.status === "locked") return;
    if (currentSet) s.step.status = "locked";
    currentSet = true;
  });

  const done = steps.filter((s) => s.step.status === "done").length;
  const total = steps.length;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <Surface className="p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{t("gettingStarted.progressTitle")}</p>
          <span className="text-xs text-muted-foreground tabular-nums">{done}/{total} · {pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </Surface>
      <ol className="space-y-3">
        {steps.map((s, i) => <StepRow key={s.step.key} index={i} step={s.step} titleKey={s.titleKey} descKey={s.descKey} />)}
      </ol>
    </>
  );
};

const ParentChecklist = () => {
  const { t } = useTranslation();
  const p = useParentJourney();

  if (p.loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  // Use first child if exists, else show "add child" as the only step
  const child = p.children[0];

  const steps: { titleKey: string; descKey: string; step: Step }[] = [
    {
      titleKey: "gettingStarted.parent.s1.title", descKey: "gettingStarted.parent.s1.desc",
      step: { key: "child", status: child ? "done" : "current", route: "/dashboard/parent", ctaKey: "gettingStarted.parent.s1.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.parent.s2.title", descKey: "gettingStarted.parent.s2.desc",
      step: { key: "consent", status: !child ? "locked" : child.hasConsent ? "done" : "current", route: child ? `/parent/children/${child.childId}/diagnose` : "/dashboard/parent", ctaKey: "gettingStarted.parent.s2.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.parent.s3.title", descKey: "gettingStarted.parent.s3.desc",
      step: { key: "diag", status: !child || !child.hasConsent ? "locked" : child.hasDiagnosisCompleted ? "done" : "current", route: child ? `/parent/children/${child.childId}/diagnose` : "/dashboard/parent", ctaKey: "gettingStarted.parent.s3.cta", estMin: 5 },
    },
    {
      titleKey: "gettingStarted.parent.s4.title", descKey: "gettingStarted.parent.s4.desc",
      step: { key: "map", status: !child || !child.hasDiagnosisCompleted ? "locked" : "current", route: child ? `/parent/children/${child.childId}/knowledge` : "/dashboard/parent", ctaKey: "gettingStarted.parent.s4.cta", estMin: 1 },
    },
    {
      titleKey: "gettingStarted.parent.s5.title", descKey: "gettingStarted.parent.s5.desc",
      step: { key: "plan", status: !child || !child.hasDiagnosisCompleted ? "locked" : child.planId ? "done" : "current", route: child?.planId ? `/plans/${child.planId}` : (child ? `/parent/children/${child.childId}/knowledge` : "/dashboard/parent"), ctaKey: "gettingStarted.parent.s5.cta", estMin: 2 },
    },
  ];
  let currentSet = false;
  steps.forEach((s) => {
    if (s.step.status === "done" || s.step.status === "locked") return;
    if (currentSet) s.step.status = "locked";
    currentSet = true;
  });

  const done = steps.filter((s) => s.step.status === "done").length;
  const total = steps.length;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <Surface className="p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{t("gettingStarted.progressTitle")}</p>
          <span className="text-xs text-muted-foreground tabular-nums">{done}/{total} · {pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </Surface>
      <ol className="space-y-3">
        {steps.map((s, i) => <StepRow key={s.step.key} index={i} step={s.step} titleKey={s.titleKey} descKey={s.descKey} />)}
      </ol>
      {p.children.length > 1 && (
        <Surface className="mt-5 p-4">
          <p className="text-xs text-muted-foreground mb-2">{t("gettingStarted.parent.otherChildren")}</p>
          <ul className="space-y-2">
            {p.children.slice(1).map((c) => {
              const a = computeChildNextAction(c);
              return (
                <li key={c.childId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium truncate">{c.displayName}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link to={a.route}>{t(a.labelKey)} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}
    </>
  );
};

const GettingStarted = () => {
  const { t } = useTranslation();
  const { isParent, isAdmin, loading } = useUserRoles();
  // Pre-warm hook so post-login redirect logic is consistent (unused output)
  useNextBestAction();

  if (loading) {
    return (
      <AppShell>
        <DashboardShell>
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </DashboardShell>
      </AppShell>
    );
  }

  const titleKey = isParent ? "gettingStarted.parent.title" : "gettingStarted.self.title";
  const subtitleKey = isParent ? "gettingStarted.parent.subtitle" : "gettingStarted.self.subtitle";

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t(titleKey)}
          subtitle={t(subtitleKey)}
          primaryAction={{ label: t("gettingStarted.dashboardCta"), to: isAdmin ? "/dashboard/admin" : isParent ? "/dashboard/parent" : "/dashboard/student" }}
        />

        {isParent ? <ParentChecklist /> : <SelfChecklist />}

        <Surface className="mt-6 p-5 border-accent/20">
          <p className="text-xs text-muted-foreground">{t("firstSuccess.pilotNote")}</p>
        </Surface>
      </DashboardShell>
    </AppShell>
  );
};

export default GettingStarted;
