import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Brain as BrainIcon, Sparkles, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Brain = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [transcripts, setTranscripts] = useState<{ id: string; text: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("session_transcripts").select("id, text, created_at").order("created_at", { ascending: false }).limit(20);
      setTranscripts(data || []);
    })();
  }, [user]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-hero text-primary-foreground"><BrainIcon className="h-5 w-5" /></div>
          <h1 className="text-4xl font-bold">{t("brain.title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t("brain.subtitle")}</p>

        <Card className="p-5 mb-8 bg-card-soft shadow-soft">
          <div className="flex gap-2">
            <Input placeholder={t("brain.askPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            <Button className="bg-accent-gradient text-accent-foreground"><Sparkles className="h-4 w-4 mr-2" />{t("brain.ask")}</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">RAG-chat z Twoich sesji uruchomimy w kolejnym kroku — wymaga indeksacji embeddingami.</p>
        </Card>

        <Tabs defaultValue="transcripts">
          <TabsList>
            <TabsTrigger value="transcripts">{t("brain.transcripts")}</TabsTrigger>
            <TabsTrigger value="flashcards">{t("brain.flashcards")}</TabsTrigger>
          </TabsList>
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
            <p className="text-muted-foreground">{t("common.soon")}</p>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Brain;
