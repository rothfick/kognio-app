import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain as BrainIcon, Sparkles, FileText, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const Brain = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState<{ id: string; text: string; created_at: string }[]>([]);
  const [reports, setReports] = useState<{ id: string; summary: string | null; strengths: string | null; weaknesses: string | null; flashcards: any; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: tr }, { data: rp }] = await Promise.all([
        supabase.from("session_transcripts").select("id, text, created_at").order("created_at", { ascending: false }).limit(30),
        supabase.from("session_reports").select("id, summary, strengths, weaknesses, flashcards, created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      setTranscripts(tr || []);
      setReports((rp as any) || []);
    })();
  }, [user]);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true); setAnswer("");
    const question = q;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Błąd ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) { full += delta; setAnswer(full); }
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const allFlashcards = reports.flatMap((r) => Array.isArray(r.flashcards) ? r.flashcards : []);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-hero text-primary-foreground"><BrainIcon className="h-5 w-5" /></div>
          <h1 className="text-4xl font-bold">{t("brain.title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t("brain.subtitle")}</p>

        <Card className="p-5 mb-8 bg-card-soft shadow-soft">
          <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2">
            <Input placeholder={t("brain.askPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} disabled={loading} />
            <Button type="submit" className="bg-accent-gradient text-accent-foreground" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}{t("brain.ask")}
            </Button>
          </form>
          {answer && (
            <Card className="p-4 mt-4 bg-background border-accent/30">
              <p className="text-sm whitespace-pre-wrap">{answer}</p>
            </Card>
          )}
        </Card>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Raporty sesji</TabsTrigger>
            <TabsTrigger value="transcripts">{t("brain.transcripts")}</TabsTrigger>
            <TabsTrigger value="flashcards">{t("brain.flashcards")} ({allFlashcards.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4 space-y-3">
            {reports.length === 0 ? <p className="text-muted-foreground">Brak raportów. Wygeneruj jeden po sesji w pokoju.</p> :
              reports.map((r) => (
                <Card key={r.id} className="p-4 bg-card-soft">
                  <p className="text-xs text-muted-foreground mb-2">{new Date(r.created_at).toLocaleString()}</p>
                  {r.summary && <p className="mb-2">{r.summary}</p>}
                  {r.strengths && <p className="text-sm"><span className="font-semibold text-accent">✓ Mocne strony:</span> {r.strengths}</p>}
                  {r.weaknesses && <p className="text-sm"><span className="font-semibold text-destructive">→ Do pracy:</span> {r.weaknesses}</p>}
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="transcripts" className="mt-4">
            {transcripts.length === 0 ? <p className="text-muted-foreground">{t("brain.noTranscripts")}</p> : (
              <div className="space-y-2">
                {transcripts.map((tr) => (
                  <Card key={tr.id} className="p-4 flex gap-3 bg-card-soft">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm">{tr.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(tr.created_at).toLocaleString()}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="flashcards" className="mt-4">
            {allFlashcards.length === 0 ? <p className="text-muted-foreground">Fiszki pojawią się po wygenerowaniu raportu.</p> : (
              <div className="grid md:grid-cols-2 gap-3">
                {allFlashcards.map((f: any, i: number) => (
                  <Card key={i} className="p-4 bg-card-soft">
                    <p className="font-semibold mb-2">{f.front}</p>
                    <p className="text-sm text-muted-foreground">{f.back}</p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Brain;
