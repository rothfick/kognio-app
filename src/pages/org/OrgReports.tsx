import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardShell, DashboardHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Download, FileJson, FileText } from "lucide-react";
import { recordOrgEvent } from "@/lib/orgEvents";
import { toast } from "sonner";

interface OrgInfo { id: string; name: string; slug: string; org_type: string; status: string }

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function todayStamp() { return new Date().toISOString().slice(0, 10); }

export default function OrgReports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!orgId || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations").select("id,name,slug,org_type,status").eq("id", orgId).maybeSingle();
      if (!cancelled) {
        if (error || !data) { setForbidden(true); }
        else setOrg(data as OrgInfo);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, user]);

  const buildReport = async () => {
    if (!orgId || !org) return null;
    const [{ count: mCount }, { count: cCount }, { data: cohortsRows }, { data: cmRows }] = await Promise.all([
      supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("cohorts").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("cohorts").select("id,name,status,level_code,domain_code,starts_at,ends_at,created_at").eq("organization_id", orgId),
      supabase.from("cohort_members").select("id,cohort_id,user_id,child_id,role,status").eq("status", "active"),
    ]);
    const cohortIds = new Set((cohortsRows || []).map((c: any) => c.id));
    const cms = ((cmRows || []) as any[]).filter((m) => cohortIds.has(m.cohort_id));
    const learnerUserIds = Array.from(new Set(cms.filter((m) => m.user_id && (m.role === "student" || m.role === "child")).map((m) => m.user_id))) as string[];
    const learnerChildIds = Array.from(new Set(cms.filter((m) => m.child_id).map((m) => m.child_id))) as string[];

    const orStr = [
      learnerUserIds.length ? `user_id.in.(${learnerUserIds.join(",")})` : "",
      learnerChildIds.length ? `child_id.in.(${learnerChildIds.join(",")})` : "",
    ].filter(Boolean).join(",");

    let diag = 0, plans = 0, checkpoints = 0, avgDelta = 0, avgDiag = 0;
    let algoVersions: string[] = [];
    if (orStr) {
      try {
        const { data: dRows } = await supabase.from("diagnostic_attempts").select("score, algorithm_version").eq("status", "completed").or(orStr);
        diag = (dRows || []).length;
        const ds = (dRows || []).map((r: any) => Number(r.score)).filter((v: number) => Number.isFinite(v));
        avgDiag = ds.length ? Math.round((ds.reduce((a: number, b: number) => a + b, 0) / ds.length) * 10) / 10 : 0;
        algoVersions = Array.from(new Set((dRows || []).map((r: any) => r.algorithm_version).filter(Boolean))) as string[];
        const { count: pc } = await supabase.from("learning_plans").select("id", { count: "exact", head: true }).or(orStr);
        plans = pc || 0;
        const { data: cp } = await supabase.from("learning_checkpoints").select("score_delta").not("completed_at", "is", null).or(orStr);
        checkpoints = (cp || []).length;
        const deltas = (cp || []).map((r: any) => Number(r.score_delta)).filter((v: number) => Number.isFinite(v));
        avgDelta = deltas.length ? Math.round((deltas.reduce((a: number, b: number) => a + b, 0) / deltas.length) * 10) / 10 : 0;
      } catch { /* RLS may filter */ }
    }

    // event counts (org-scoped)
    let eventsByType: Record<string, number> = {};
    try {
      const { data: ev } = await supabase
        .from("smart_evidence_events")
        .select("event_type")
        .eq("input_summary->>organization_id", orgId);
      ((ev || []) as any[]).forEach((e: any) => { eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1; });
    } catch { /* ignore */ }

    return {
      generated_at: new Date().toISOString(),
      product: "Kogni",
      report_type: "ORG_PROGRESS_REPORT_V1",
      organization: {
        id: org.id,
        name: org.name,
        type: org.org_type,
        status: org.status,
      },
      summary: {
        members: mCount || 0,
        cohorts: cCount || 0,
        learners: learnerUserIds.length + learnerChildIds.length,
      },
      cohorts: (cohortsRows || []).map((c: any) => ({
        id: c.id, name: c.name, status: c.status,
        level_code: c.level_code, domain_code: c.domain_code,
        starts_at: c.starts_at, ends_at: c.ends_at, created_at: c.created_at,
        learners: cms.filter((m) => m.cohort_id === c.id && (m.role === "student" || m.role === "child")).length,
        tutors: cms.filter((m) => m.cohort_id === c.id && m.role === "tutor").length,
      })),
      progress_metrics: {
        diagnostics_completed: diag,
        plans_generated: plans,
        checkpoints_completed: checkpoints,
        average_diagnostic_score: avgDiag,
        average_score_delta: avgDelta,
      },
      evidence_events: eventsByType,
      algorithm_versions: algoVersions,
      privacy_note: "No PII included. Anonymized aggregate metrics only.",
    };
  };

  const exportJson = async () => {
    if (!org) return;
    setWorking(true);
    const report = await buildReport();
    setWorking(false);
    if (!report) { toast.error(t("orgReports.failed")); return; }
    downloadBlob(`kogni-org-report-${org.slug || org.id}-${todayStamp()}.json`, "application/json",
      JSON.stringify(report, null, 2));
    toast.success(t("orgReports.exported"));
    if (user) await recordOrgEvent({ event_type: "org_report_exported", organization_id: org.id, actor_id: user.id, extra: { format: "json" } });
  };

  const exportMarkdown = async () => {
    if (!org) return;
    setWorking(true);
    const report = await buildReport();
    setWorking(false);
    if (!report) { toast.error(t("orgReports.failed")); return; }
    const lines: string[] = [];
    lines.push(`# Kogni — ${report.organization.name} — Org Progress Report`);
    lines.push(``);
    lines.push(`Generated: ${report.generated_at}`);
    lines.push(`Type: ${report.organization.type} · Status: ${report.organization.status}`);
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(`- Members: ${report.summary.members}`);
    lines.push(`- Cohorts: ${report.summary.cohorts}`);
    lines.push(`- Learners: ${report.summary.learners}`);
    lines.push(``);
    lines.push(`## Progress metrics`);
    Object.entries(report.progress_metrics).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
    lines.push(``);
    lines.push(`## Cohorts`);
    if (!report.cohorts.length) lines.push("_No cohorts._");
    report.cohorts.forEach((c: any) => {
      lines.push(`### ${c.name}`);
      lines.push(`- Status: ${c.status}`);
      lines.push(`- Level/Domain: ${c.level_code || "—"} / ${c.domain_code || "—"}`);
      lines.push(`- Learners: ${c.learners} · Tutors: ${c.tutors}`);
      lines.push(``);
    });
    lines.push(`## Evidence events`);
    if (!Object.keys(report.evidence_events).length) lines.push("_No events recorded._");
    Object.entries(report.evidence_events).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
    lines.push(``);
    if (report.algorithm_versions.length) {
      lines.push(`## Algorithm versions`);
      report.algorithm_versions.forEach((a: string) => lines.push(`- ${a}`));
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(`_${report.privacy_note}_`);
    downloadBlob(`kogni-org-report-${org.slug || org.id}-${todayStamp()}.md`, "text/markdown", lines.join("\n"));
    toast.success(t("orgReports.exported"));
    if (user) await recordOrgEvent({ event_type: "org_report_exported", organization_id: org.id, actor_id: user.id, extra: { format: "md" } });
  };

  if (forbidden) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader title={t("orgReports.title")} subtitle={org?.name || ""} />
        {loading ? (
          <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2 font-medium"><FileJson className="h-4 w-4" />{t("orgReports.json.title")}</div>
                <p className="text-sm text-muted-foreground">{t("orgReports.json.body")}</p>
                <Button onClick={exportJson} disabled={working} className="gap-2"><Download className="h-4 w-4" />{t("orgReports.exportJson")}</Button>
              </Card>
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />{t("orgReports.md.title")}</div>
                <p className="text-sm text-muted-foreground">{t("orgReports.md.body")}</p>
                <Button onClick={exportMarkdown} disabled={working} variant="outline" className="gap-2"><Download className="h-4 w-4" />{t("orgReports.exportMd")}</Button>
              </Card>
            </div>
            <Card className="p-4 text-xs text-muted-foreground">{t("orgReports.privacyNote")}</Card>
            <div className="pt-2 flex gap-2">
              <Button asChild variant="ghost" size="sm"><Link to={`/org/${orgId}`}>← {t("common.back")}</Link></Button>
              <Button asChild variant="ghost" size="sm"><Link to={`/org/${orgId}/progress`}>{t("orgPage.viewProgress")}</Link></Button>
            </div>
          </>
        )}
      </DashboardShell>
    </AppShell>
  );
}
