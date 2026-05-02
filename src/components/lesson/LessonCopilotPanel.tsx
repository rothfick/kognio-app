import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Props = { bookingId: string };
type Msg = { id: string; role: string; content: string; created_at: string };

const QUICK_KEYS = [
  "promptCheckQuestion","promptExplainSimpler","promptDetectGap","promptMicroExercise","promptSummarize",
] as const;

/** Tutor-only AI co-pilot tab. Calls lesson-ai-copilot edge function. */
export function LessonCopilotPanel({ bookingId }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<{ q?: string; ex?: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("lesson_ai_copilot_messages")
      .select("id, role, content, created_at")
      .eq("booking_id", bookingId)
      .order("created_at").limit(50);
    if (Array.isArray(data)) setMessages(data as Msg[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true); setSuggested(null);
    try {
      const { data, error } = await supabase.functions.invoke("lesson-ai-copilot", {
        body: { booking_id: bookingId, question: question.trim() },
      });
      if (error) {
        const msg = (error as any)?.context?.status === 429 ? t("copilot.rateLimited")
          : (error as any)?.context?.status === 402 ? t("copilot.noCredits")
          : t("copilot.error");
        toast.error(msg);
      } else if (data) {
        const d = data as any;
        setSuggested({ q: d.suggested_question || "", ex: d.suggested_micro_exercise || "" });
      }
      setInput("");
      await load();
    } catch (e) {
      toast.error(t("copilot.error"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="max-h-[40vh] overflow-auto space-y-1.5 pr-1">
        {messages.length === 0
          ? <p className="text-xs text-muted-foreground">{t("copilot.empty")}</p>
          : messages.map(m => (
              <div key={m.id} className={`text-xs rounded-md px-2 py-1 ${m.role === "tutor" ? "bg-accent/10 ml-6" : "bg-muted mr-6"}`}>
                <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</p>
                <p className="break-words whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
        <div ref={endRef} />
      </div>

      {suggested && (suggested.q || suggested.ex) && (
        <div className="rounded-md border border-accent/30 bg-accent/5 p-2 space-y-1 text-xs">
          {suggested.q && <p><span className="font-medium">{t("copilot.suggestedQuestion")}:</span> {suggested.q}</p>}
          {suggested.ex && <p><span className="font-medium">{t("copilot.suggestedExercise")}:</span> {suggested.ex}</p>}
        </div>
      )}

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">{t("copilot.suggestedPrompts")}</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_KEYS.map(k => (
            <Button key={k} size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy}
              onClick={() => ask(t(`copilot.${k}`))}>
              <Sparkles className="h-3 w-3 mr-1" />{t(`copilot.${k}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={t("copilot.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(input); } }} />
        <Button size="sm" onClick={() => ask(input)} disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("copilot.tutorOnly")}</p>
    </div>
  );
}
