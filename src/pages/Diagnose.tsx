import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate, useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Brain, Target, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Choice = { id: string; text: string };
type Item = { id: string; question: string; choices: Choice[]; kc_label: string; difficulty: number };
type Summary = {
  overall_level: string;
  score_pct: number;
  strengths: string[];
  gaps: string[];
  kc_breakdown: { kc_label: string; mastery_pct: number; status: "mocna" | "stabilna" | "do_pracy" | "luka" }[];
  recommendations: string[];
  next_subject_suggestion?: string;
};

const DOMAIN_SUGGESTIONS = [
  "Matematyka", "Fizyka", "Chemia", "Biologia",
  "Język angielski", "Język niemiecki", "Język hiszpański", "Język francuski",
  "Język polski", "Historia", "Geografia", "WOS",
  "Programowanie (Python)", "Programowanie (JavaScript)", "Algorytmy i struktury danych",
  "Bazy danych SQL", "Statystyka", "Ekonomia", "Rachunkowość",
  "Filozofia", "Sztuka i historia sztuki",
];

const LEVELS = [
  { id: "sp_4_6", label: "Szkoła podstawowa kl. 4-6" },
  { id: "sp_7_8", label: "Szkoła podstawowa kl. 7-8" },
  { id: "lo_1_2", label: "Liceum / Technikum kl. 1-2" },
  { id: "lo_3_4", label: "Liceum / Technikum kl. 3-4" },
  { id: "matura_podst", label: "Matura — poziom podstawowy" },
  { id: "matura_rozsz", label: "Matura — poziom rozszerzony" },
  { id: "studia_lic", label: "Studia licencjackie / inżynierskie" },
  { id: "studia_mgr", label: "Studia magisterskie / doktoranckie" },
  { id: "dorosly", label: "Dorosły / hobby / przekwalifikowanie" },
];

const TARGET = 12;

