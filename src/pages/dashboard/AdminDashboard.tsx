import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/EmptyState";
import { ShieldCheck, AlertTriangle, Sparkles, Activity, ClipboardList, GraduationCap, Network, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [subjectsCount, setSubjectsCount] = useState<number | null>(null);
  const [kcCount, setKcCount] = useState<number | null>(null);
  const [edgeCount, setEdgeCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [s, k, e] = await Promise.all([
        supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("knowledge_components").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("kc_prerequisites").select("id", { count: "exact", head: true }),
      ]);
      setSubjectsCount(s.count ?? 0);
      setKcCount(k.count ?? 0);
      setEdgeCount(e.count ?? 0);
    })();
  }, []);

  return (
    <RoleGate allow={["admin"]} fallback="/dashboard">
      <AppShell>
        <DashboardShell>
          <DashboardHeader title={t("dashboard.adminTitle")} subtitle={t("dashboard.adminSubtitle")} />

          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <StatCard icon={ShieldCheck} label="Weryfikacje tutorów" value="0" hint="W kolejce" />
            <StatCard icon={AlertTriangle} label="Spory płatnicze" value="0" />
            <StatCard icon={Sparkles} label="Flagi AI" value="0" hint="Wymagające przeglądu" />
            <StatCard icon={Activity} label="Health" value="OK" hint="Wszystkie usługi działają" />
          </div>

          <Surface className="p-5 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-accent" /> Curriculum / KC ontology
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={BookOpen} label="Aktywne przedmioty" value={subjectsCount === null ? "…" : String(subjectsCount)} />
              <StatCard icon={GraduationCap} label="Aktywne KC" value={kcCount === null ? "…" : String(kcCount)} />
              <StatCard icon={Network} label="Powiązania prerekwizycji" value={edgeCount === null ? "…" : String(edgeCount)} />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Pełny edytor ontologii pojawi się w kolejnych iteracjach. Na razie dane seedowane przez migracje.
            </p>
          </Surface>

          <div className="grid gap-5 md:grid-cols-2">
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Weryfikacje tutorów</h2>
              <EmptyState icon={ShieldCheck} title="Brak nowych zgłoszeń" description="Tutorzy oczekujący na ręczną weryfikację pojawią się tutaj." />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" /> Spory płatnicze</h2>
              <EmptyState icon={AlertTriangle} title="Brak otwartych sporów" description="Po wdrożeniu auto-dispute (D+7) niezatwierdzone wpłaty trafią tutaj." />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Flagi AI</h2>
              <EmptyState icon={Sparkles} title="Brak flag AI" description="System filtruje treści wymagające przeglądu (np. tematy banowane)." />
            </Surface>
            <Surface className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-accent" /> Audit log</h2>
              <EmptyState icon={ClipboardList} title="Brak wpisów audytu" description="Wrażliwe akcje (zmiany ról, weryfikacje, edycje raportów) będą logowane tutaj." />
            </Surface>
          </div>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

export default AdminDashboard;
