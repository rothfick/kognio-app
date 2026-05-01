import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Video, MessageSquare, Sparkles, ArrowRight, Send, Mic, FileText, Loader2, PenTool } from "lucide-react";
import { toast } from "sonner";
import { EmotionEngine } from "@/components/session/EmotionEngine";
import { SharedWhiteboard } from "@/components/session/SharedWhiteboard";
import { LiveTranscriber } from "@/components/session/LiveTranscriber";
import { LiveKitVideo } from "@/components/session/LiveKitVideo";

type ChatMsg = { id: string; user_id: string; role: string; content: string; created_at: string };
type Transcript = { id: string; speaker_label: string | null; text: string; created_at: string };

const SessionRoom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<{ id: string; room_name: string; booking_id: string; started_at?: string | null } | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [trInput, setTrInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiStream, setAiStream] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sessions").select("id, room_name, booking_id, started_at").eq("id", id as string).maybeSingle();
      setSession(data as any);
      if (!data) return;

      // Oznacz start sesji przy pierwszym wejściu
      if (!data.started_at) {
        await supabase.from("sessions").update({ started_at: new Date().toISOString() }).eq("id", data.id);
      }

      const [{ data: c }, { data: t }] = await Promise.all([
        supabase.from("session_chat").select("*").eq("session_id", data.id).order("created_at"),
        supabase.from("session_transcripts").select("*").eq("session_id", data.id).order("created_at"),
      ]);
      setChat((c as ChatMsg[]) || []);
      setTranscripts((t as Transcript[]) || []);
    })();
  }, [id]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`session-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_chat", filter: `session_id=eq.${session.id}` },
        (p) => setChat((prev) => [...prev, p.new as ChatMsg]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_transcripts", filter: `session_id=eq.${session.id}` },
        (p) => setTranscripts((prev) => [...prev, p.new as Transcript]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const sendChat = async () => {
    if (!user || !session || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    const { error } = await supabase.from("session_chat").insert({
      session_id: session.id, user_id: user.id, role: "user", content: text,
    });
    if (error) toast.error(error.message);
  };

  const addTranscript = async () => {
    if (!user || !session || !trInput.trim()) return;
    const text = trInput.trim();
    setTrInput("");
    const { error } = await supabase.from("session_transcripts").insert({
      session_id: session.id, speaker_id: user.id, speaker_label: "Notatka", text, starts_at_ms: 0, ends_at_ms: 0,
    });
    if (error) toast.error(error.message);
  };

  const askCopilot = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true); setAiStream("");
    const question = aiInput;
    setAiInput("");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({
          mode: "tutor",
          messages: [
            { role: "system", content: `Kontekst sesji (ostatnie wypowiedzi):\n${[...transcripts, ...chat].slice(-15).map((m: any) => m.text || m.content).join("\n")}` },
            { role: "user", content: question },
          ],
        }),
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
            if (delta) { full += delta; setAiStream(full); }
          } catch {}
        }
      }
      // zapisz pełną odpowiedź AI do czatu sesji
      if (full && session && user) {
        await supabase.from("session_chat").insert({
          session_id: session.id, user_id: user.id, role: "ai",
          content: `🤖 Co-pilot: ${full}`,
        });
        setAiStream("");
      }
    } catch (e: any) {
      toast.error(e.message || "Błąd AI");
      setAiStream("");
    } finally {
      setAiLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!session) return;
    setSummarizing(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/session-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd");
      toast.success("Raport sesji wygenerowany!");
      // oznacz koniec sesji
      await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", session.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSummarizing(false);
    }
  };

  if (!session) return <AppShell><div className="container py-10">Ładowanie pokoju…</div></AppShell>;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: video + emocje */}
          <div className="space-y-4 flex flex-col">
            <LiveKitVideo sessionId={session.id} />
            {user && <EmotionEngine sessionId={session.id} userId={user.id} />}
            <Button onClick={generateSummary} disabled={summarizing} className="bg-accent-gradient text-accent-foreground">
              {summarizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Wygeneruj raport AI
            </Button>
            <Button asChild variant="outline"><Link to={`/payment/${session.booking_id}`}>Przejdź do płatności <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>

          {/* Right: chat / transkrypt / co-pilot */}
          <Card className="lg:col-span-2 p-0 bg-card-soft flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
            <Tabs defaultValue="board" className="flex-1 flex flex-col">
              <TabsList className="m-3">
                <TabsTrigger value="board"><PenTool className="h-4 w-4 mr-2" />Tablica</TabsTrigger>
                <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" />Czat</TabsTrigger>
                <TabsTrigger value="transcript"><Mic className="h-4 w-4 mr-2" />Transkrypt</TabsTrigger>
                <TabsTrigger value="copilot"><Sparkles className="h-4 w-4 mr-2" />AI Co-pilot</TabsTrigger>
              </TabsList>

              {/* TABLICA */}
              <TabsContent value="board" className="flex-1 mt-0 data-[state=inactive]:hidden relative px-4 pb-4">
                <div className="relative w-full h-full rounded-lg overflow-hidden border">
                  {user && <SharedWhiteboard sessionId={session.id} userId={user.id} />}
                </div>
              </TabsContent>


              {/* CHAT */}
              <TabsContent value="chat" className="flex-1 flex flex-col px-4 pb-4 mt-0 data-[state=inactive]:hidden">
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {chat.length === 0 && <p className="text-sm text-muted-foreground italic">Czat jest pusty.</p>}
                  {chat.map((m) => {
                    const isAi = m.role === "ai";
                    const isMine = !isAi && m.user_id === user?.id;
                    const align = isMine ? "ml-auto items-end" : "mr-auto items-start";
                    const bubble = isAi
                      ? "bg-accent/10 border border-accent/40 text-foreground rounded-bl-sm"
                      : isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm";
                    const cleanContent = isAi ? m.content.replace(/^🤖 Co-pilot:\s*/, "") : m.content;
                    return (
                      <div key={m.id} className={`flex flex-col max-w-[85%] ${align}`}>
                        {isAi && <span className="text-[10px] font-semibold text-accent mb-0.5 ml-2">🤖 AI Co-pilot</span>}
                        <div className={`p-3 rounded-2xl ${bubble}`}>
                          <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
                          <p className="text-[10px] mt-1 opacity-70">{new Date(m.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEnd} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2 mt-3 pt-3 border-t">
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Napisz wiadomość…" />
                  <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
                </form>
              </TabsContent>

              {/* TRANSKRYPT */}
              <TabsContent value="transcript" className="flex-1 flex flex-col px-4 pb-4 mt-0 data-[state=inactive]:hidden">
                {user && (
                  <div className="mb-3">
                    <LiveTranscriber sessionId={session.id} userId={user.id} />
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {transcripts.length === 0 && <p className="text-sm text-muted-foreground italic">Transkrypt pusty. Włącz auto-transkrypcję powyżej lub dodaj notatkę ręcznie.</p>}
                  {transcripts.map((t) => (
                    <div key={t.id} className="p-3 rounded-lg bg-background border-l-2 border-accent">
                      <p className="text-xs font-medium text-accent">{t.speaker_label || "Mówca"}</p>
                      <p className="text-sm">{t.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); addTranscript(); }} className="flex gap-2 mt-3 pt-3 border-t">
                  <Textarea value={trInput} onChange={(e) => setTrInput(e.target.value)} placeholder="Dodaj fragment transkryptu / notatkę z lekcji…" rows={2} className="resize-none" />
                  <Button type="submit" size="icon"><FileText className="h-4 w-4" /></Button>
                </form>
              </TabsContent>

              {/* CO-PILOT — pełny chat z AI (multi-turn) */}
              <TabsContent value="copilot" className="flex-1 flex flex-col px-4 pb-4 mt-0 data-[state=inactive]:hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <Card className="p-3 bg-background">
                    <p className="text-xs font-medium text-accent mb-1">🤖 AI Co-pilot</p>
                    <p className="text-sm text-muted-foreground">Pytania trafiają do AI z kontekstem ostatnich wypowiedzi. Cała rozmowa zapisuje się w czacie sesji.</p>
                  </Card>
                  {chat.filter((m) => m.role === "ai" || m.user_id === user?.id).slice(-30).map((m) => {
                    const isAi = m.role === "ai";
                    const align = isAi ? "mr-auto items-start" : "ml-auto items-end";
                    const bubble = isAi
                      ? "bg-accent/10 border border-accent/40 rounded-bl-sm"
                      : "bg-primary text-primary-foreground rounded-br-sm";
                    const cleanContent = isAi ? m.content.replace(/^🤖 Co-pilot:\s*/, "") : m.content;
                    return (
                      <div key={m.id} className={`flex flex-col max-w-[85%] ${align}`}>
                        {isAi && <span className="text-[10px] font-semibold text-accent mb-0.5 ml-2">🤖 AI</span>}
                        <div className={`p-3 rounded-2xl ${bubble}`}>
                          <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
                        </div>
                      </div>
                    );
                  })}
                  {aiStream && (
                    <div className="flex flex-col max-w-[85%] mr-auto items-start">
                      <span className="text-[10px] font-semibold text-accent mb-0.5 ml-2">🤖 AI pisze…</span>
                      <div className="p-3 rounded-2xl rounded-bl-sm bg-accent/10 border border-accent/40">
                        <p className="text-sm whitespace-pre-wrap">{aiStream}</p>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); askCopilot(); }} className="flex gap-2 mt-3 pt-3 border-t">
                  <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Zapytaj AI o cokolwiek…" disabled={aiLoading} />
                  <Button type="submit" size="icon" disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default SessionRoom;
