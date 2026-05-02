import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, GraduationCap, Activity, Loader2, UserPlus, Trash2 } from "lucide-react";
import { recordOrgEvent, notifyUser } from "@/lib/orgEvents";

type CohortRole = "student" | "child" | "tutor" | "reviewer" | "observer";

interface CohortInfo {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  level_code: string | null;
  domain_code: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface CohortMemberRow {
  id: string;
  user_id: string | null;
  child_id: string | null;
  role: CohortRole;
  status: string;
  created_at: string;
  label?: string; // anonymized label
}

function shortHash(id: string): string {
  return id.slice(0, 4).toUpperCase() + "·" + id.slice(-4).toUpperCase();
}

export default function OrgCohortDetail() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId, cohortId } = useParams<{ orgId: string; cohortId: string }>();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<CohortMemberRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<{ user_id: string; member_role: string }[]>([]);
  const [stats, setStats] = useState({ diagnostics: 0, plans: 0, checkpoints: 0, avgDelta: 0, learners: 0, tutors: 0 });
  const [activity, setActivity] = useState<any[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addRole, setAddRole] = useState<CohortRole>("student");
  const [addUserId, setAddUserId] = useState<string>("");
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    if (!orgId || !cohortId || !user) return;
    setLoading(true);
    const { data: org } = await supabase.from("organizations").select("id,name,owner_id").eq("id", orgId).maybeSingle();
    if (!org) { setForbidden(true); setLoading(false); return; }
    setOrgName(org.name);

    const { data: c, error: cErr } = await supabase
      .from("cohorts")
      .select("id,organization_id,name,description,level_code,domain_code,status,starts_at,ends_at")
      .eq("id", cohortId).maybeSingle();
    if (cErr || !c) { setForbidden(true); setLoading(false); return; }
    setCohort(c as CohortInfo);

    let manage = org.owner_id === user.id;
    if (!manage) {
      const { data: me } = await supabase.from("organization_members").select("member_role")
        .eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
      if ((me as any)?.member_role === "owner" || (me as any)?.member_role === "admin") manage = true;
    }
    setCanManage(manage);

    const { data: cmem } = await supabase
      .from("cohort_members")
      .select("id,user_id,child_id,role,status,created_at")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false });
    const rows = ((cmem || []) as CohortMemberRow[]).map((m) => ({
      ...m,
      label: m.user_id ? "U·" + shortHash(m.user_id) : m.child_id ? "C·" + shortHash(m.child_id) : "—",
    }));
    setMembers(rows);

    // org members for add picker
    const { data: om } = await supabase
      .from("organization_members")
      .select("user_id, member_role")
      .eq("organization_id", orgId);
    setOrgMembers((om || []) as any);

    // aggregate metrics from existing tables (best-effort, RLS-permitting)
    const learnerUserIds = rows.filter((r) => r.user_id && (r.role === "student" || r.role === "child")).map((r) => r.user_id!) as string[];
    const learnerChildIds = rows.filter((r) => r.child_id).map((r) => r.child_id!) as string[];
    const tutors = rows.filter((r) => r.role === "tutor" && r.status === "active").length;
    const learners = learnerUserIds.length + learnerChildIds.length;

    let diagnostics = 0, plans = 0, checkpoints = 0, avgDelta = 0;
    try {
      if (learnerUserIds.length || learnerChildIds.length) {
        const { count: dCount } = await supabase
          .from("diagnostic_attempts")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .or([
            learnerUserIds.length ? `user_id.in.(${learnerUserIds.join(",")})` : "",
            learnerChildIds.length ? `child_id.in.(${learnerChildIds.join(",")})` : "",
          ].filter(Boolean).join(","));
        diagnostics = dCount || 0;

        const { count: pCount } = await supabase
          .from("learning_plans")
          .select("id", { count: "exact", head: true })
          .or([
            learnerUserIds.length ? `user_id.in.(${learnerUserIds.join(",")})` : "",
            learnerChildIds.length ? `child_id.in.(${learnerChildIds.join(",")})` : "",
          ].filter(Boolean).join(","));
        plans = pCount || 0;

        const { data: cp } = await supabase
          .from("learning_checkpoints")
          .select("score_delta, completed_at")
          .or([
            learnerUserIds.length ? `user_id.in.(${learnerUserIds.join(",")})` : "",
            learnerChildIds.length ? `child_id.in.(${learnerChildIds.join(",")})` : "",
          ].filter(Boolean).join(","))
          .not("completed_at", "is", null);
        checkpoints = (cp || []).length;
        const deltas = (cp || []).map((x: any) => Number(x.score_delta)).filter((v: number) => Number.isFinite(v));
        avgDelta = deltas.length ? Math.round((deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length) * 10) / 10 : 0;
      }
    } catch (_e) { /* RLS may filter; safe to ignore */ }
    setStats({ diagnostics, plans, checkpoints, avgDelta, learners, tutors });

    // org-level smart events that include this cohort
    try {
      const { data: ev } = await supabase
        .from("smart_evidence_events")
        .select("id,event_type,input_summary,created_at")
        .eq("input_summary->>cohort_id", cohortId)
        .order("created_at", { ascending: false })
        .limit(10);
      setActivity((ev || []) as any);
    } catch { /* ignore */ }

    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId, cohortId, user?.id]);

  const eligibleAdd = useMemo(() => {
    const taken = new Set(members.filter((m) => m.user_id).map((m) => m.user_id!));
    return orgMembers.filter((m) => !taken.has(m.user_id));
  }, [orgMembers, members]);

  const onAddMember = async () => {
    if (!cohortId || !orgId || !user) return;
    if (!addUserId) { toast.error(t("cohortMember.pickUser")); return; }
    setWorking(true);
    const { error } = await supabase.from("cohort_members").insert({
      cohort_id: cohortId, user_id: addUserId, role: addRole, status: "active", added_by: user.id,
    } as any);
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("cohortMember.added"));
    await recordOrgEvent({
      event_type: "cohort_member_added",
      organization_id: orgId,
      cohort_id: cohortId,
      role: addRole,
      actor_id: user.id,
    });
    await notifyUser({
      user_id: addUserId,
      type: "cohort_assigned",
      title: t("orgNotifications.cohortAssigned.title"),
      body: t("orgNotifications.cohortAssigned.body", { cohort: cohort?.name || "" }),
      action_label: t("cohort.open"),
      action_url: `/org/${orgId}/cohorts/${cohortId}`,
      metadata: { organization_id: orgId, cohort_id: cohortId, role: addRole },
    });
    setAddOpen(false); setAddUserId(""); setAddRole("student");
    void refresh();
  };

  const onRemoveMember = async (id: string) => {
    const { error } = await supabase.from("cohort_members").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("cohortMember.removed"));
    void refresh();
  };

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={cohort?.name || t("cohort.detail")}
          subtitle={
            cohort
              ? `${orgName} · ${t(`cohort.status.${cohort.status}`)}${cohort.level_code ? ` · ${cohort.level_code}` : ""}${cohort.domain_code ? ` · ${cohort.domain_code}` : ""}`
              : t("common.loadingPanel")
          }
          actions={
            canManage ? (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><UserPlus className="h-4 w-4" />{t("cohortMember.add")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("cohortMember.add")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>{t("cohortMember.user")}</Label>
                      <Select value={addUserId} onValueChange={setAddUserId}>
                        <SelectTrigger><SelectValue placeholder={t("cohortMember.pickUser")} /></SelectTrigger>
                        <SelectContent>
                          {eligibleAdd.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">{t("cohortMember.noEligible")}</div>
                          ) : eligibleAdd.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              U·{shortHash(m.user_id)} · {t(`orgRole.${m.member_role}`, m.member_role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("cohortMember.role")}</Label>
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as CohortRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">{t("cohortMember.roles.student")}</SelectItem>
                          <SelectItem value="tutor">{t("cohortMember.roles.tutor")}</SelectItem>
                          <SelectItem value="reviewer">{t("cohortMember.roles.reviewer")}</SelectItem>
                          <SelectItem value="observer">{t("cohortMember.roles.observer")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={onAddMember} disabled={working || !addUserId}>
                      {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t("cohortMember.add")}
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
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Users} label={t("cohort.stats.learners")} value={String(stats.learners)} />
              <StatCard icon={GraduationCap} label={t("cohort.stats.tutors")} value={String(stats.tutors)} />
              <StatCard icon={Activity} label={t("cohort.stats.diagnostics")} value={String(stats.diagnostics)} />
              <StatCard icon={Activity} label={t("cohort.stats.plans")} value={String(stats.plans)} />
              <StatCard icon={Activity} label={t("cohort.stats.checkpoints")} value={String(stats.checkpoints)} />
              <StatCard icon={Activity} label={t("cohort.stats.avgDelta")} value={`${stats.avgDelta}`} />
            </div>

            {cohort?.description && (
              <Card className="p-4">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{cohort.description}</div>
              </Card>
            )}

            <Card className="p-4">
              <div className="font-medium mb-3">{t("cohortMember.learnersTable")}</div>
              {members.filter((m) => m.role === "student" || m.role === "child").length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("cohortMember.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cohortMember.label")}</TableHead>
                      <TableHead>{t("cohortMember.kind")}</TableHead>
                      <TableHead>{t("cohortMember.statusCol")}</TableHead>
                      <TableHead>{t("cohortMember.joined")}</TableHead>
                      {canManage && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.filter((m) => m.role === "student" || m.role === "child").map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.label}</TableCell>
                        <TableCell>{m.user_id ? t("cohortMember.kindUser") : t("cohortMember.kindChild")}</TableCell>
                        <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => onRemoveMember(m.id)}><Trash2 className="h-3 w-3" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="p-4">
              <div className="font-medium mb-3">{t("cohortMember.tutorsTable")}</div>
              {members.filter((m) => m.role === "tutor").length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("cohortMember.noTutors")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cohortMember.label")}</TableHead>
                      <TableHead>{t("cohortMember.statusCol")}</TableHead>
                      <TableHead>{t("cohortMember.joined")}</TableHead>
                      {canManage && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.filter((m) => m.role === "tutor").map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.label}</TableCell>
                        <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => onRemoveMember(m.id)}><Trash2 className="h-3 w-3" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="p-4">
              <div className="font-medium mb-3">{t("cohort.recentActivity")}</div>
              {activity.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("cohort.noActivity")}</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activity.map((e) => (
                    <li key={e.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                      <Badge variant="outline">{e.event_type}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to={`/org/${orgId}/cohorts`}>← {t("cohort.backToList")}</Link></Button>
              <Button asChild variant="outline"><Link to={`/org/${orgId}/progress`}>{t("orgPage.viewProgress")}</Link></Button>
              <Button asChild variant="outline"><Link to={`/org/${orgId}/reports`}>{t("orgPage.viewReports")}</Link></Button>
            </div>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
