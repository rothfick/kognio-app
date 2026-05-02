import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { BookOpen, Loader2, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Card = {
  id: string;
  front: string;
  back: string;
  explanation: string | null;
  status: string;
  due_at: string;
  ease: number | null;
  interval_days: number;
  repetitions: number;
  skill_area_label: string | null;
  owner_type: string;
};

type FilterKey = "due" | "active" | "archived";

export default function Flashcards() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("due");
  const [studyIdx, setStudyIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front, back, explanation, status, due_at, ease, interval_days, repetitions, skill_area_label, owner_type")
      .order("due_at", { ascending: true })
      .limit(500);
    if (error) toast.error(t("flashcards.loadingError"));
    setItems((data ?? []) as Card[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((c) => {
      if (filter === "archived") return c.status === "archived";
      if (c.status !== "active") return false;
      if (filter === "due") return new Date(c.due_at).getTime() <= now;
      return true;
    });
  }, [items, filter]);

  const startStudy = () => {
    if (filtered.length === 0) return;
    setStudyIdx(0);
    setRevealed(false);
  };

  const grade = async (quality: "remembered" | "hard" | "skip") => {
    if (studyIdx === null) return;
    const card = filtered[studyIdx];
    if (!card) return;

    // Lightweight SM-2-ish update
    let ease = Number(card.ease ?? 2.5);
    let interval = card.interval_days || 1;
    let reps = card.repetitions || 0;
    if (quality === "remembered") {
      reps += 1;
      ease = Math.min(2.8, ease + 0.1);
      interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
    } else if (quality === "hard") {
      reps = 0;
      ease = Math.max(1.3, ease - 0.2);
      interval = 1;
    } else {
      // skip — no change but push 10 minutes
      const next = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from("flashcards").update({ due_at: next }).eq("id", card.id);
      advance();
      return;
    }
    const due = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("flashcards")
      .update({ ease, interval_days: interval, repetitions: reps, due_at: due })
      .eq("id", card.id);
    if (error) toast.error(t("common.error"));
    advance();
  };

  const advance = () => {
    setRevealed(false);
    setStudyIdx((i) => {
      if (i === null) return null;
      const next = i + 1;
      if (next >= filtered.length) {
        toast.success(t("flashcards.studyComplete"));
        return null;
      }
      return next;
    });
  };

  const toggleArchive = async (card: Card) => {
    const next = card.status === "archived" ? "active" : "archived";
    const { error } = await supabase.from("flashcards").update({ status: next }).eq("id", card.id);
    if (error) { toast.error(t("common.error")); return; }
    await load();
  };

  const dateFmt = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  const studyCard = studyIdx !== null ? filtered[studyIdx] : null;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("flashcards.title")}
          subtitle={t("flashcards.subtitle")}
        />

        {studyCard ? (
          <Surface className="p-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{studyIdx! + 1} / {filtered.length}</span>
              {studyCard.skill_area_label && <Badge variant="outline">{studyCard.skill_area_label}</Badge>}
            </div>
            <div className="rounded-md border bg-muted/30 p-6 min-h-[160px] text-base">
              <p className="font-medium">{studyCard.front}</p>
              {revealed && (
                <div className="mt-4 border-t pt-4 space-y-2 text-sm">
                  <p>{studyCard.back}</p>
                  {studyCard.explanation && (
                    <p className="text-muted-foreground text-xs">{studyCard.explanation}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)}>{t("flashcards.reveal")}</Button>
              ) : (
                <>
                  <Button onClick={() => grade("remembered")} variant="default">
                    {t("flashcards.remembered")}
                  </Button>
                  <Button onClick={() => grade("hard")} variant="outline">
                    {t("flashcards.hard")}
                  </Button>
                  <Button onClick={() => grade("skip")} variant="ghost">
                    {t("flashcards.skip")}
                  </Button>
                </>
              )}
              <Button className="ml-auto" variant="ghost" onClick={() => { setStudyIdx(null); setRevealed(false); }}>
                {t("common.close")}
              </Button>
            </div>
          </Surface>
        ) : (
          <Surface className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["due", "active", "archived"] as FilterKey[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? "default" : "outline"}
                  onClick={() => setFilter(k)}
                >
                  {t(`flashcards.filter${k.charAt(0).toUpperCase()}${k.slice(1)}`)}
                </Button>
              ))}
              <div className="ml-auto">
                <Button onClick={startStudy} disabled={filtered.length === 0 || filter === "archived"}>
                  <BookOpen className="h-4 w-4 mr-1" />
                  {t("flashcards.study")}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={t("flashcards.empty")}
                description={t("flashcards.noFiltered")}
              />
            ) : (
              <ul className="divide-y">
                {filtered.map((c) => (
                  <li key={c.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.front}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.back}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                        {c.skill_area_label && <Badge variant="outline">{c.skill_area_label}</Badge>}
                        <span>{t("flashcards.due", { when: dateFmt(c.due_at) })}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggleArchive(c)}>
                      {c.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        )}
      </DashboardShell>
    </AppShell>
  );
}
