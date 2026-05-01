import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Pencil, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AssignmentRow = {
  id: string; title: string; status: string; skill_area_label: string | null;
  source_type: string; due_at: string | null; created_at: string;
  owner_type: string; user_id: string | null; child_id: string | null; booking_id: string | null;
};

export default function Homework() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isTutor, isAdmin } = useUserRoles();
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("assignments")
      .select("id, title, status, skill_area_label, source_type, due_at, created_at, owner_type, user_id, child_id, booking_id")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data || []) as AssignmentRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const generateForSelf = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: latest } = await supabase
        .from("diagnostic_attempts")
        .select("id, summary, learning_domain_id, education_level_id")
        .eq("user_id", user.id).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(1).maybeSingle();
      if (!latest) { toast.error(t("homeworkToast.noContext")); setGenerating(false); return; }
      const lang = (i18n.language || "pl").split("-")[0] as "pl" | "en" | "es";
      const { data, error } = await supabase.functions.invoke("homework-generate", {
        body: {
          source_type: "diagnosis",
          source_id: latest.id,
          owner_type: "user",
          diagnostic_attempt_id: latest.id,
          learning_domain_id: (latest as never as { learning_domain_id: string | null }).learning_domain_id,
          education_level_id: (latest as never as { education_level_id: string | null }).education_level_id,
          language: lang,
        },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error(t("homeworkToast.generateFailed"));
      } else {
        toast.success(t("homeworkToast.generated"));
        await load();
      }
    } finally { setGenerating(false); }
  };

  const headerTitle = isAdmin ? t("homework.adminTitle") : isTutor ? t("homework.tutorTitle") : t("homework.title");
  const headerSub = isAdmin ? "" : isTutor ? t("homework.tutorSubtitle") : t("homework.subtitle");

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={headerTitle}
          subtitle={headerSub}
          actions={!isTutor && !isAdmin ? (
            <Button onClick={generateForSelf} disabled={generating} className="bg-accent-gradient text-accent-foreground">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {t("homework.newCta")}
            </Button>
          ) : undefined}
        />
        {loading ? (
          <Surface className="p-6 animate-pulse h-32"><div /></Surface>
        ) : items.length === 0 ? (
          <Surface className="p-6">
            <EmptyState
              icon={Pencil}
              title={isTutor ? t("homework.emptyTutorTitle") : isAdmin ? t("homework.emptyAdminTitle") : t("homework.emptyTitle")}
              description={isTutor ? t("homework.emptyTutorDesc") : t("homework.emptyDesc")}
            />
          </Surface>
        ) : (
          <div className="grid gap-3">
            {items.map((a) => (
              <Surface key={a.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm truncate">{a.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">{t(`assignment.status.${a.status}`)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t(`assignment.source.${a.source_type}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.skill_area_label ? `${t("homework.skillArea")}: ${a.skill_area_label} · ` : ""}
                    {a.due_at ? `${t("homework.due")}: ${new Date(a.due_at).toLocaleDateString(i18n.language)}` : t("homework.noDue")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/homework/${a.id}`}>
                    {a.status === "graded" ? t("homework.reviewCta") : a.status === "in_progress" ? t("homework.continueCta") : t("homework.startCta")}
                  </Link>
                </Button>
              </Surface>
            ))}
          </div>
        )}
      </DashboardShell>
    </AppShell>
  );
}
