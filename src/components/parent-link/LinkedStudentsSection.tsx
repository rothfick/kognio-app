import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, KeyRound, Inbox, Users } from "lucide-react";
import { toast } from "sonner";
import { useLinkedStudents } from "@/hooks/useParentLinks";

/** Section a PARENT uses to accept a student's invite (by code or email) and see linked students. */
export function LinkedStudentsSection() {
  const { t } = useTranslation();
  const { active, pending, loading, acceptByCode, acceptInvite, declineInvite } = useLinkedStudents();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCode = async () => {
    if (code.trim().length < 4) {
      toast.error(t("linkedStudents.codeInvalid"));
      return;
    }
    setBusy(true);
    try {
      await acceptByCode(code);
      toast.success(t("linkedStudents.linkedOk"));
      setCode("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("linkedStudents.linkFailed", { msg }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 bg-card-soft space-y-5">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          {t("linkedStudents.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("linkedStudents.subtitle")}</p>
      </div>

      {/* Accept by code */}
      <div className="rounded-md border bg-background p-4 space-y-2">
        <Label className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-muted-foreground" />{t("linkedStudents.codeTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("linkedStudents.codeHint")}</p>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD23"
            maxLength={8}
            className="font-mono tracking-widest uppercase"
          />
          <Button onClick={submitCode} disabled={busy}>{t("linkedStudents.connect")}</Button>
        </div>
      </div>

      {/* Pending email invites */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Inbox className="h-4 w-4 text-accent" />{t("linkedStudents.pendingTitle")}</h3>
          <ul className="space-y-2">
            {pending.map((l) => {
              const name = l.student_profile?.display_name || l.student_profile?.full_name || t("linkedStudents.unknownStudent");
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{t("linkedStudents.invitedAt", { date: new Date(l.invited_at).toLocaleDateString() })}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={async () => { await declineInvite(l.id); toast.success(t("linkedStudents.declined")); }}>
                      {t("linkedStudents.decline")}
                    </Button>
                    <Button size="sm" onClick={async () => {
                      try { await acceptInvite(l.id); toast.success(t("linkedStudents.linkedOk")); }
                      catch (e) { toast.error(t("linkedStudents.linkFailed", { msg: e instanceof Error ? e.message : String(e) })); }
                    }}>
                      {t("linkedStudents.accept")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Active linked students */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("linkedStudents.activeTitle")}</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : active.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("linkedStudents.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {active.map((l) => {
              const name = l.student_profile?.display_name || l.student_profile?.full_name || t("linkedStudents.unknownStudent");
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <Badge variant="default" className="text-[10px] mt-1">{t("parentLinks.status.active")}</Badge>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/parent/linked/${l.student_id}`}>
                      {t("linkedStudents.openView")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
