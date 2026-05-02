import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { AdminSubNav } from "@/components/admin/AdminSubNav";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "pass" | "warning" | "manual" | "loading";

interface CheckItem {
  id: string;
  status: Status;
  detail?: string;
}

const STATIC_ITEMS = [
  "i18nParity",
  "routeGuards",
  "rlsSanity",
  "privateStorage",
  "signedProofUrls",
  "noPiiExports",
  "legalReview",
] as const;

const DYNAMIC_ITEMS = [
  "livekitEnv",
  "edgeFunctions",
  "approvedTutor",
  "pilotCohort",
  "firstOrg",
  "testUsers",
] as const;

const LaunchChecklist = () => {
  const { t } = useTranslation();
  const [dynamic, setDynamic] = useState<Record<string, CheckItem>>({});

  useEffect(() => {
    (async () => {
      const next: Record<string, CheckItem> = {};
      DYNAMIC_ITEMS.forEach((id) => { next[id] = { id, status: "loading" }; });
      setDynamic({ ...next });

      // LiveKit env — call a safe edge function probe (can't read env from client)
      try {
        const { error } = await supabase.functions.invoke("livekit-token-v2", { body: {} });
        // Function returns 400 (booking_id_required) if env OK, 503 if env missing
        const msg = (error as { message?: string } | null)?.message ?? "";
        if (/setup_required|503/i.test(msg)) {
          next.livekitEnv = { id: "livekitEnv", status: "warning", detail: "LIVEKIT_* not set" };
        } else {
          next.livekitEnv = { id: "livekitEnv", status: "pass" };
        }
      } catch {
        next.livekitEnv = { id: "livekitEnv", status: "manual" };
      }

      next.edgeFunctions = { id: "edgeFunctions", status: "manual" };

      const [tutors, orgs, cohorts, users] = await Promise.all([
        supabase.from("tutor_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "approved"),
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("cohorts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      next.approvedTutor = {
        id: "approvedTutor",
        status: (tutors.count ?? 0) > 0 ? "pass" : "warning",
        detail: `${tutors.count ?? 0}`,
      };
      next.firstOrg = {
        id: "firstOrg",
        status: (orgs.count ?? 0) > 0 ? "pass" : "warning",
        detail: `${orgs.count ?? 0}`,
      };
      next.pilotCohort = {
        id: "pilotCohort",
        status: (cohorts.count ?? 0) > 0 ? "pass" : "warning",
        detail: `${cohorts.count ?? 0}`,
      };
      next.testUsers = {
        id: "testUsers",
        status: (users.count ?? 0) >= 2 ? "pass" : "warning",
        detail: `${users.count ?? 0}`,
      };

      setDynamic({ ...next });
    })();
  }, []);

  const renderRow = (id: string, status: Status, detail?: string) => {
    const Icon =
      status === "pass" ? CheckCircle2 :
      status === "warning" ? AlertTriangle :
      status === "loading" ? Loader2 : Info;
    const tone =
      status === "pass" ? "text-emerald-600" :
      status === "warning" ? "text-amber-600" :
      status === "loading" ? "text-muted-foreground animate-spin" : "text-muted-foreground";
    return (
      <div key={id} className="flex items-start gap-3 py-3 border-b last:border-0">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${tone}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{t(`launchChecklist.items.${id}.title`)}</p>
            <Badge variant="outline" className="text-xs">
              {t(`launchChecklist.status.${status}`)}
            </Badge>
            {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t(`launchChecklist.items.${id}.description`)}</p>
          <p className="text-xs text-muted-foreground mt-1 italic">{t(`launchChecklist.items.${id}.action`)}</p>
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <DashboardShell>
        <AdminSubNav />
          <DashboardHeader
          title={t("launchChecklist.title")}
          subtitle={t("launchChecklist.subtitle")}
        />
        <Surface className="p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t("launchChecklist.sections.qa")}
          </h2>
          <div>
            {STATIC_ITEMS.map((id) => renderRow(id, "manual"))}
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-6 mb-2">
            {t("launchChecklist.sections.runtime")}
          </h2>
          <div>
            {DYNAMIC_ITEMS.map((id) => {
              const item = dynamic[id];
              return renderRow(id, item?.status ?? "loading", item?.detail);
            })}
          </div>
        </Surface>
      </DashboardShell>
    </AppShell>
  );
};

export default LaunchChecklist;
