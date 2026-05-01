import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalIcon, FileText, Users, Wallet, Settings as SettingsIcon, ShieldCheck, AlertCircle,
} from "lucide-react";

const TutorDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [published, setPublished] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("tutor_profiles")
        .select("is_verified, is_published")
        .eq("user_id", user.id)
        .maybeSingle();
      setVerified(!!data?.is_verified);
      setPublished(!!data?.is_published);
    })();
  }, [user]);

  return (
    <RoleGate allow={["tutor"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("dashboard.tutorTitle")}
            subtitle={t("dashboard.tutorSubtitle")}
            primaryAction={{ label: t("tutorDash.settingsCta"), to: "/settings" }}
          />

          {verified === false && (
            <Surface variant="ai" className="p-5 mb-6 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-warning/15 text-warning">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{t("tutorDash.pendingTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("tutorDash.pendingBody")}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{t("tutorDash.pendingBadge")}</Badge>
            </Surface>
          )}

          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <StatCard icon={CalIcon} label={t("tutorDash.today")} value="0" hint={t("tutorDash.todayHint")} />
            <StatCard icon={FileText} label={t("tutorDash.notesTodo")} value="0" hint={t("tutorDash.notesHint")} />
            <StatCard icon={Users} label={t("tutorDash.activeStudents")} value="0" />
            <StatCard icon={Wallet} label={t("tutorDash.monthEarn")} value={new Intl.NumberFormat(i18n.language, { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(0)} hint={t("tutorDash.earnHint")} />
          </div>

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title={t("tutorDash.studentInsight")} className="md:col-span-2">
              <p>
                {t("tutorDash.studentInsightBody")}
              </p>
            </AIInsightCard>
            <Surface className="p-5">
              <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> {t("tutorDash.profileStatus")}
              </h3>
              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li>{t("tutorDash.verification")}: {verified ? t("tutorDash.yes") : t("tutorDash.pending")}</li>
                <li>{t("tutorDash.publication")}: {published ? t("tutorDash.visible") : t("tutorDash.hidden")}</li>
              </ul>
              <Button asChild variant="outline" size="sm" className="w-full mt-4">
                <Link to="/settings"><SettingsIcon className="h-3.5 w-3.5 mr-1.5" />{t("tutorDash.config")}</Link>
              </Button>
            </Surface>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CalIcon className="h-4 w-4 text-accent" /> {t("tutorDash.todayLessons")}</h2>
              <EmptyState icon={CalIcon} title={t("tutorDash.noLessonsTitle")} description={t("tutorDash.noLessonsDesc")} ctaLabel={t("tutorDash.setAvailability")} ctaTo="/settings" />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-accent" /> {t("tutorDash.afterLessonNotes")}</h2>
              <EmptyState icon={FileText} title={t("tutorDash.noNotesTitle")} description={t("tutorDash.noNotesDesc")} />
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default TutorDashboard;
