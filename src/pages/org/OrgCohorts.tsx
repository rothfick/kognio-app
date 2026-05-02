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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Layers, Pause, Archive, Play, ExternalLink } from "lucide-react";
import { recordOrgEvent } from "@/lib/orgEvents";

type CohortStatus = "active" | "paused" | "completed" | "archived";
interface CohortRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  level_code: string | null;
  domain_code: string | null;
  status: CohortStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  member_count?: number;
}

export default function OrgCohorts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [orgName, setOrgName] = useState<string>("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<CohortStatus>("active");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  const refresh = async () => {
    if (!orgId || !user) return;
    setLoading(true);
    const { data: org, error: oerr } = await supabase
      .from("organizations").select("id,name,owner_id").eq("id", orgId).maybeSingle();
    if (oerr || !org) { setForbidden(true); setLoading(false); return; }
    setOrgName(org.name);

    // determine if user can manage
    let manage = false;
    if (org.owner_id === user.id) manage = true;
    if (!manage) {
      const { data: me } = await supabase
        .from("organization_members")
        .select("member_role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle();
      if ((me as any)?.member_role === "owner" || (me as any)?.member_role === "admin") manage = true;
    }
    setCanManage(manage);

    const { data, error } = await supabase
      .from("cohorts")
      .select("id,organization_id,name,description,level_code,domain_code,status,starts_at,ends_at,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data || []) as CohortRow[];

    // member counts (best-effort, in parallel)
    const counts = await Promise.all(
      rows.map((c) =>
        supabase.from("cohort_members").select("id", { count: "exact", head: true }).eq("cohort_id", c.id).eq("status", "active")
      )
    );
    rows.forEach((c, i) => { c.member_count = counts[i].count || 0; });

    setCohorts(rows);
    setLoading(false);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId, user?.id]);

  const onCreate = async () => {
    if (!user || !orgId) return;
    if (!name.trim()) { toast.error(t("cohort.nameRequired")); return; }
    setWorking(true);
    const { data, error } = await supabase.from("cohorts").insert({
      organization_id: orgId,
      name: name.trim(),
      description: description.trim() || null,
      level_code: level.trim() || null,
      domain_code: domain.trim() || null,
      status,
      starts_at: starts ? new Date(starts).toISOString() : null,
      ends_at: ends ? new Date(ends).toISOString() : null,
      created_by: user.id,
    } as any).select("id").maybeSingle();
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("cohort.created"));
    await recordOrgEvent({
      event_type: "cohort_created",
      organization_id: orgId,
      cohort_id: (data as any)?.id,
      actor_id: user.id,
      status,
    });
    setOpen(false);
    setName(""); setDescription(""); setLevel(""); setDomain(""); setStarts(""); setEnds(""); setStatus("active");
    void refresh();
  };

  const setCohortStatus = async (id: string, s: CohortStatus) => {
    const { error } = await supabase.from("cohorts").update({ status: s }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t(`cohort.statusChanged.${s}`));
    void refresh();
  };

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("orgPage.viewCohorts")}
          subtitle={orgName}
          actions={
            canManage ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />{t("cohort.create")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("cohort.create")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>{t("cohort.fields.name")}</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <Label>{t("cohort.fields.description")}</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{t("cohort.fields.level")}</Label>
                        <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="A1, K7, B1..." />
                      </div>
                      <div>
                        <Label>{t("cohort.fields.domain")}</Label>
                        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="math, en, cs..." />
                      </div>
                    </div>
                    <div>
                      <Label>{t("cohort.fields.status")}</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as CohortStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t("cohort.status.active")}</SelectItem>
                          <SelectItem value="paused">{t("cohort.status.paused")}</SelectItem>
                          <SelectItem value="completed">{t("cohort.status.completed")}</SelectItem>
                          <SelectItem value="archived">{t("cohort.status.archived")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{t("cohort.fields.starts_at")}</Label>
                        <Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
                      </div>
                      <div>
                        <Label>{t("cohort.fields.ends_at")}</Label>
                        <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={onCreate} disabled={working}>
                      {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t("cohort.create")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null
          }
        />

        {loading ? (
          <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
        ) : cohorts.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground space-y-3">
            <Layers className="h-8 w-8 mx-auto opacity-60" />
            <div>{t("cohort.empty")}</div>
            {canManage && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" />{t("cohort.create")}</Button>}
          </Card>
        ) : (
          <div className="space-y-2">
            {cohorts.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/org/${orgId}/cohorts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <Badge variant={c.status === "active" ? "default" : c.status === "paused" ? "secondary" : "outline"}>
                      {t(`cohort.status.${c.status}`)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.level_code, c.domain_code].filter(Boolean).join(" · ") || "—"}
                    {" · "}{t("cohort.memberCount", { count: c.member_count || 0 })}
                    {" · "}{new Date(c.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canManage && c.status !== "active" && (
                    <Button size="sm" variant="ghost" title={t("cohort.actions.reactivate")} onClick={() => setCohortStatus(c.id, "active")}><Play className="h-4 w-4" /></Button>
                  )}
                  {canManage && c.status === "active" && (
                    <Button size="sm" variant="ghost" title={t("cohort.actions.pause")} onClick={() => setCohortStatus(c.id, "paused")}><Pause className="h-4 w-4" /></Button>
                  )}
                  {canManage && c.status !== "archived" && (
                    <Button size="sm" variant="ghost" title={t("cohort.actions.archive")} onClick={() => setCohortStatus(c.id, "archived")}><Archive className="h-4 w-4" /></Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to={`/org/${orgId}/cohorts/${c.id}`}>{t("cohort.open")} <ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="pt-4">
          <Button asChild variant="ghost" size="sm"><Link to={`/org/${orgId}`}>← {t("common.back")}</Link></Button>
        </div>
      </DashboardShell>
    </AppShell>
  );
}
