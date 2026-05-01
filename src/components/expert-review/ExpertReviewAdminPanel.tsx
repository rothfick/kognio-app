import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, ClipboardCheck, Loader2, Percent, Sparkles, ListChecks, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

type RecentReview = {
  id: string;
  review_type: string;
  status: string;
  agreement_score: number | null;
  submitted_at: string | null;
  created_at: string;
};
type Diag = { id: string; created_at: string; user_id: string | null; child_id: string | null; domain: string | null; level: string | null; score: number | null; summary: { kc_breakdown?: Array<{ kc_label?: string; mastery_pct?: number; status?: string }>; recommendations?: string[]; gaps?: string[]; strengths?: string[]; overall_level?: string } | null };
type Plan = { id: string; created_at: string; user_id: string | null; child_id: string | null; owner_type: string; title: string; domain: string | null; level: string | null; diagnostic_attempt_id: string | null; algorithm_version: string };
type CP = { id: string; created_at: string; user_id: string | null; child_id: string | null; owner_type: string; learning_plan_id: string | null; baseline_score: number | null; checkpoint_score: number | null; score_delta: number | null; mastery_delta: Array<{ skill_area_label?: string; delta?: number | null }> | null };
type PlanItem = { id: string; title: string; skill_area: string | null; kind: string; difficulty_level: number | null };

