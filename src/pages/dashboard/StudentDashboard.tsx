import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { MasteryBadge } from "@/components/ui/mastery-badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Calendar as CalIcon, ClipboardList, Sparkles, BookOpen, ArrowRight, Search,
} from "lucide-react";

const StudentDashboard = () => {
  const { t } = useTranslation();
  return (
    <RoleGate allow={["student"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={t("dashboard.studentTitle")}
            subtitle={t("dashboard.studentSubtitle")}
            primaryAction={{ label: t("dashboard.diagnoseCta"), to: "/dashboard/student" }}
          />

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard icon={Brain} label="Średnie opanowanie" value="—" hint="Pojawi się po pierwszej diagnozie" />
            <StatCard icon={CalIcon} label="Najbliższa lekcja" value="—" hint="Brak zaplanowanych" />
            <StatCard icon={ClipboardList} label="Zadania domowe" value="0" hint="Wszystko ogarnięte" />
          </div>

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title="Następny krok" className="md:col-span-2">
              <p>
                Diagnoza wstępna v1 jest obecnie uruchamiana z konta rodzica (Diagnoza v1 dla profili dzieci). Pełna diagnoza adaptacyjna AI dla konta ucznia pojawi się w kolejnym etapie.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/discover">
                    Znajdź korepetytora <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </AIInsightCard>
            <Surface className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Twoje opanowanie</p>
                <Badge variant="secondary" className="text-[10px]">{t("dashboard.soonBadge")}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MasteryBadge level="unknown" />
                <MasteryBadge level="unknown" />
                <MasteryBadge level="unknown" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Mapa wiedzy zbuduje się po pierwszej diagnozie.</p>
            </Surface>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CalIcon className="h-4 w-4 text-accent" /> Najbliższe lekcje</h2>
              <EmptyState
                icon={Search}
                title="Brak zaplanowanych lekcji"
                description="Po diagnozie zaproponujemy Ci dopasowanego korepetytora."
                ctaLabel="Znajdź tutora"
                ctaTo="/discover"
              />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> Zadania domowe</h2>
              <EmptyState
                icon={Sparkles}
                title="Brak zadań"
                description="Po pierwszej lekcji pojawią się tu spersonalizowane ćwiczenia."
              />
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default StudentDashboard;
