import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { AIInsightCard } from "@/components/ui/ai-insight-card";
import { MasteryBadge } from "@/components/ui/mastery-badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Brain, Plus, Target, Loader2, Archive, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Child = { id: string; display_name: string; grade_level: string | null; primary_subject: string | null };
type KC = { id: string; code: string; name_pl: string; parent_kc_id: string | null; order_index: number };
type Mastery = { kc_id: string; mastery_prob: number; source: string | null; last_updated: string | null };
type Goal = { id: string; title: string; description: string | null; target_date: string | null; status: string; created_at: string };
type LatestAttempt = { id: string; status: string; score: number | null; correct_items: number; total_items: number; completed_at: string | null };

const SUBJECT_CODE = "math_7_9";

function masteryLevel(p: number | undefined): "unknown" | "novice" | "developing" | "proficient" | "mastered" {
  if (p === undefined) return "unknown";
  if (p < 0.25) return "novice";
  if (p < 0.5) return "developing";
  if (p < 0.8) return "proficient";
  return "mastered";
}

const ChildKnowledge = () => {
  const { childId } = useParams<{ childId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();

  const [child, setChild] = useState<Child | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [groups, setGroups] = useState<KC[]>([]);
  const [kcs, setKcs] = useState<KC[]>([]);
  const [mastery, setMastery] = useState<Record<string, Mastery>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [latestAttempt, setLatestAttempt] = useState<LatestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    if (!user || !childId) return;
    setLoading(true);

    // Child (RLS: only owner parent or admin can read parent_children)
    const { data: c, error: cErr } = await supabase
      .from("parent_children")
      .select("id, display_name, grade_level, primary_subject, parent_id")
      .eq("id", childId)
      .maybeSingle();
    if (cErr || !c) { setDenied(true); setLoading(false); return; }
    if (c.parent_id !== user.id && !isAdmin) { setDenied(true); setLoading(false); return; }
    setChild({ id: c.id, display_name: c.display_name, grade_level: c.grade_level, primary_subject: c.primary_subject });

    // Subject
    const { data: subj } = await supabase
      .from("subjects").select("id").eq("code", SUBJECT_CODE).maybeSingle();
    if (!subj) { setLoading(false); return; }
    setSubjectId(subj.id);

    // KCs (groups + children)
    const { data: allKcs } = await supabase
      .from("knowledge_components")
      .select("id, code, name_pl, parent_kc_id, order_index")
      .eq("subject_id", subj.id)
      .eq("is_active", true)
      .order("order_index");
    const list = (allKcs || []) as KC[];
    setGroups(list.filter((k) => !k.parent_kc_id));
    setKcs(list.filter((k) => k.parent_kc_id));

    // Mastery
    const { data: m } = await supabase
      .from("child_kc_mastery")
      .select("kc_id, mastery_prob, source, last_updated")
      .eq("child_id", childId);
    const map: Record<string, Mastery> = {};
    (m as Mastery[] | null)?.forEach((r) => { map[r.kc_id] = r; });
    setMastery(map);

    // Latest completed attempt
    const { data: la } = await supabase
      .from("diagnostic_attempts")
      .select("id, status, score, correct_items, total_items, completed_at")
      .eq("child_id", childId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestAttempt((la as LatestAttempt) || null);

    // Goals
    const { data: g } = await supabase
      .from("learning_goals")
      .select("id, title, description, target_date, status, created_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });
    setGoals((g || []) as Goal[]);

    setLoading(false);
  }, [user, childId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (authLoading || rolesLoading) {
    return <AppShell><div className="container py-12 text-muted-foreground text-sm">Ładowanie…</div></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (denied) return <Navigate to="/dashboard/parent" replace />;

  const trackedCount = Object.keys(mastery).length;
  const avgMastery = trackedCount === 0 ? 0 : Object.values(mastery).reduce((a, b) => a + b, 0) / trackedCount;

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/parent"><ArrowLeft className="h-4 w-4 mr-1" /> Powrót do pulpitu</Link>
          </Button>
        </div>

        <DashboardHeader
          title={child ? `Mapa wiedzy — ${child.display_name}` : "Mapa wiedzy"}
          subtitle="Matematyka klasy 7–9. Po pierwszej diagnozie tutaj pojawią się realne poziomy opanowania."
        />

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <StatCard icon={BookOpen} label="Komponenty wiedzy" value={String(kcs.length)} hint="W aktywnym programie" />
          <StatCard icon={Brain} label="Śledzone KC" value={String(trackedCount)} hint={trackedCount ? "Po diagnozie/lekcjach" : "Brak diagnozy"} />
          <StatCard icon={Target} label="Średni poziom" value={trackedCount ? `${Math.round(avgMastery * 100)}%` : "—"} hint="0–100%" />
        </div>

        <AIInsightCard title="Diagnoza AI" className="mb-6">
          <p>Diagnoza AI będzie dostępna w kolejnym kroku. Wtedy mapa wiedzy zacznie się wypełniać realnymi poziomami opanowania.</p>
        </AIInsightCard>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie mapy wiedzy…</p>
        ) : groups.length === 0 ? (
          <EmptyState icon={BookOpen} title="Brak danych programu" description="Skontaktuj się z administratorem." />
        ) : (
          <div className="space-y-5 mb-8">
            {groups.map((g) => {
              const childKcs = kcs.filter((k) => k.parent_kc_id === g.id);
              return (
                <Surface key={g.id} className="p-5">
                  <h2 className="font-semibold mb-3 text-base">{g.name_pl}</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {childKcs.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-3 rounded-md border bg-card-soft px-3 py-2">
                        <span className="text-sm">{k.name_pl}</span>
                        <MasteryBadge level={masteryLevel(mastery[k.id])} />
                      </li>
                    ))}
                  </ul>
                </Surface>
              );
            })}
          </div>
        )}

        <GoalsSection
          childId={childId!}
          subjectId={subjectId}
          goals={goals}
          createdById={user.id}
          onChange={load}
        />

        <p className="mt-8 text-[11px] text-muted-foreground text-center">
          Dane programu są wersją MVP. Mapa wiedzy będzie ewoluować z każdym etapem produktu.
        </p>
      </DashboardShell>
    </AppShell>
  );
};