export function ExpertReviewAdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    created: number; submitted: number; avgAgreement: number | null;
    disagreements: number; correctionRate: number | null;
    byType: { diagnostic: number; learning_plan: number; checkpoint: number };
  } | null>(null);
  const [recent, setRecent] = useState<RecentReview[] | null>(null);
  const [diags, setDiags] = useState<Diag[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cps, setCps] = useState<CP[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [created, submitted, allRev, byTypeRows, latestRev, dRes, pRes, cRes] = await Promise.all([
      supabase.from("expert_reviews").select("id", { count: "exact", head: true }),
      supabase.from("expert_reviews").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("expert_reviews").select("agreement_score, correction_summary, status").eq("status", "submitted"),
      supabase.from("expert_reviews").select("review_type, status"),
      supabase.from("expert_reviews").select("id, review_type, status, agreement_score, submitted_at, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("diagnostic_attempts").select("id, created_at, user_id, child_id, domain, level, score, summary").eq("status", "completed").order("created_at", { ascending: false }).limit(5),
      supabase.from("learning_plans").select("id, created_at, user_id, child_id, owner_type, title, domain, level, diagnostic_attempt_id, algorithm_version").order("created_at", { ascending: false }).limit(5),
      supabase.from("learning_checkpoints").select("id, created_at, user_id, child_id, owner_type, learning_plan_id, baseline_score, checkpoint_score, score_delta, mastery_delta").eq("status", "completed").order("created_at", { ascending: false }).limit(5),
    ]);

    const submittedRows = (allRev.data || []) as Array<{ agreement_score: number | null; correction_summary: { correction_rate?: number | null; disagree?: number } | null }>;
    const scores = submittedRows.map((r) => r.agreement_score).filter((x): x is number => typeof x === "number");
    const corrections = submittedRows.map((r) => r.correction_summary?.correction_rate).filter((x): x is number => typeof x === "number");
    const disagreementsTotal = submittedRows.reduce((acc, r) => acc + (r.correction_summary?.disagree ?? 0), 0);
    const byType = { diagnostic: 0, learning_plan: 0, checkpoint: 0 };
    for (const row of (byTypeRows.data || []) as Array<{ review_type: keyof typeof byType }>) {
      if (row.review_type in byType) byType[row.review_type]++;
    }
    setStats({
      created: created.count ?? 0,
      submitted: submitted.count ?? 0,
      avgAgreement: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      disagreements: disagreementsTotal,
      correctionRate: corrections.length ? corrections.reduce((a, b) => a + b, 0) / corrections.length : null,
      byType,
    });
    setRecent((latestRev.data || []) as RecentReview[]);
    setDiags((dRes.data || []) as Diag[]);
    setPlans((pRes.data || []) as Plan[]);
    setCps((cRes.data || []) as CP[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createReview = async (
    reviewType: "diagnostic" | "learning_plan" | "checkpoint",
    source: { id: string; user_id: string | null; child_id: string | null }
  ) => {
    if (!user) return;
    if (!source.user_id && !source.child_id) {
      toast.error(t("expertReview.errors.noOwner"));
      return;
    }
    setCreating(`${reviewType}-${source.id}`);
    try {
      const owner_type = source.child_id ? "child" : "user";
      const ai_summary: Record<string, unknown> = {};
      const items: Array<{ item_type: string; skill_area_label: string | null; ai_value: Record<string, unknown> }> = [];

      if (reviewType === "diagnostic") {
        const d = diags.find((x) => x.id === source.id);
        ai_summary.score = d?.score ?? null;
        ai_summary.overall_level = d?.summary?.overall_level ?? null;
        ai_summary.gaps = d?.summary?.gaps ?? [];
        ai_summary.strengths = d?.summary?.strengths ?? [];
        ai_summary.recommendations = d?.summary?.recommendations ?? [];
        const breakdown = d?.summary?.kc_breakdown ?? [];
        for (const b of breakdown) {
          items.push({
            item_type: "mastery_score",
            skill_area_label: b.kc_label ?? null,
            ai_value: { mastery_pct: b.mastery_pct, status: b.status },
          });
        }
        for (const g of (d?.summary?.gaps ?? [])) {
          items.push({ item_type: "skill_gap", skill_area_label: g, ai_value: { gap: g } });
        }
        for (const r of (d?.summary?.recommendations ?? [])) {
          items.push({ item_type: "recommendation", skill_area_label: null, ai_value: { recommendation: r } });
        }
      } else if (reviewType === "learning_plan") {
        const p = plans.find((x) => x.id === source.id);
        ai_summary.title = p?.title;
        ai_summary.domain = p?.domain;
        ai_summary.level = p?.level;
        ai_summary.algorithm_version = p?.algorithm_version;
        const { data: pi } = await supabase
          .from("learning_plan_items")
          .select("id, title, skill_area, kind, difficulty_level")
          .eq("plan_id", source.id)
          .order("order_index");
        for (const it of ((pi || []) as PlanItem[])) {
          items.push({
            item_type: "plan_step",
            skill_area_label: it.skill_area,
            ai_value: { title: it.title, kind: it.kind, difficulty_level: it.difficulty_level },
          });
        }
      } else if (reviewType === "checkpoint") {
        const c = cps.find((x) => x.id === source.id);
        ai_summary.baseline_score = c?.baseline_score;
        ai_summary.checkpoint_score = c?.checkpoint_score;
        ai_summary.score_delta = c?.score_delta;
        const md = (c?.mastery_delta ?? []) as Array<{ skill_area_label?: string; delta?: number | null }>;
        for (const m of md) {
          items.push({
            item_type: "checkpoint_delta",
            skill_area_label: m.skill_area_label ?? null,
            ai_value: { delta: m.delta },
          });
        }
      }

      const { data: review, error } = await supabase
        .from("expert_reviews")
        .insert({
          review_type: reviewType,
          owner_type,
          user_id: source.user_id,
          child_id: source.child_id,
          diagnostic_attempt_id: reviewType === "diagnostic" ? source.id : null,
          learning_plan_id: reviewType === "learning_plan" ? source.id : null,
          checkpoint_id: reviewType === "checkpoint" ? source.id : null,
          reviewer_id: user.id,
          reviewer_role: "expert",
          status: "draft",
          ai_summary: ai_summary as never,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const { error: ie } = await supabase.from("expert_review_items").insert(
          items.map((it) => ({
            expert_review_id: (review as { id: string }).id,
            item_type: it.item_type,
            skill_area_label: it.skill_area_label,
            ai_value: it.ai_value as never,
          }))
        );
        if (ie) throw ie;
      }

      toast.success(t("expertReview.created"));
      const reviewId = (review as { id: string }).id;
      await createNotification({
        userId: user.id,
        type: "expert_review_assigned",
        severity: "info",
        title: t("notifications.expert_review_assigned.title"),
        body: t("notifications.expert_review_assigned.body", { type: t(`expertReview.types.${reviewType}`, reviewType) }),
        actionLabel: t("notifications.expert_review_assigned.action"),
        actionUrl: `/expert/reviews/${reviewId}`,
        metadata: { review_id: reviewId, review_type: reviewType },
      });
      navigate(`/expert/reviews/${reviewId}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(null);
    }
  };

  const ownerOf = (row: { user_id: string | null; child_id: string | null }) => row.user_id || row.child_id;

  return (
    <Surface className="p-5 mb-6">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-accent" /> {t("expertReview.adminSection")}
      </h2>

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard icon={ListChecks} label={t("expertReview.metrics.created")} value={stats === null ? "…" : String(stats.created)} />
        <StatCard icon={ClipboardCheck} label={t("expertReview.metrics.submitted")} value={stats === null ? "…" : String(stats.submitted)} />
        <StatCard icon={Sparkles} label={t("expertReview.metrics.avgAgreement")} value={stats === null || stats.avgAgreement === null ? "—" : `${Math.round(stats.avgAgreement * 100)}%`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard icon={AlertTriangle} label={t("expertReview.metrics.disagreements")} value={stats === null ? "…" : String(stats.disagreements)} />
        <StatCard icon={Percent} label={t("expertReview.metrics.correctionRate")} value={stats === null || stats.correctionRate === null ? "—" : `${Math.round(stats.correctionRate * 100)}%`} />
        <StatCard
          icon={ClipboardCheck}
          label={t("expertReview.metrics.byType")}
          value={stats === null ? "…" : `${stats.byType.diagnostic}/${stats.byType.learning_plan}/${stats.byType.checkpoint}`}
          hint={t("expertReview.metrics.byTypeHint")}
        />
      </div>

      <div className="rounded-md border border-border/60 p-3 mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("expertReview.recentSubmitted")}</p>
        {recent === null ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("expertReview.noRecent")}</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px]">{t(`expertReview.types.${r.review_type}`, { defaultValue: r.review_type })}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{t(`expertReview.status.${r.status}`)}</Badge>
                  {r.agreement_score != null && (
                    <span className="text-muted-foreground tabular-nums">{Math.round(r.agreement_score * 100)}%</span>
                  )}
                  <span className="text-muted-foreground truncate">{new Date(r.submitted_at || r.created_at).toLocaleString()}</span>
                </div>
                <Link to={`/expert/reviews/${r.id}`} className="text-accent text-[11px]">{t("expertReview.openReview")}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <CreateBlock title={t("expertReview.createDiagnostic")}>
          {diags.length === 0 ? <p className="text-[11px] text-muted-foreground">{t("expertReview.noSource")}</p> : diags.map((d) => (
            <RowAction
              key={d.id}
              label={`${d.domain || "—"} • ${d.level || "—"} • ${d.score == null ? "—" : Math.round(Number(d.score) * 100) + "%"}`}
              hint={new Date(d.created_at).toLocaleDateString()}
              disabled={creating === `diagnostic-${d.id}` || !ownerOf(d)}
              loading={creating === `diagnostic-${d.id}`}
              onClick={() => createReview("diagnostic", { id: d.id, user_id: d.user_id, child_id: d.child_id })}
              ctaLabel={t("expertReview.createCta")}
            />
          ))}
        </CreateBlock>
        <CreateBlock title={t("expertReview.createPlan")}>
          {plans.length === 0 ? <p className="text-[11px] text-muted-foreground">{t("expertReview.noSource")}</p> : plans.map((p) => (
            <RowAction
              key={p.id}
              label={p.title}
              hint={`${p.domain || "—"} · ${new Date(p.created_at).toLocaleDateString()}`}
              disabled={creating === `learning_plan-${p.id}` || !ownerOf(p)}
              loading={creating === `learning_plan-${p.id}`}
              onClick={() => createReview("learning_plan", { id: p.id, user_id: p.user_id, child_id: p.child_id })}
              ctaLabel={t("expertReview.createCta")}
            />
          ))}
        </CreateBlock>
        <CreateBlock title={t("expertReview.createCheckpoint")}>
          {cps.length === 0 ? <p className="text-[11px] text-muted-foreground">{t("expertReview.noSource")}</p> : cps.map((c) => (
            <RowAction
              key={c.id}
              label={`Δ ${c.score_delta == null ? "—" : (c.score_delta >= 0 ? "+" : "") + Math.round(c.score_delta * 100) + "%"}`}
              hint={new Date(c.created_at).toLocaleDateString()}
              disabled={creating === `checkpoint-${c.id}` || !ownerOf(c)}
              loading={creating === `checkpoint-${c.id}`}
              onClick={() => createReview("checkpoint", { id: c.id, user_id: c.user_id, child_id: c.child_id })}
              ctaLabel={t("expertReview.createCta")}
            />
          ))}
        </CreateBlock>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{t("expertReview.assignmentNote")}</p>
    </Surface>
  );
}

function CreateBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowAction({ label, hint, ctaLabel, onClick, disabled, loading }: { label: string; hint?: string; ctaLabel: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs border border-border/40 rounded p-2">
      <div className="min-w-0">
        <p className="font-medium truncate">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={onClick} disabled={disabled} className="shrink-0">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : ctaLabel}
      </Button>
    </div>
  );
}
