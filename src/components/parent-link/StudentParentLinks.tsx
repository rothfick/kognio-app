import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Mail, KeyRound, Trash2, Copy, Check, ShieldCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useStudentParentLinks, type ParentLinkRow, type ParentLinkScopes } from "@/hooks/useParentLinks";

/** Section a STUDENT uses to invite parents/guardians and manage their access. */
export function StudentParentLinksSection() {
  const { t } = useTranslation();
  const { links, loading, inviteByEmail, generateCode, revoke, updateScopes } = useStudentParentLinks();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const submitEmail = async () => {
    if (!email.includes("@")) {
      toast.error(t("parentLinks.emailInvalid"));
      return;
    }
    setBusy(true);
    try {
      await inviteByEmail(email);
      toast.success(t("parentLinks.inviteSent"));
      setEmail("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("parentLinks.inviteFailed", { msg }));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setBusy(true);
    try {
      await generateCode();
      toast.success(t("parentLinks.codeCreated"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("parentLinks.inviteFailed", { msg }));
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!window.confirm(t("parentLinks.revokeConfirm"))) return;
    try {
      await revoke(id);
      toast.success(t("parentLinks.revoked"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("parentLinks.revokeFailed", { msg }));
    }
  };

  const toggleScope = async (id: string, key: keyof ParentLinkScopes, current: boolean) => {
    try {
      await updateScopes(id, { [key]: !current });
      toast.success(t("parentLinks.scopesUpdated"));
    } catch (e) {
      toast.error(t("parentLinks.updateFailed"));
    }
  };

  const copyCode = async (link: ParentLinkRow) => {
    if (!link.pairing_code) return;
    await navigator.clipboard.writeText(link.pairing_code);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <Card className="p-6 bg-card-soft space-y-5">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          {t("parentLinks.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("parentLinks.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-background p-4 space-y-2">
          <Label className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{t("parentLinks.byEmailTitle")}</Label>
          <p className="text-xs text-muted-foreground">{t("parentLinks.byEmailHint")}</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="rodzic@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            <Button onClick={submitEmail} disabled={busy || !email}>{t("parentLinks.send")}</Button>
          </div>
        </div>

        <div className="rounded-md border bg-background p-4 space-y-2">
          <Label className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-muted-foreground" />{t("parentLinks.byCodeTitle")}</Label>
          <p className="text-xs text-muted-foreground">{t("parentLinks.byCodeHint")}</p>
          <Button onClick={submitCode} disabled={busy} variant="outline">{t("parentLinks.generateCode")}</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("parentLinks.existingTitle")}</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("parentLinks.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const name = l.parent_profile?.display_name || l.parent_profile?.full_name || l.invited_email || t("parentLinks.unknownParent");
              return (
                <li key={l.id} className="rounded-md border bg-background p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={l.status === "active" ? "default" : "secondary"} className="text-[10px]">
                          {t(`parentLinks.status.${l.status}`)}
                        </Badge>
                        {l.pairing_code && l.status === "pending" && (
                          <button
                            onClick={() => copyCode(l)}
                            className="text-[11px] font-mono tracking-widest bg-muted px-2 py-0.5 rounded inline-flex items-center gap-1 hover:bg-muted/80"
                            title={t("parentLinks.copyCode")}
                          >
                            {l.pairing_code}
                            {copiedId === l.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => onRevoke(l.id)} title={t("parentLinks.revoke")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {l.status === "active" && (
                    <div className="pt-2 border-t grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span>{t("parentLinks.scopes.stats")}</span>
                        <Switch checked={l.scopes.stats} onCheckedChange={() => toggleScope(l.id, "stats", l.scopes.stats)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("parentLinks.scopes.plans")}</span>
                        <Switch checked={l.scopes.plans} onCheckedChange={() => toggleScope(l.id, "plans", l.scopes.plans)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("parentLinks.scopes.sessions")}</span>
                        <Switch checked={l.scopes.sessions} onCheckedChange={() => toggleScope(l.id, "sessions", l.scopes.sessions)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("parentLinks.scopes.full")}</span>
                        <Switch checked={l.scopes.full} onCheckedChange={() => toggleScope(l.id, "full", l.scopes.full)} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
