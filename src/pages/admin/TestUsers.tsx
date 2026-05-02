import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Users, Sparkles, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Account = {
  key: string;
  email: string;
  role: string;
  scenario: string;
  userId: string;
  created: boolean;
  password: string;
};

type SeedResult = {
  ok: boolean;
  mode: string;
  accounts: Account[];
  scenarioNotes?: string[];
  errors?: string[];
  defaultPassword: string;
  seedBatch: string;
};

type CleanupResult = { ok: boolean; summary: Record<string, number | string> };

const QUICK_LINKS = [
  { to: "/auth", labelKey: "testUsers.links.login" },
  { to: "/dashboard/student", labelKey: "testUsers.links.student" },
  { to: "/dashboard/parent", labelKey: "testUsers.links.parent" },
  { to: "/dashboard/tutor", labelKey: "testUsers.links.tutor" },
  { to: "/dashboard/admin", labelKey: "testUsers.links.admin" },
  { to: "/discover", labelKey: "testUsers.links.discover" },
  { to: "/calendar", labelKey: "testUsers.links.calendar" },
  { to: "/homework", labelKey: "testUsers.links.homework" },
  { to: "/flashcards", labelKey: "testUsers.links.flashcards" },
  { to: "/admin/research", labelKey: "testUsers.links.research" },
  { to: "/admin/operations", labelKey: "testUsers.links.operations" },
  { to: "/admin/organizations", labelKey: "testUsers.links.organizations" },
];

export default function TestUsers() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<null | "users" | "full" | "clean">(null);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);

  const isProd = typeof window !== "undefined" &&
    /(^|\.)kognio?\.app$/i.test(window.location.hostname);

  const seed = async (mode: "users_only" | "full_scenarios") => {
    setLoading(mode === "users_only" ? "users" : "full");
    try {
      const { data, error } = await supabase.functions.invoke<SeedResult>("admin-seed-test-users", {
        body: { mode, reset_existing_test_data: false },
      });
      if (error) throw error;
      setResult(data ?? null);
      toast.success(t("testUsers.toasts.seeded"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(null);
    }
  };

  const clean = async () => {
    if (!confirm(t("testUsers.confirmCleanup"))) return;
    setLoading("clean");
    try {
      const { data, error } = await supabase.functions.invoke<CleanupResult>("admin-clean-test-data", {
        body: { confirm: "DELETE_TEST_DATA" },
      });
      if (error) throw error;
      setCleanup(data ?? null);
      setResult(null);
      toast.success(t("testUsers.toasts.cleaned"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <AdminPageShell
      title={t("testUsers.title")}
      subtitle={t("testUsers.subtitle")}
      wide
    >
      {/* Safety banner */}
      <Surface className="p-4 mb-6 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">{t("testUsers.safety.title")}</p>
            <p className="text-muted-foreground mt-1">{t("testUsers.safety.body")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={isProd ? "destructive" : "secondary"}>
                {isProd ? t("testUsers.safety.prodDetected") : t("testUsers.safety.nonProd")}
              </Badge>
              <Badge variant="outline">{`@test.kogni.local`}</Badge>
              <Badge variant="outline">{`[TEST]`}</Badge>
            </div>
          </div>
        </div>
      </Surface>

      {/* Controls */}
      <Surface className="p-5 mb-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => seed("users_only")} disabled={!!loading}>
            {loading === "users" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            {t("testUsers.actions.usersOnly")}
          </Button>
          <Button onClick={() => seed("full_scenarios")} disabled={!!loading} variant="secondary">
            {loading === "full" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t("testUsers.actions.fullScenarios")}
          </Button>
          <Button onClick={clean} disabled={!!loading} variant="destructive">
            {loading === "clean" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            {t("testUsers.actions.cleanup")}
          </Button>
          <Button onClick={() => location.reload()} variant="outline" disabled={!!loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("testUsers.actions.refresh")}
          </Button>
        </div>
        {result?.defaultPassword && (
          <p className="text-xs text-muted-foreground mt-3">
            {t("testUsers.defaultPassword")}: <code className="font-mono">{result.defaultPassword}</code>
          </p>
        )}
      </Surface>

      {/* Accounts table */}
      {result && (
        <Surface className="p-0 mb-6 overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold text-sm">{t("testUsers.tableTitle")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">{t("testUsers.cols.email")}</th>
                  <th className="text-left px-4 py-2">{t("testUsers.cols.role")}</th>
                  <th className="text-left px-4 py-2">{t("testUsers.cols.scenario")}</th>
                  <th className="text-left px-4 py-2">{t("testUsers.cols.status")}</th>
                  <th className="text-left px-4 py-2">{t("testUsers.cols.password")}</th>
                </tr>
              </thead>
              <tbody>
                {result.accounts.map((a) => (
                  <tr key={a.key} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{a.email}</td>
                    <td className="px-4 py-2">{a.role}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.scenario}</td>
                    <td className="px-4 py-2">
                      <Badge variant={a.created ? "default" : "outline"}>
                        {a.created ? t("testUsers.status.created") : t("testUsers.status.existed")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{a.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="px-5 py-3 border-t bg-destructive/5 text-xs">
              <p className="font-medium text-destructive mb-1">{t("testUsers.errors")}:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {result.scenarioNotes && result.scenarioNotes.length > 0 && (
            <div className="px-5 py-3 border-t text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">{t("testUsers.scenarioNotes")}:</p>
              <ul className="list-disc pl-5">
                {result.scenarioNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
        </Surface>
      )}

      {/* Cleanup result */}
      {cleanup && (
        <Surface className="p-5 mb-6">
          <h2 className="font-semibold text-sm mb-2">{t("testUsers.cleanupSummary")}</h2>
          <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto">
            {JSON.stringify(cleanup.summary, null, 2)}
          </pre>
        </Surface>
      )}

      {/* Quick links */}
      <Surface className="p-5">
        <h2 className="font-semibold text-sm mb-3">{t("testUsers.quickLinks")}</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Button key={l.to} asChild variant="outline" size="sm">
              <Link to={l.to}>
                {t(l.labelKey)} <ExternalLink className="h-3 w-3 ml-1.5" />
              </Link>
            </Button>
          ))}
        </div>
      </Surface>
    </AdminPageShell>
  );
}
