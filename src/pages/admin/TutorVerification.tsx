import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { AdminSubNav } from "@/components/admin/AdminSubNav";
import { RoleGate } from "@/components/auth/RoleGate";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

type Row = {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  hourly_rate: number | null;
  currency: string;
  languages: string[];
  teaching_domains: string[];
  education_levels: string[];
  is_verified: boolean;
  verification_status: string;
  verification_notes: string | null;
  created_at: string;
};

const TutorVerification = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tutor_profiles")
      .select("user_id, display_name, headline, bio, hourly_rate, currency, languages, teaching_domains, education_levels, is_verified, verification_status, verification_notes, created_at")
      .eq("verification_status", tab)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const decide = async (userId: string, approve: boolean) => {
    const note = notes[userId] || null;
    const { error } = await supabase.rpc("admin_verify_tutor", {
      _tutor_user_id: userId,
      _approve: approve,
      _notes: note,
    });
    if (error) { toast.error(error.message); return; }

    // Notify tutor
    await createNotification({
      userId,
      type: approve ? "pilot_update" : "pilot_update",
      title: approve ? t("tutorVerification.notify.approvedTitle") : t("tutorVerification.notify.rejectedTitle"),
      body: note || (approve ? t("tutorVerification.notify.approvedBody") : t("tutorVerification.notify.rejectedBody")),
      actionLabel: t("tutorVerification.notify.openProfile"),
      actionUrl: "/tutor/onboarding",
      severity: approve ? "success" : "warning",
    });

    // Smart evidence (non-blocking)
    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: approve ? "tutor_profile_approved" : "tutor_profile_rejected",
        owner_type: "user",
        user_id: userId,
        algorithm_version: "tutor_verification_v1",
        input_summary: { has_notes: !!note },
        output_summary: { verification_status: approve ? "approved" : "rejected" },
        metrics: {},
      } as never);
    } catch { /* ignore */ }

    toast.success(approve ? t("tutorVerification.approved") : t("tutorVerification.rejected"));
    load();
  };

  return (
    <RoleGate allow={["admin"]}>
      <AppShell>
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <AdminSubNav />
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("tutorVerification.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("tutorVerification.subtitle")}</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="pending">{t("tutorVerification.tabs.pending")}</TabsTrigger>
              <TabsTrigger value="approved">{t("tutorVerification.tabs.approved")}</TabsTrigger>
              <TabsTrigger value="rejected">{t("tutorVerification.tabs.rejected")}</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4 space-y-3">
              {loading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
              {!loading && rows.length === 0 && (
                <Surface className="p-8 text-center text-sm text-muted-foreground">
                  {t("tutorVerification.empty")}
                </Surface>
              )}
              {rows.map((r) => (
                <Surface key={r.user_id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold">{r.display_name || "—"}</h3>
                      <p className="text-sm text-muted-foreground">{r.headline}</p>
                    </div>
                    <Badge variant={r.is_verified ? "default" : "secondary"}>
                      {r.verification_status}
                    </Badge>
                  </div>
                  {r.bio && <p className="text-sm mb-3 whitespace-pre-wrap">{r.bio}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground mb-3">
                    <div><strong className="text-foreground">{t("tutorVerification.field.rate")}:</strong> {r.hourly_rate} {r.currency}</div>
                    <div><strong className="text-foreground">{t("tutorVerification.field.languages")}:</strong> {(r.languages || []).join(", ") || "—"}</div>
                    <div><strong className="text-foreground">{t("tutorVerification.field.domains")}:</strong> {(r.teaching_domains || []).join(", ") || "—"}</div>
                    <div><strong className="text-foreground">{t("tutorVerification.field.levels")}:</strong> {(r.education_levels || []).join(", ") || "—"}</div>
                  </div>
                  {r.verification_notes && (
                    <p className="text-xs italic text-muted-foreground border-l-2 border-accent/40 pl-3 mb-3">
                      {r.verification_notes}
                    </p>
                  )}
                  {tab === "pending" && (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder={t("tutorVerification.notesPlaceholder")}
                        value={notes[r.user_id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.user_id]: e.target.value }))}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => decide(r.user_id, false)}>
                          <XCircle className="h-4 w-4 mr-1" /> {t("tutorVerification.reject")}
                        </Button>
                        <Button size="sm" className="bg-accent-gradient text-accent-foreground" onClick={() => decide(r.user_id, true)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> {t("tutorVerification.approve")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Surface>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    </RoleGate>
  );
};

export default TutorVerification;
