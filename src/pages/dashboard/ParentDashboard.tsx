import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LineChart, FileText, Plus, BookOpen, ShieldCheck, Brain } from "lucide-react";
import { AddChildDialog } from "@/components/parent/AddChildDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ChildRow = {
  id: string;
  display_name: string;
  grade_level: string | null;
  primary_subject: string | null;
  consent_signed_at: string | null;
  consent_version: string | null;
  status: string;
};

const ParentDashboard = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("parent_children")
      .select("id, display_name, grade_level, primary_subject, consent_signed_at, consent_version, status")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setChildren((data || []) as ChildRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <RoleGate allow={["parent", "admin"]}>
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title="Pulpit rodzica"
            subtitle="Zarządzaj profilami dzieci i śledź ich postępy."
            actions={children.length > 0 ? <AddChildDialog onCreated={load} /> : undefined}
          />

          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <StatCard icon={Users} label="Dzieci" value={String(children.length)} hint="Powiązane z Twoim kontem" />
            <StatCard icon={LineChart} label="Średni postęp" value="—" hint="Po pierwszej diagnozie" />
            <StatCard icon={FileText} label="Najnowszy raport" value="—" hint="Po 4 lekcjach" />
          </div>

          <div className="grid gap-5 md:grid-cols-3 mb-6">
            <AIInsightCard title="Co warto wiedzieć" className="md:col-span-2">
              <p>
                Po każdym tygodniu nauki TutorOS AI wygeneruje krótki raport oparty na danych z lekcji, diagnozy i zadań domowych. Bez subiektywnych opinii.
              </p>
            </AIInsightCard>
            <Surface className="p-5">
              <h3 className="font-semibold mb-1 text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" /> Bezpieczeństwo
              </h3>
              <p className="text-xs text-muted-foreground">
                Konta dzieci poniżej 16 r.ż. wymagają zgody rodzica. Dane przechowujemy w UE.
              </p>
            </Surface>
          </div>

          <Surface className="p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" /> Twoje dzieci
            </h2>

            {loading ? (
              <p className="text-sm text-muted-foreground">Ładowanie…</p>
            ) : children.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icon={Plus}
                  title="Brak dodanych dzieci"
                  description="Dodaj profil dziecka, aby rozpocząć diagnozę i otrzymywać raporty postępów."
                />
                <div className="flex justify-center">
                  <AddChildDialog onCreated={load} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {children.map((c) => <ChildCard key={c.id} child={c} />)}
              </div>
            )}
          </Surface>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            Polityka prywatności · Zgoda rodzica/opiekuna · <em>Dokumenty prawne wymagają weryfikacji przed publicznym uruchomieniem.</em>
          </p>
        </DashboardShell>
      </AppShell>
    </RoleGate>
  );
};

const ChildCard = ({ child }: { child: ChildRow }) => {
  const [trackedKcs, setTrackedKcs] = useState<number | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [hasDiagnostic, setHasDiagnostic] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: m }, { data: la }] = await Promise.all([
        supabase.from("child_kc_mastery").select("mastery_prob").eq("child_id", child.id),
        supabase.from("diagnostic_attempts")
          .select("score")
          .eq("child_id", child.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = (m || []) as { mastery_prob: number }[];
      setTrackedKcs(rows.length);
      setAvg(rows.length ? rows.reduce((a, r) => a + Number(r.mastery_prob), 0) / rows.length : null);
      setHasDiagnostic(!!la);
      setLatestScore(la ? Number((la as any).score ?? 0) : null);
    })();
    return () => { cancelled = true; };
  }, [child.id]);

  return (
    <Surface className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">{child.display_name}</h3>
          <p className="text-xs text-muted-foreground">
            {child.grade_level || "—"} · {child.primary_subject || "Brak przedmiotu"}
          </p>
        </div>
        {child.consent_signed_at ? (
          <Badge variant="secondary" className="text-[10px]">Zgoda {child.consent_version || "v1"}</Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px]">Brak zgody</Badge>
        )}
      </div>

      <div className="rounded-md border bg-card-soft p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Brain className="h-3.5 w-3.5 text-accent" /> Mapa wiedzy
        </div>
        {trackedKcs === null ? (
          <p className="text-xs text-muted-foreground">Ładowanie…</p>
        ) : !hasDiagnostic ? (
          <p className="text-xs text-muted-foreground">Brak diagnozy — wykonaj pierwszy test, aby zbudować mapę wiedzy.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Wynik diagnozy v1: <span className="font-medium text-foreground">{Math.round((latestScore || 0) * 100)}%</span> · KC: <span className="font-medium text-foreground">{trackedKcs}</span> · Średni: <span className="font-medium text-foreground">{Math.round((avg || 0) * 100)}%</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        {!hasDiagnostic ? (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/diagnose`}>Zrób diagnozę AI</Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
            <Link to={`/parent/children/${child.id}/knowledge`}>Zobacz mapę wiedzy</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={`/parent/children/${child.id}/knowledge`}>Mapa wiedzy</Link>
        </Button>
      </div>
    </Surface>
  );
};

export default ParentDashboard;