export default function Diagnose() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ childId?: string }>();
  const childId = params.childId ?? null;
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"intake" | "running" | "done">("intake");
  const [domain, setDomain] = useState("");
  const [level, setLevel] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; correct_choice: string } | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [score, setScore] = useState<{ pct: number; total: number; correct: number } | null>(null);

  const levelLabel = useMemo(() => LEVELS.find((l) => l.id === level)?.label ?? "", [level]);

  const start = useCallback(async () => {
    if (!domain.trim()) return toast.error("Podaj dziedzinę / przedmiot.");
    if (!level) return toast.error("Wybierz poziom.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-adaptive", {
        body: {
          action: "start",
          domain: domain.trim(),
          level: levelLabel,
          language: "pl",
          target_questions: TARGET,
          ...(childId ? { child_id: childId } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAttemptId((data as any).attempt_id);
      setItem((data as any).item);
      setQuestionIdx(1);
      setPhase("running");
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się rozpocząć diagnozy.");
    } finally {
      setSubmitting(false);
    }
  }, [domain, level, levelLabel, childId]);

  const submit = useCallback(async () => {
    if (!attemptId || !item) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostic-adaptive", {
        body: {
          action: "next",
          attempt_id: attemptId,
          item_id: item.id,
          selected_choice: selected === "__skip__" ? null : selected,
          target_questions: TARGET,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setFeedback(d.last ?? null);
      // brief feedback flash, then advance
      setTimeout(() => {
        setFeedback(null);
        if (d.done) {
          setSummary(d.summary);
          setScore({ pct: d.score_pct, total: d.total, correct: d.correct });
          setPhase("done");
        } else {
          setItem(d.item);
          setQuestionIdx(d.question_index);
          setSelected(null);
        }
      }, 700);
    } catch (e: any) {
      toast.error(e?.message || "Błąd zapisu odpowiedzi.");
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, item, selected]);

  if (authLoading) {
    return <AppShell><div className="container py-12 text-sm text-muted-foreground">Ładowanie…</div></AppShell>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to={childId ? `/parent/children/${childId}/knowledge` : "/dashboard"}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Wróć
            </Link>
          </Button>
        </div>

        {phase === "intake" && (
          <>
            <DashboardHeader
              title={childId ? "Diagnoza AI dziecka" : "Diagnoza AI"}
              subtitle="Adaptacyjny test 12 pytań. AI dobiera trudność i obszar wiedzy w locie. Działa dla DOWOLNEJ dziedziny i poziomu — od szkoły podstawowej po studia."
            />
            <Surface className="p-6 max-w-2xl space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dziedzina / przedmiot</label>
                <Input
                  placeholder="np. Matematyka, Język angielski, Programowanie w Python, Chemia organiczna…"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  maxLength={120}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DOMAIN_SUGGESTIONS.slice(0, 12).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDomain(s)}
                      className="text-[11px] rounded-full border px-2.5 py-1 hover:bg-muted text-muted-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Poziom</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLevel(l.id)}
                      className={`text-left text-sm rounded-md border px-3 py-2 transition-colors ${
                        level === l.id ? "border-accent bg-accent/10" : "hover:bg-muted"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={start}
                  disabled={submitting || !domain.trim() || !level}
                  size="lg"
                  className="bg-accent-gradient text-accent-foreground shadow-glow"
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Rozpocznij diagnozę AI
                </Button>
                <p className="text-[11px] text-muted-foreground mt-3">
                  Diagnoza trwa ~10-15 minut. Pytania generuje AI w czasie rzeczywistym, dopasowując trudność do Twoich odpowiedzi.
                </p>
              </div>
            </Surface>
          </>
        )}

        {phase === "running" && item && (
          <>
            <DashboardHeader
              title={`Diagnoza: ${domain}`}
              subtitle={`${levelLabel} • Pytanie ${questionIdx} z ${TARGET}`}
            />
            <Surface className="p-5 mb-4">
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <span>Postęp</span>
                <Badge variant="secondary" className="text-[10px]">AI adaptacyjna</Badge>
              </div>
              <Progress value={(questionIdx / TARGET) * 100} />
            </Surface>

            <Surface className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[11px] text-muted-foreground">{item.kc_label}</p>
                  <Badge variant="outline" className="text-[10px]">trudność {item.difficulty}/5</Badge>
                </div>
                <h2 className="text-base font-semibold whitespace-pre-wrap">{item.question}</h2>
              </div>

              <div className="grid gap-2">
                {item.choices.map((c) => {
                  const isFeedbackCorrect = feedback && c.id === feedback.correct_choice;
                  const isFeedbackWrong = feedback && selected === c.id && !feedback.correct;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !feedback && setSelected(c.id)}
                      disabled={!!feedback || submitting}
                      className={`text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                        isFeedbackCorrect ? "border-green-500 bg-green-500/10"
                          : isFeedbackWrong ? "border-destructive bg-destructive/10"
                          : selected === c.id ? "border-accent bg-accent/10"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-mono text-xs mr-2 text-muted-foreground">{c.id}.</span>
                      {c.text}
                    </button>
                  );
                })}
                <button
                  onClick={() => !feedback && setSelected("__skip__")}
                  disabled={!!feedback || submitting}
                  className={`text-left rounded-md border border-dashed px-4 py-2 text-xs text-muted-foreground transition-colors ${
                    selected === "__skip__" ? "border-accent bg-accent/10" : "hover:bg-muted"
                  }`}
                >
                  Nie wiem (pomiń)
                </button>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={submit}
                  disabled={selected === null || submitting || !!feedback}
                  className="bg-accent-gradient text-accent-foreground"
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {questionIdx === TARGET ? "Zakończ diagnozę" : "Następne pytanie"}
                  {!submitting && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </Surface>
          </>
        )}

        {phase === "done" && summary && score && (
          <>
            <DashboardHeader title="Wynik diagnozy" subtitle={`${domain} • ${levelLabel}`} />

            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <Surface className="p-5 md:col-span-1">
                <p className="text-xs text-muted-foreground">Wynik ogólny</p>
                <p className="text-3xl font-bold">{score.pct}%</p>
                <p className="text-xs text-muted-foreground mt-1">{score.correct} / {score.total} poprawnych</p>
                <Badge className="mt-3" variant="secondary">Poziom: {summary.overall_level}</Badge>
              </Surface>

              <Surface className="p-5 md:col-span-2">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Rekomendacje</h3>
                <ul className="space-y-1.5 text-sm list-disc pl-5">
                  {summary.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                {summary.next_subject_suggestion && (
                  <p className="text-xs text-muted-foreground mt-3">Sugerowany kolejny obszar: {summary.next_subject_suggestion}</p>
                )}
              </Surface>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <Surface className="p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Mocne strony
                </h3>
                {summary.strengths.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak wyraźnych mocnych stron — to świetna baza do nauki.</p>
                ) : (
                  <ul className="space-y-1 text-sm list-disc pl-5">{summary.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                )}
              </Surface>
              <Surface className="p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-destructive" /> Luki do nadrobienia
                </h3>
                {summary.gaps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Świetnie — nie wykryto wyraźnych luk.</p>
                ) : (
                  <ul className="space-y-1 text-sm list-disc pl-5">{summary.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                )}
              </Surface>
            </div>

            <Surface className="p-5 mb-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Brain className="h-4 w-4 text-accent" /> Mapa kompetencji</h3>
              <div className="space-y-2">
                {summary.kc_breakdown.map((k, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate">{k.kc_label}</span>
                    <div className="w-32"><Progress value={k.mastery_pct} /></div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{k.mastery_pct}%</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        k.status === "mocna" ? "border-green-500 text-green-600"
                        : k.status === "luka" ? "border-destructive text-destructive"
                        : k.status === "do_pracy" ? "border-amber-500 text-amber-600"
                        : ""
                      }`}
                    >
                      {k.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </Surface>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-accent-gradient text-accent-foreground">
                <Link to="/discover"><Target className="h-4 w-4 mr-1" /> Znajdź dopasowanego tutora</Link>
              </Button>
              <Button variant="outline" onClick={() => { setPhase("intake"); setSummary(null); setScore(null); setItem(null); setAttemptId(null); }}>
                Zrób kolejną diagnozę
              </Button>
              {childId && (
                <Button asChild variant="outline">
                  <Link to={`/parent/children/${childId}/knowledge`}><Brain className="h-4 w-4 mr-1" /> Mapa wiedzy dziecka</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
