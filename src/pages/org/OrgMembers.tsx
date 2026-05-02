import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, Copy, UserPlus, Link as LinkIcon } from "lucide-react";
import { recordOrgEvent, notifyUser } from "@/lib/orgEvents";

type OrgRole = "owner" | "admin" | "teacher" | "student" | "observer";

interface MemberRow {
  id: string;
  user_id: string;
  member_role: OrgRole;
  joined_at: string;
  display_name?: string | null;
}
interface InviteRow {
  id: string;
  email: string;
  member_role: OrgRole;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}
interface CohortLite { id: string; name: string }

function shortHash(id: string): string { return id.slice(0, 4).toUpperCase() + "·" + id.slice(-4).toUpperCase(); }

export default function OrgMembers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [orgName, setOrgName] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortLite[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<OrgRole>("student");
  const [iCohort, setICohort] = useState<string>("");
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    if (!orgId || !user) return;
    setLoading(true);
    const { data: org } = await supabase.from("organizations").select("id,name,owner_id").eq("id", orgId).maybeSingle();
    if (!org) { setForbidden(true); setLoading(false); return; }
    setOrgName(org.name);

    let manage = org.owner_id === user.id;
    if (!manage) {
      const { data: me } = await supabase.from("organization_members").select("member_role")
        .eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
      if ((me as any)?.member_role === "owner" || (me as any)?.member_role === "admin") manage = true;
    }
    setCanManage(manage);

    const { data: m, error: merr } = await supabase
      .from("organization_members")
      .select("id,user_id,member_role,joined_at, profiles:user_id(display_name)")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: false });
    if (merr) toast.error(merr.message);
    setMembers(((m || []) as any[]).map((r) => ({ ...r, display_name: r.profiles?.display_name })) as MemberRow[]);

    if (manage) {
      const { data: inv } = await supabase
        .from("organization_invites")
        .select("id,email,member_role,status,token,expires_at,created_at,accepted_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      setInvites((inv || []) as InviteRow[]);

      const { data: cs } = await supabase.from("cohorts").select("id,name").eq("organization_id", orgId).order("name");
      setCohorts((cs || []) as CohortLite[]);
    }
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId, user?.id]);

  const inviteLink = (token: string) => `${window.location.origin}/join-org/${token}`;
  const legacyLink = (token: string) => `${window.location.origin}/org/invite/${token}`;

  const onInvite = async () => {
    if (!user || !orgId) return;
    if (!iEmail.trim() || !iEmail.includes("@")) { toast.error(t("orgInvite.emailRequired")); return; }
    setWorking(true);
    const { data, error } = await supabase.from("organization_invites").insert({
      organization_id: orgId,
      email: iEmail.trim().toLowerCase(),
      member_role: iRole,
      invited_by: user.id,
    } as any).select("id,token").maybeSingle();
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("orgInvite.created"));
    await recordOrgEvent({
      event_type: "organization_invite_created",
      organization_id: orgId,
      role: iRole,
      actor_id: user.id,
      extra: iCohort ? { cohort_id: iCohort } : {},
    });

    // best-effort notify resolved user (if any profile with that email exists)
    try {
      const { data: prof } = await supabase
        .from("profiles").select("id").ilike("email" as any, iEmail.trim()).maybeSingle();
      if ((prof as any)?.id) {
        await notifyUser({
          user_id: (prof as any).id,
          type: "organization_invite_created",
          title: t("orgNotifications.inviteCreated.title"),
          body: t("orgNotifications.inviteCreated.body", { org: orgName }),
          action_label: t("orgInvite.acceptCta"),
          action_url: `/join-org/${(data as any).token}`,
          metadata: { organization_id: orgId },
        });
      }
    } catch { /* best effort */ }

    setInviteOpen(false);
    setIEmail(""); setIRole("student"); setICohort("");
    void refresh();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("organization_invites").update({ status: "revoked" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("orgInvite.revoked"));
    void refresh();
  };

  const changeRole = async (m: MemberRow, newRole: OrgRole) => {
    if (!orgId || !user) return;
    if (m.member_role === newRole) return;
    const { error } = await supabase.from("organization_members").update({ member_role: newRole }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("orgInvite.roleUpdated"));
    await recordOrgEvent({
      event_type: "organization_role_changed",
      organization_id: orgId,
      role: newRole,
      actor_id: user.id,
    });
    await notifyUser({
      user_id: m.user_id,
      type: "org_role_changed",
      title: t("orgNotifications.roleChanged.title"),
      body: t("orgNotifications.roleChanged.body", { org: orgName, role: t(`orgRole.${newRole}`, newRole) }),
      action_url: `/org/${orgId}`,
      action_label: t("orgPage.title"),
      metadata: { organization_id: orgId, role: newRole },
    });
    void refresh();
  };

  const removeMember = async (m: MemberRow) => {
    const { error } = await supabase.from("organization_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("orgInvite.removed"));
    void refresh();
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success(t("orgInvite.copied")); };

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("orgPage.viewMembers")}
          subtitle={orgName}
          actions={
            canManage ? (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><UserPlus className="h-4 w-4" />{t("orgInvite.create")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("orgInvite.create")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>{t("orgInvite.email")}</Label>
                      <Input type="email" value={iEmail} onChange={(e) => setIEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label>{t("orgInvite.role")}</Label>
                      <Select value={iRole} onValueChange={(v) => setIRole(v as OrgRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("orgRole.admin")}</SelectItem>
                          <SelectItem value="teacher">{t("orgRole.teacher")}</SelectItem>
                          <SelectItem value="student">{t("orgRole.student")}</SelectItem>
                          <SelectItem value="observer">{t("orgRole.observer")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {cohorts.length > 0 && (
                      <div>
                        <Label>{t("orgInvite.cohortOptional")}</Label>
                        <Select value={iCohort || "__none"} onValueChange={(v) => setICohort(v === "__none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder={t("orgInvite.noCohort")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("orgInvite.noCohort")}</SelectItem>
                            {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={onInvite} disabled={working}>
                      {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t("orgInvite.create")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        {loading ? (
          <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
        ) : (
          <>
            <Card className="p-4">
              <div className="font-medium mb-3">{t("orgPage.viewMembers")}</div>
              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("orgInvite.noMembers")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cohortMember.label")}</TableHead>
                      <TableHead>{t("orgInvite.role")}</TableHead>
                      <TableHead>{t("cohortMember.joined")}</TableHead>
                      {canManage && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-medium">{m.display_name || `U·${shortHash(m.user_id)}`}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">U·{shortHash(m.user_id)}</div>
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <Select value={m.member_role} onValueChange={(v) => changeRole(m, v as OrgRole)}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">{t("orgRole.owner")}</SelectItem>
                                <SelectItem value="admin">{t("orgRole.admin")}</SelectItem>
                                <SelectItem value="teacher">{t("orgRole.teacher")}</SelectItem>
                                <SelectItem value="student">{t("orgRole.student")}</SelectItem>
                                <SelectItem value="observer">{t("orgRole.observer")}</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{t(`orgRole.${m.member_role}`, m.member_role)}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.joined_at).toLocaleDateString()}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => removeMember(m)}><Trash2 className="h-3 w-3" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {canManage && (
              <Card className="p-4">
                <div className="font-medium mb-3 flex items-center gap-2"><Mail className="h-4 w-4" />{t("orgInvite.title")}</div>
                {invites.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("orgInvite.empty")}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("orgInvite.email")}</TableHead>
                        <TableHead>{t("orgInvite.role")}</TableHead>
                        <TableHead>{t("orgInvite.statusCol")}</TableHead>
                        <TableHead>{t("orgInvite.link")}</TableHead>
                        <TableHead className="w-32"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="text-sm">{i.email}</TableCell>
                          <TableCell><Badge variant="outline">{t(`orgRole.${i.member_role}`, i.member_role)}</Badge></TableCell>
                          <TableCell><Badge variant={i.status === "pending" ? "secondary" : i.status === "accepted" ? "default" : "outline"}>{i.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <Button size="sm" variant="ghost" onClick={() => copy(inviteLink(i.token))} title="join-org link"><LinkIcon className="h-3 w-3" /> /join-org</Button>
                              <Button size="sm" variant="ghost" onClick={() => copy(legacyLink(i.token))} title="legacy link"><Copy className="h-3 w-3" /> /org/invite</Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {i.status === "pending" && (
                              <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>{t("orgInvite.revoke")}</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            )}

            <div className="pt-2">
              <Button asChild variant="ghost" size="sm"><Link to={`/org/${orgId}`}>← {t("common.back")}</Link></Button>
            </div>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
