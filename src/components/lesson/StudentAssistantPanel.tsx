import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Msg = { id: string; role: string; content: string; created_at: string };
type Props = { bookingId: string };

/** Student-only AI assistant. Never visible to tutor. Calls lesson-student-ai. */
export function StudentAssistantPanel({ bookingId }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lesson_student_ai_messages")
      .select("id, role, content, created_at")
      .eq("booking_id", bookingId)
      .eq("user_id", user.id)
      .order("created_at")
      .limit(50);
    if (Array.isArray(data)) setMessages(data as Msg[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId, user?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("lesson-student-ai", {
        body: { booking_id: bookingId, question: q, lang: i18n.language },
      });
      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        toast.error(
          status === 429 ? t("studentAi.rateLimited") :
          status === 402 ? t("studentAi.noCredits") :
          status === 403 ? t("studentAi.forbidden") :
          t("studentAi.error"),
        );
      } else if (data && (data as { error?: string }).error) {
        toast.error(t("studentAi.error"));
      }
      setInput("");
      await load();
    } catch {
      toast.error(t("studentAi.error"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
        {t("studentAi.disclaimer")}
      </div>

      <div className="max-h-[40vh] overflow-auto space-y-1.5 pr-1">
        {messages.length === 0
          ? <p className="text-xs text-muted-foreground">{t("studentAi.empty")}</p>
          : messages.map(m => (
              <div key={m.id} className={`text-xs rounded-md px-2 py-1 ${m.role === "student" ? "bg-accent/10 ml-6" : "bg-muted mr-6"}`}>
                <p className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</p>
                <p className="break-words whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
        <div ref={endRef} />
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">{t("studentAi.suggestedPrompts")}</p>
        <div className="flex flex-wrap gap-1">
          {(["promptExplain","promptExample","promptCheckMe","promptSummary"] as const).map(k => (
            <Button key={k} size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy}
              onClick={() => ask(t(`studentAi.${k}`))}>
              <Sparkles className="h-3 w-3 mr-1" />{t(`studentAi.${k}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-1">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={t("studentAi.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(input); } }} />
        <Button size="sm" onClick={() => ask(input)} disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("studentAi.studentOnly")}</p>
    </div>
  );
}
