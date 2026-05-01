import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, GraduationCap } from "lucide-react";
import { toast } from "sonner";

type TutorProfileRow = {
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
};

const TutorOnboarding = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<TutorProfileRow | null>(null);

  const [form, setForm] = useState({
    display_name: "",
    headline: "",
    bio: "",
    hourly_rate: "",
    currency: "PLN",
    languages: "pl",
    teaching_domains: "",
    education_levels: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("tutor_profiles")
        .select("user_id, display_name, headline, bio, hourly_rate, currency, languages, teaching_domains, education_levels, is_verified, verification_status, verification_notes")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const row = data as TutorProfileRow;
        setProfile(row);
        setForm({
          display_name: row.display_name || "",
          headline: row.headline || "",
          bio: row.bio || "",
          hourly_rate: row.hourly_rate ? String(row.hourly_rate) : "",
          currency: row.currency || "PLN",
          languages: (row.languages || []).join(", "),
          teaching_domains: (row.teaching_domains || []).join(", "),
          education_levels: (row.education_levels || []).join(", "),
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!form.display_name.trim() || !form.headline.trim() || !form.hourly_rate) {
      toast.error(t("tutorOnboarding.errors.required"));
      return;
    }
    setSubmitting(true);
    const payload = {
      user_id: user.id,
      display_name: form.display_name.trim(),
      headline: form.headline.trim(),
      bio: form.bio.trim() || null,
      hourly_rate: Number(form.hourly_rate),
      hourly_rate_cents: Math.round(Number(form.hourly_rate) * 100),
      currency: form.currency,
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
      teaching_domains: form.teaching_domains.split(",").map((s) => s.trim()).filter(Boolean),
      education_levels: form.education_levels.split(",").map((s) => s.trim()).filter(Boolean),
    };

    const { error } = profile
      ? await supabase.from("tutor_profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("tutor_profiles").insert(payload);

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Log smart evidence event (non-blocking)
    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "tutor_profile_submitted",
        owner_type: "user",
        user_id: user.id,
        algorithm_version: "tutor_onboarding_v1",
        input_summary: { has_existing: !!profile },
        output_summary: { verification_status: "pending" },
        metrics: {},
        created_by: user.id,
      } as never);
    } catch { /* ignore */ }

    toast.success(t("tutorOnboarding.submitted"));
    setSubmitting(false);
    // refresh
    const { data } = await supabase
      .from("tutor_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setProfile(data as TutorProfileRow);
  };

  if (loading) {
    return <AppShell><div className="container py-12 text-muted-foreground text-sm">{t("common.loadingPanel")}</div></AppShell>;
  }

  const status = profile?.verification_status || "draft";
  const isApproved = profile?.is_verified && status === "approved";
  const isPending = status === "pending" && !!profile;
  const isRejected = status === "rejected";

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("tutorOnboarding.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tutorOnboarding.subtitle")}</p>
          </div>
        </div>

        {profile && (
          <Surface className="p-5 mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isApproved && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                {isPending && <Clock className="h-5 w-5 text-amber-600" />}
                {isRejected && <XCircle className="h-5 w-5 text-destructive" />}
                <div>
                  <p className="text-sm font-medium">{t(`tutorOnboarding.status.${status}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`tutorOnboarding.statusHint.${status}`)}</p>
                </div>
              </div>
              <Badge variant={isApproved ? "default" : isRejected ? "destructive" : "secondary"}>
                {status}
              </Badge>
            </div>
            {profile.verification_notes && (
              <p className="mt-3 text-sm text-muted-foreground border-l-2 border-accent/40 pl-3">
                {profile.verification_notes}
              </p>
            )}
          </Surface>
        )}

        <Surface className="p-6 space-y-4">
          <div>
            <Label>{t("tutorOnboarding.fields.displayName")}</Label>
            <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div>
            <Label>{t("tutorOnboarding.fields.headline")}</Label>
            <Input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} placeholder={t("tutorOnboarding.placeholders.headline")} />
          </div>
          <div>
            <Label>{t("tutorOnboarding.fields.bio")}</Label>
            <Textarea rows={4} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder={t("tutorOnboarding.placeholders.bio")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("tutorOnboarding.fields.hourlyRate")}</Label>
              <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))} />
            </div>
            <div>
              <Label>{t("tutorOnboarding.fields.currency")}</Label>
              <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div>
            <Label>{t("tutorOnboarding.fields.languages")}</Label>
            <Input value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} placeholder="pl, en, es" />
            <p className="text-xs text-muted-foreground mt-1">{t("tutorOnboarding.hints.commaSeparated")}</p>
          </div>
          <div>
            <Label>{t("tutorOnboarding.fields.teachingDomains")}</Label>
            <Input value={form.teaching_domains} onChange={(e) => setForm((f) => ({ ...f, teaching_domains: e.target.value }))} placeholder={t("tutorOnboarding.placeholders.domains")} />
            <p className="text-xs text-muted-foreground mt-1">{t("tutorOnboarding.hints.commaSeparated")}</p>
          </div>
          <div>
            <Label>{t("tutorOnboarding.fields.educationLevels")}</Label>
            <Input value={form.education_levels} onChange={(e) => setForm((f) => ({ ...f, education_levels: e.target.value }))} placeholder={t("tutorOnboarding.placeholders.levels")} />
            <p className="text-xs text-muted-foreground mt-1">{t("tutorOnboarding.hints.commaSeparated")}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            {t("tutorOnboarding.verificationStatement")}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>{t("common.cancel")}</Button>
            <Button onClick={submit} disabled={submitting} className="bg-accent-gradient text-accent-foreground">
              {profile ? t("tutorOnboarding.update") : t("tutorOnboarding.submit")}
            </Button>
          </div>
        </Surface>
      </div>
    </AppShell>
  );
};

export default TutorOnboarding;