function GoalsSection({
  childId, subjectId, goals, createdById, onChange,
}: {
  childId: string; subjectId: string | null; goals: Goal[]; createdById: string; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Podaj tytuł celu."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("learning_goals").insert({
        child_id: childId,
        subject_id: subjectId,
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
        status: "active",
        created_by: createdById,
      });
      if (error) throw error;
      toast.success("Cel został dodany.");
      setTitle(""); setDescription(""); setTargetDate("");
      setOpen(false);
      onChange();
    } catch (err: any) {
      toast.error(err.message || "Nie udało się dodać celu.");
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    const { error } = await supabase.from("learning_goals").update({ status: "archived" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cel zarchiwizowany."); onChange(); }
  };

  const active = goals.filter((g) => g.status === "active");

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-accent" /> Cele nauki</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent-gradient text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> Dodaj cel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowy cel nauki</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-title">Tytuł *</Label>
                <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Poprawić procenty i równania przed sprawdzianem." required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-desc">Opis</Label>
                <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-date">Data docelowa</Label>
                <Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={submitting} className="bg-accent-gradient text-accent-foreground">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Zapisz cel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={Target} title="Brak celów" description="Dodaj pierwszy cel, aby ukierunkować naukę dziecka." />
      ) : (
        <ul className="space-y-2">
          {active.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-3 rounded-md border bg-card-soft px-3 py-3">
              <div>
                <p className="text-sm font-medium">{g.title}</p>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                {g.target_date && <p className="text-[11px] text-muted-foreground mt-1">Termin: {g.target_date}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => archive(g.id)}>
                <Archive className="h-4 w-4 mr-1" /> Archiwizuj
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

export default ChildKnowledge;
