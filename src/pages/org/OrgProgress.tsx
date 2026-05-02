import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Layers, Activity, GraduationCap, AlertTriangle } from "lucide-react";

interface CohortAgg {
  id: string;
  name: string;
  status: string;
  learners: number;
  diagnostics: number;
  plans: number;
  checkpoints: number;
  avgDelta: number;
}

export default function OrgProgress() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [summary, setSummary] = useState({
    members: 0, learners: 0, cohorts: 0, diagnostics: 0, plans: 0, checkpoints: 0, avgDiagnostic: 0, avgDelta: 0,
  });
  const [cohorts, setCohorts] = useState<CohortAgg[]>([]);
  const [attention, setAttention] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: org } = await supabase.from("organizations").select("id,name").eq("id", orgId).maybeSingle();
      if (!org) { setForbidden(true); setLoading(false); return; }
      setOrgName(org.name);

      const [{ count: mCount }, { count: cCount }, { data: cohortsRows }, { data: cmRows }] = await Promise.all([
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("cohorts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("cohorts").select("id,name,status").eq("organization_id", orgId),
        supabase.from("cohort_members").select("id,cohort_id,user_id,child_id,role,status").eq("status", "active"),
      ]);
      const cohortIdSet = new Set((cohortsRows || []).map((c: any) => c.id));
      const cms = ((cmRows || []) as any[]).filter((m) => cohortIdSet.has(m.cohort_id));

      const allLearnerUserIds = new Set<string>();
      const allLearnerChildIds = new Set<string>();
      cms.forEach((m) => {
        if (m.role === "student" && m.user_id) allLearnerUserIds.add(m.user_id);
        if ((m.role === "student" || m.role === "child") && m.child_id) allLearnerChildIds.add(m.child_id);
      });

      const orFor = (uids: string[], cids: string[]) =>
        [uids.length ? `user_id.in.(${uids.join(",")})` : "", cids.length ? `child_id.in.(${cids.join(",")})` : ""].filter(Boolean).join(",");

      let totalDiagnostics = 0, totalPlans = 0, totalCheckpoints = 0, sumDelta = 0, sumDeltaN = 0, sumDiagScore = 0, sumDiagN = 0;
      const cohortAgg: CohortAgg[] = [];
      for (const c of (cohortsRows || []) as any[]) {
        const cms2 = cms.filter((m) => m.cohort_id === c.id);
        const uids = Array.from(new Set(cms2.filter((m) => m.user_id && (m.role === "student" || m.role === "child")).map((m) => m.user_id))) as string[];
        const cids = Array.from(new Set(cms2.filter((m) => m.child_id).map((m) => m.child_id))) as string[];
        const learners = uids.length + cids.length;
        let diag = 0, plans = 0, cps = 0, avgD = 0;
        if (uids.length || cids.length) {
          try {
            const orStr = orFor(uids, cids);
            const { data: dRows } = await supabase
              .from("diagnostic_attempts").select("score").eq("status", "completed").or(orStr);
            diag = (dRows || []).length;
            (dRows || []).forEach((r: any) => { const v = Number(r.score); if (Number.isFinite(v)) { sumDiagScore += v; sumDiagN += 1; } });
            const { count: pCount } = await supabase
              .from("learning_plans").select("id", { count: "exact", head: true }).or(orStr);
            plans = pCount || 0;
            const { data: cpRows } = await supabase
              .from("learning_checkpoints").select("score_delta, completed_at").not("completed_at", "is", null).or(orStr);
            cps = (cpRows || []).length;
            const deltas = (cpRows || []).map((r: any) => Number(r.score_delta)).filter((v: number) => Number.isFinite(v));
            avgD = deltas.length ? Math.round((deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length) * 10) / 10 : 0;
            deltas.forEach((v) => { sumDelta += v; sumDeltaN += 1; });
          } catch { /* RLS may filter */ }
        }
        totalDiagnostics += diag; totalPlans += plans; totalCheckpoints += cps;
        cohortAgg.push({ id: c.id, name: c.name, status: c.status, learners, diagnostics: diag, plans, checkpoints: cps, avgDelta: avgD });
      }

      const att: string[] = [];
      cohortAgg.forEach((c) => {
        if (c.learners > 0 && c.diagnostics === 0) att.push(t("orgProgress.attention.noDiag", { cohort: c.name }));
        else if (c.diagnostics > 0 && c.plans === 0) att.push(t("orgProgress.attention.noPlan", { cohort: c.name }));
        else if (c.plans > 0 && c.checkpoints === 0) att.push(t("orgProgress.attention.noCheckpoint", { cohort: c.name }));
      });

      if (cancelled) return;
      setSummary({
        members: mCount || 0,
        cohorts: cCount || 0,
        learners: allLearnerUserIds.size + allLearnerChildIds.size,
        diagnostics: totalDiagnostics,
        plans: totalPlans,
        checkpoints: totalCheckpoints,
        avgDiagnostic: sumDiagN ? Math.round((sumDiagScore / sumDiagN) * 10) / 10 : 0,
        avgDelta: sumDeltaN ? Math.round((sumDelta / sumDeltaN) * 10) / 10 : 0,
      });
      setCohorts(cohortAgg);
      setAttention(att);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, user, t]);

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader title={t("orgProgress.title")} subtitle={orgName} />
        {loading ? (
          <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              <StatCard icon={Users} label={t("orgProgress.summary.members")} value={String(summary.members)} />
              <StatCard icon={GraduationCap} label={t("orgProgress.summary.learners")} value={String(summary.learners)} />
              <StatCard icon={Layers} label={t("orgProgress.summary.cohorts")} value={String(summary.cohorts)} />
              <StatCard icon={Activity} label={t("orgProgress.summary.diagnostics")} value={String(summary.diagnostics)} />
              <StatCard icon={Activity} label={t("orgProgress.summary.plans")} value={String(summary.plans)} />
              <StatCard icon={Activity} label={t("orgProgress.summary.checkpoints")} value={String(summary.checkpoints)} />
              <StatCard icon={Activity} label={t("orgProgress.summary.avgDiagnostic")} value={`${summary.avgDiagnostic}`} />
              <StatCard icon={Activity} label={t("orgProgress.summary.avgDelta")} value={`${summary.avgDelta}`} />
            </div>

            <Card className="p-4">
              <div className="font-medium mb-3">{t("orgProgress.cohortComparison")}</div>
              {cohorts.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("cohort.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cohort.fields.name")}</TableHead>
                      <TableHead>{t("orgProgress.summary.learners")}</TableHead>
                      <TableHead>{t("orgProgress.summary.diagnostics")}</TableHead>
                      <TableHead>{t("orgProgress.summary.plans")}</TableHead>
                      <TableHead>{t("orgProgress.summary.checkpoints")}</TableHead>
                      <TableHead>{t("orgProgress.summary.avgDelta")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohorts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link to={`/org/${orgId}/cohorts/${c.id}`} className="hover:underline">{c.name}</Link>
                          <Badge variant="outline" className="ml-2">{t(`cohort.status.${c.status}`, c.status)}</Badge>
                        </TableCell>
                        <TableCell>{c.learners}</TableCell>
                        <TableCell>{c.diagnostics}</TableCell>
                        <TableCell>{c.plans}</TableCell>
                        <TableCell>{c.checkpoints}</TableCell>
                        <TableCell>{c.avgDelta}</TableCell>
                        <TableCell><Button asChild size="sm" variant="ghost"><Link to={`/org/${orgId}/cohorts/${c.id}`}>{t("cohort.open")}</Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="p-4">
              <div className="font-medium mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />{t("orgProgress.attentionTitle")}</div>
              {attention.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("orgProgress.noAttention")}</div>
              ) : (
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {attention.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </Card>

            <div className="text-xs text-muted-foreground">{t("orgProgress.privacyNote")}</div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to={`/org/${orgId}`}>← {t("common.back")}</Link></Button>
              <Button asChild variant="outline"><Link to={`/org/${orgId}/reports`}>{t("orgPage.viewReports")}</Link></Button>
            </div>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
