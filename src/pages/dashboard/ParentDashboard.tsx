import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LineChart, FileText, CreditCard, Plus, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Parent dashboard shell. The `parent` role is not yet in the DB enum
 * (planned for Phase 2 of TutorOS AI roadmap). Until then this page is
 * accessible only as a preview — RoleGate intentionally not applied.
 */
const ParentDashboard = () => {
  const { t } = useTranslation();
  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader title={t("dashboard.parentTitle")} subtitle={t("dashboard.parentSubtitle")} />

        <Surface variant="ai" className="p-5 mb-6 flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
            <Users className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1">Konto rodzica — wkrótce</p>
            <p className="text-xs text-muted-foreground">
              Wprowadzamy formalną rolę rodzica wraz z zarządzaniem kontami dzieci, zgodą RODO i podsumowaniami postępów. Ten panel pokazuje docelowy układ.
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">{t("dashboard.soonBadge")}</Badge>
        </Surface>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <StatCard icon={Users} label="Dzieci" value="0" hint="Dodaj profil dziecka" />
          <StatCard icon={LineChart} label="Średni postęp" value="—" hint="Po pierwszym tygodniu nauki" />
          <StatCard icon={FileText} label="Najnowszy raport" value="—" hint="Pojawi się po 4 lekcjach" />
        </div>

        <div className="grid gap-5 md:grid-cols-3 mb-6">
          <AIInsightCard title="Co warto wiedzieć" className="md:col-span-2">
            <p>
              Po każdym tygodniu nauki TutorOS AI wygeneruje krótki raport oparty na danych z lekcji, diagnozy i zadań domowych. Bez subiektywnych opinii.
            </p>
          </AIInsightCard>
          <Surface className="p-5">
            <h3 className="font-semibold mb-1 text-sm">Bezpieczeństwo</h3>
            <p className="text-xs text-muted-foreground">
              Konta dzieci poniżej 16 r.ż. wymagają zgody rodzica. Dane w UE.
            </p>
          </Surface>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Surface className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> Twoje dzieci</h2>
            <EmptyState
              icon={Plus}
              title="Brak dodanych dzieci"
              description="Po włączeniu roli rodzica będziesz mógł dodać profile dzieci i wyrazić zgodę RODO."
              ctaLabel="Dodaj dziecko"
              onCta={() => {}}
            />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              <Button variant="ghost" size="sm" disabled>Dodaj dziecko ({t("dashboard.soonBadge").toLowerCase()})</Button>
            </p>
          </Surface>
          <Surface className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Płatności</h2>
            <EmptyState
              icon={CreditCard}
              title="Brak płatności"
              description="Po zarezerwowaniu pierwszej lekcji zobaczysz tu metody płatności i statusy."
            />
          </Surface>
        </div>
      </DashboardShell>
    </AppShell>
  );
};

export default ParentDashboard;
