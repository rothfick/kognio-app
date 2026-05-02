import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, ShieldCheck, Telescope, BadgeCheck, ShoppingBag, Building2,
  Network, FileText, AlertTriangle, ArrowRight, CheckCircle2, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Health = "ok" | "warn" | "unknown";
type Counts = {
  pendingTutors: number;
  pendingPayments: number;
  disputedPayments: number;
  pendingReviews: number;
  approvedTutors: number;
  organizations: number;
  competencies: number;
  evidenceEvents: number;
  upcomingBookings: number;
  diagAttempts: number;
  activeOrgs: number;
};

const initial: Counts = {
  pendingTutors: 0, pendingPayments: 0, disputedPayments: 0, pendingReviews: 0,
  approvedTutors: 0, organizations: 0, competencies: 0, evidenceEvents: 0,
  upcomingBookings: 0, diagAttempts: 0, activeOrgs: 0,
};

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const [c, setC] = useState<Counts>(initial);
  const [recent, setRecent] = useState<Array<{ id: string; event_type: string; created_at: string }>>([]);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [
        pendT, payP, payD, pendR, apprT, orgs, comps, evCount, upBk, diag, actOrgs, recentEv,
      ] = await Promise.all([
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("payment_records").select("id", { count: "exact", head: true }).in("status", ["pending", "proof_uploaded"]),
        supabase.from("payment_records").select("id", { count: "exact", head: true }).eq("status", "disputed"),
        supabase.from("expert_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "approved"),
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("smart_evidence_events").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).gte("ends_at", nowIso).neq("status", "cancelled"),
        supabase.from("diagnostic_attempts").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("smart_evidence_events").select("id, event_type, created_at").order("created_at", { ascending: false }).limit(8),
      ]);
      setC({
        pendingTutors: pendT.count ?? 0,
        pendingPayments: payP.count ?? 0,
        disputedPayments: payD.count ?? 0,
        pendingReviews: pendR.count ?? 0,
        approvedTutors: apprT.count ?? 0,
        organizations: orgs.count ?? 0,
        competencies: comps.count ?? 0,
        evidenceEvents: evCount.count ?? 0,
        upcomingBookings: upBk.count ?? 0,
        diagAttempts: diag.count ?? 0,
        activeOrgs: actOrgs.count ?? 0,
      });
      setRecent(((recentEv.data || []) as Array<{ id: string; event_type: string; created_at: string }>));
    })();
  }, []);

  const healthBadge = (status: Health, label: string) => {
    const cls =
      status === "ok"
        ? "bg-success/10 text-success border-success/30"
        : status === "warn"
          ? "bg-warning/10 text-warning border-warning/30"
          : "bg-muted text-muted-foreground border-border";
    return <Badge variant="outline" className={cls}>{label}</Badge>;
  };

  const platformHealth: Health = c.disputedPayments > 0 ? "warn" : "ok";
  const pilotHealth: Health = c.diagAttempts > 0 ? "ok" : "warn";
  const researchReadiness: Health = c.evidenceEvents > 0 ? "ok" : "warn";
  const marketplaceStatus: Health = c.approvedTutors > 0 ? "ok" : "warn";
  const launchReadiness: Health = c.approvedTutors > 0 && c.competencies > 0 ? "ok" : "warn";

  type Attn = { key: string; count: number; href: string; icon: LucideIcon; tone: "warn" | "info" };
  const attention: Attn[] = [
    { key: "pendingTutors", count: c.pendingTutors, href: "/admin/tutors", icon: ShieldCheck, tone: c.pendingTutors > 0 ? "warn" : "info" },
    { key: "pendingPayments", count: c.pendingPayments, href: "/admin/marketplace", icon: AlertTriangle, tone: c.pendingPayments > 0 ? "warn" : "info" },
    { key: "disputedPayments", count: c.disputedPayments, href: "/admin/marketplace", icon: AlertTriangle, tone: c.disputedPayments > 0 ? "warn" : "info" },
    { key: "pendingReviews", count: c.pendingReviews, href: "/admin/expert-reviews", icon: BadgeCheck, tone: c.pendingReviews > 0 ? "warn" : "info" },
  ].filter((a) => a.count > 0).slice(0, 6);

  type ModuleCard = { key: string; href: string; icon: LucideIcon; stats: Array<{ label: string; value: string | number }> };
  const modules: ModuleCard[] = [
    { key: "operations", href: "/admin/operations", icon: Activity, stats: [{ label: t("adminModule.statDiagnoses"), value: c.diagAttempts }, { label: t("adminModule.statEvents"), value: c.evidenceEvents }] },
    { key: "research", href: "/admin/research", icon: Telescope, stats: [{ label: t("adminModule.statEvents"), value: c.evidenceEvents }] },
    { key: "grantPack", href: "/admin/grant-pack", icon: FileText, stats: [{ label: t("adminModule.statCompetencies"), value: c.competencies }] },
    { key: "marketplace", href: "/admin/marketplace", icon: ShoppingBag, stats: [{ label: t("adminModule.statApprovedTutors"), value: c.approvedTutors }, { label: t("adminModule.statUpcomingBookings"), value: c.upcomingBookings }] },
    { key: "organizations", href: "/admin/organizations", icon: Building2, stats: [{ label: t("adminModule.statOrgs"), value: c.organizations }, { label: t("adminModule.statActiveOrgs"), value: c.activeOrgs }] },
    { key: "curriculum", href: "/admin/curriculum", icon: Network, stats: [{ label: t("adminModule.statCompetencies"), value: c.competencies }] },
    { key: "expertReviews", href: "/admin/expert-reviews", icon: BadgeCheck, stats: [{ label: t("adminModule.statPendingReviews"), value: c.pendingReviews }] },
    { key: "launchChecklist", href: "/admin/launch-checklist", icon: ShieldCheck, stats: [] },
  ];

  return (
    <AdminPageShell title={t("adminOverview.title")} subtitle={t("adminOverview.subtitle")}>
      {/* A. Top status row */}
      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> {t("adminHealth.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {healthBadge(platformHealth, t("adminHealth.platform"))}
          {healthBadge(pilotHealth, t("adminHealth.pilot"))}
          {healthBadge(researchReadiness, t("adminHealth.research"))}
          {healthBadge(marketplaceStatus, t("adminHealth.marketplace"))}
          {healthBadge(launchReadiness, t("adminHealth.launch"))}
        </div>
      </Surface>

      {/* B. Attention needed */}
      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-accent" /> {t("adminAttention.title")}
        </h2>
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {t("adminAttention.allClear")}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attention.map((a) => (
              <li key={a.key}>
                <Link
                  to={a.href}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <a.icon className="h-4 w-4 text-warning" />
                    {t(`adminAttention.${a.key}`)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{a.count}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* C. Module cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {modules.map((m) => (
          <Link key={m.key} to={m.href} className="block">
            <Surface variant="ai" className="p-5 hover:shadow-elegant transition-shadow h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent">
                  <m.icon className="h-4 w-4" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-semibold">{t(`adminModule.${m.key}.title`)}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{t(`adminModule.${m.key}.desc`)}</p>
              {m.stats.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {m.stats.map((s, i) => (
                    <span key={i} className="text-muted-foreground">
                      {s.label}: <span className="text-foreground font-medium tabular-nums">{s.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </Surface>
          </Link>
        ))}
      </div>

      {/* D. Recent activity */}
      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" /> {t("adminOverview.recentTitle")}
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("adminOverview.recentEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{t(`adminEvent.${r.event_type}`, { defaultValue: r.event_type })}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleString(lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {/* Light overall context */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label={t("adminOverview.statApprovedTutors")} value={c.approvedTutors} />
        <StatCard icon={Building2} label={t("adminOverview.statOrgs")} value={c.organizations} />
        <StatCard icon={Network} label={t("adminOverview.statCompetencies")} value={c.competencies} />
      </div>
    </AdminPageShell>
  );
};

export default AdminDashboard;
