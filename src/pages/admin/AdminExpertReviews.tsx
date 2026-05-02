import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { BadgeCheck, ClipboardList, AlertTriangle, Sparkles, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  total: number; pending: number; submitted: number;
  avgAgreement: number | null; correctionRate: number | null;
  recent: Array<{ id: string; created_at: string; status: string }>;
};

const AdminExpertReviews = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [tot, pend, subm, agreement, recent] = await Promise.all([
        supabase.from("expert_reviews").select("id", { count: "exact", head: true }),
        supabase.from("expert_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("expert_reviews").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("expert_reviews").select("agreement_score, correction_summary").eq("status", "submitted"),
        supabase.from("expert_reviews").select("id, created_at, status").order("created_at", { ascending: false }).limit(8),
      ]);
      const agreeRows = ((agreement.data || []) as Array<{ agreement_score: number | null; correction_summary: string | null }>);
      const agreeVals = agreeRows.map((r) => r.agreement_score).filter((v): v is number => typeof v === "number");
      const corrCount = agreeRows.filter((r) => !!r.correction_summary && r.correction_summary.trim().length > 0).length;
      setS({
        total: tot.count ?? 0,
        pending: pend.count ?? 0,
        submitted: subm.count ?? 0,
        avgAgreement: agreeVals.length ? agreeVals.reduce((a, b) => a + b, 0) / agreeVals.length : null,
        correctionRate: agreeRows.length ? corrCount / agreeRows.length : null,
        recent: ((recent.data || []) as Array<{ id: string; created_at: string; status: string }>),
      });
    })();
  }, []);

  const v = (n?: number | null) => (n === undefined || n === null ? "—" : String(n));
  const p = (n?: number | null) => (n === undefined || n === null ? "—" : `${Math.round(n * 100)}%`);

  return (
    <AdminPageShell title={t("adminExpertReviews.title")} subtitle={t("adminExpertReviews.subtitle")}>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard icon={ClipboardList} label={t("adminExpertReviews.total")} value={v(s?.total)} />
        <StatCard icon={AlertTriangle} label={t("adminExpertReviews.pending")} value={v(s?.pending)} />
        <StatCard icon={BadgeCheck} label={t("adminExpertReviews.submitted")} value={v(s?.submitted)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard icon={Sparkles} label={t("adminExpertReviews.avgAgreement")} value={p(s?.avgAgreement)} />
        <StatCard icon={Percent} label={t("adminExpertReviews.correctionRate")} value={p(s?.correctionRate)} />
      </div>

      <Surface className="p-5">
        <h2 className="font-semibold mb-3">{t("adminExpertReviews.recentTitle")}</h2>
        {s === null ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : s.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("adminExpertReviews.recentEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {s.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</span>
                <span className="text-xs">{t(`adminExpertReviews.status.${r.status}`, { defaultValue: r.status })}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleString(lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </AdminPageShell>
  );
};

export default AdminExpertReviews;
