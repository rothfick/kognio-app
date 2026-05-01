import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { RoleGate } from "@/components/auth/RoleGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, School, Mail, Loader2, Trash2, Copy, RefreshCw, UserPlus } from "lucide-react";

type OrgType = "school" | "training_company";
type MemberRole = "owner" | "admin" | "teacher" | "student" | "observer";
type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

interface Organization {
  id: string;
  name: string;
  org_type: OrgType;
  slug: string;
  tax_id: string | null;
  city: string | null;
  website: string | null;
  description: string | null;
  is_verified: boolean;
  owner_id: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  member_role: MemberRole;
  joined_at: string;
  display_name?: string | null;
  email_hint?: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  member_role: MemberRole;
  status: InviteStatus;
  token: string;
  expires_at: string;
  created_at: string;
}

function OrgDashboardInner({ kind }: { kind: OrgType }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Edit details state
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("student");
  const [sendingInvite, setSendingInvite] = useState(false);

  const labels = useMemo(
    () => ({
      title: kind === "school" ? t("org.schoolTitle") : t("org.companyTitle"),
      subtitle:
        kind === "school"
          ? t("org.schoolSubtitle")
          : t("org.companySubtitle"),
      icon: kind === "school" ? <School className="h-5 w-5" /> : <Building2 className="h-5 w-5" />,
      memberPlural: kind === "school" ? t("org.studentsSchool") : t("org.studentsCompany"),
      teachers: kind === "school" ? t("org.teachersSchool") : t("org.teachersCompany"),
    }),
    [kind, t]
  );
  const dateLocale = i18n.language?.startsWith("es") ? "es-ES" : i18n.language?.startsWith("en") ? "en-US" : "pl-PL";

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Find org owned by current user of this kind (created at onboarding)
      const { data: orgs, error: oErr } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .eq("org_type", kind)
        .order("created_at", { ascending: true })
        .limit(1);
      if (oErr) throw oErr;
      const o = (orgs && orgs[0]) as Organization | undefined;
      if (!o) {
        setOrg(null);
        setMembers([]);
        setInvites([]);
        setLoading(false);
        return;
      }
      setOrg(o);
      setName(o.name);
      setTaxId(o.tax_id || "");
      setCity(o.city || "");
      setWebsite(o.website || "");
      setDescription(o.description || "");

      const [mRes, iRes] = await Promise.all([
        supabase
          .from("organization_members")
          .select("id,user_id,member_role,joined_at")
          .eq("organization_id", o.id)
          .order("joined_at", { ascending: true }),
        supabase
          .from("organization_invites")
          .select("id,email,member_role,status,token,expires_at,created_at")
          .eq("organization_id", o.id)
          .order("created_at", { ascending: false }),
      ]);
      if (mRes.error) throw mRes.error;
      if (iRes.error) throw iRes.error;
      const baseMembers = (mRes.data || []) as MemberRow[];
      // Enrich with profiles (display_name)
      const ids = baseMembers.map((m) => m.user_id);
      let nameMap = new Map<string, string | null>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", ids);
        nameMap = new Map(
          (profs || []).map((p: any) => [p.id, p.display_name || p.full_name || null])
        );
      }
      setMembers(
        baseMembers.map((m) => ({ ...m, display_name: nameMap.get(m.user_id) || null }))
      );
      setInvites((iRes.data || []) as InviteRow[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("org.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, kind]);

  const saveDetails = async () => {
    if (!org) return;
    if (!name.trim()) { toast.error(t("org.nameEmpty")); return; }
    setSavingDetails(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: name.trim(),
        tax_id: taxId.trim() || null,
        city: city.trim() || null,
        website: website.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", org.id);
    setSavingDetails(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("org.saved"));
    loadAll();
  };

  const sendInvite = async () => {
    if (!org || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("org.invalidEmail"));
      return;
    }
    setSendingInvite(true);
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: org.id,
      email,
      member_role: inviteRole,
      invited_by: user.id,
    });
    setSendingInvite(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("org.inviteCreated"));
    setInviteEmail("");
    setInviteRole("student");
    setInviteOpen(false);
    loadAll();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase
      .from("organization_invites")
      .update({ status: "revoked" as InviteStatus })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("org.inviteRevoked"));
    loadAll();
  };

  const removeMember = async (m: MemberRow) => {
    if (!org) return;
    if (m.user_id === org.owner_id) {
      toast.error(t("org.cannotRemoveOwner"));
      return;
    }
    const { error } = await supabase.from("organization_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("org.memberRemoved"));
    loadAll();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/org/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(t("org.linkCopied"));
  };

  const studentsCount = members.filter((m) => m.member_role === "student").length;
  const teachersCount = members.filter((m) => m.member_role === "teacher").length;
  const adminsCount = members.filter((m) => m.member_role === "admin" || m.member_role === "owner").length;
  const pendingInvites = invites.filter((i) => i.status === "pending").length;

  if (loading) {
    return (
      <AppShell>
        <DashboardShell>
          <div className="text-muted-foreground text-sm">{t("org.loading")}</div>
        </DashboardShell>
      </AppShell>
    );
  }

  if (!org) {
    return (
      <AppShell>
        <DashboardShell>
          <DashboardHeader
            title={labels.title}
            subtitle={t("org.notFound")}
            primaryAction={{ label: t("org.goOnboarding"), to: "/onboarding" }}
          />
        </DashboardShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={org.name}
          subtitle={labels.subtitle}
          actions={
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent-gradient text-accent-foreground shadow-glow">
                  <UserPlus className="h-4 w-4 mr-1.5" /> {t("org.invite")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("org.newInvite")}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="inv-email">{t("org.email")}</Label>
                    <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t("org.emailPlaceholder")} />
                  </div>
                  <div>
                    <Label>{t("org.roleInOrg")}</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">{kind === "school" ? t("org.studentSchool") : t("org.studentCompany")}</SelectItem>
                        <SelectItem value="teacher">{kind === "school" ? t("org.teacherSchool") : t("org.teacherCompany")}</SelectItem>
                        <SelectItem value="admin">{t("org.admin")}</SelectItem>
                        <SelectItem value="observer">{t("org.observer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("org.inviteIntro")}
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setInviteOpen(false)}>{t("org.cancel")}</Button>
                  <Button onClick={sendInvite} disabled={sendingInvite}>
                    {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                    {t("org.createInvite")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label={labels.memberPlural} value={studentsCount} hint={t("org.active")} />
          <StatCard label={labels.teachers} value={teachersCount} hint={t("org.didactic")} />
          <StatCard label={t("org.admins")} value={adminsCount} hint={t("org.adminsHint")} />
          <StatCard label={t("org.pendingInvites")} value={pendingInvites} hint={t("org.pendingInvitesHint")} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{t("org.members")}</h2>
                <p className="text-sm text-muted-foreground">{t("org.membersDesc", { name: org.name })}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadAll}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t("org.refresh")}
              </Button>
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("org.noMembers")}
              </p>
            ) : (
              <div className="divide-y">
                {members.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.display_name || t("org.user")}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("org.joinedAt", { date: new Date(m.joined_at).toLocaleDateString(dateLocale) })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={m.member_role === "owner" ? "default" : "secondary"}>
                        {memberRoleLabel(m.member_role, kind)}
                      </Badge>
                      {m.user_id !== org.owner_id && (
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m)} aria-label={t("org.remove")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-1">{t("org.invites")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("org.invitesDesc")}</p>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("org.noInvites")}</p>
            ) : (
              <div className="space-y-3">
                {invites.map((i) => (
                  <div key={i.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {memberRoleLabel(i.member_role, kind)} · wygasa {new Date(i.expires_at).toLocaleDateString("pl-PL")}
                        </div>
                      </div>
                      <Badge variant={inviteBadgeVariant(i.status)}>{inviteStatusLabel(i.status)}</Badge>
                    </div>
                    {i.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyInviteLink(i.token)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Kopiuj link
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeInvite(i.id)}>
                          Odwołaj
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Dane organizacji</h2>
              <p className="text-sm text-muted-foreground">
                {org.is_verified ? "Konto zweryfikowane przez Kogni." : "Status: oczekuje na weryfikację."}
              </p>
            </div>
            <Badge variant={org.is_verified ? "default" : "outline"}>
              {labels.icon}
              <span className="ml-1.5">{kind === "school" ? "Szkoła" : "Firma szkoleniowa"}</span>
            </Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="o-name">Nazwa</Label>
              <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="o-tax">NIP / REGON</Label>
              <Input id="o-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="o-city">Miasto</Label>
              <Input id="o-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="o-web">WWW</Label>
              <Input id="o-web" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="o-desc">Opis</Label>
              <Input id="o-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveDetails} disabled={savingDetails}>
              {savingDetails && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Zapisz
            </Button>
          </div>
        </Card>
      </DashboardShell>
    </AppShell>
  );
}

function memberRoleLabel(r: MemberRole, kind: OrgType) {
  switch (r) {
    case "owner": return "Właściciel";
    case "admin": return "Administrator";
    case "teacher": return kind === "school" ? "Nauczyciel" : "Trener";
    case "student": return kind === "school" ? "Uczeń" : "Kursant";
    case "observer": return "Obserwator";
  }
}
function inviteStatusLabel(s: InviteStatus) {
  return ({ pending: "Oczekuje", accepted: "Zaakceptowane", revoked: "Odwołane", expired: "Wygasłe" } as const)[s];
}
function inviteBadgeVariant(s: InviteStatus): "default" | "secondary" | "outline" | "destructive" {
  if (s === "accepted") return "default";
  if (s === "pending") return "secondary";
  return "outline";
}

export function SchoolDashboard() {
  return (
    <RoleGate allow={["school", "admin"]}>
      <OrgDashboardInner kind="school" />
    </RoleGate>
  );
}

export function CompanyDashboard() {
  return (
    <RoleGate allow={["training_company", "admin"]}>
      <OrgDashboardInner kind="training_company" />
    </RoleGate>
  );
}
