import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldCheck, Star, Globe, GraduationCap, Calendar as CalIcon, ArrowRight, AlertTriangle } from "lucide-react";

interface TutorProfileRow {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  hourly_rate: number | null;
  hourly_rate_cents: number;
  currency: string;
  rating: number | null;
  reviews_count: number;
  languages: string[];
  teaching_domains: string[];
  education_levels: string[];
  profile_photo_url: string | null;
  is_verified: boolean;
  verification_status: string;
  years_experience: number | null;
  sessions_completed: number;
}

interface SlotRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const TutorPublicProfile = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const [profile, setProfile] = useState<TutorProfileRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) return;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("tutor_profiles")
        .select("user_id, display_name, headline, bio, hourly_rate, hourly_rate_cents, currency, rating, reviews_count, languages, teaching_domains, education_levels, profile_photo_url, is_verified, verification_status, years_experience, sessions_completed")
        .eq("user_id", tutorId)
        .maybeSingle();
      setProfile((prof as TutorProfileRow) ?? null);
      const { data: av } = await supabase
        .from("tutor_availability_slots")
        .select("weekday, start_time, end_time")
        .eq("tutor_user_id", tutorId);
      setSlots((av as SlotRow[]) || []);
      setLoading(false);
    })();
  }, [tutorId]);

  if (loading) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-4xl p-8">
          <Card className="h-64 animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-2xl p-8">
          <Card className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">{t("tutor.notFound.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tutor.notFound.body")}</p>
            <Button asChild variant="outline"><Link to="/discover">{t("tutor.notFound.cta")}</Link></Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const isOwner = user?.id === profile.user_id;
  const isApproved = profile.is_verified && profile.verification_status === "approved";

  if (!isApproved && !isOwner && !isAdmin) {
    return (
      <AppShell>
        <div className="container mx-auto max-w-2xl p-8">
          <Card className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">{t("tutor.unavailable.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tutor.unavailable.body")}</p>
            <Button asChild variant="outline"><Link to="/discover">{t("tutor.unavailable.cta")}</Link></Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  const initials = (profile.display_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const rate = profile.hourly_rate ?? profile.hourly_rate_cents / 100;

  return (
    <AppShell>
      <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        {!isApproved ? (
          <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm">
              <div className="font-medium">{t("tutor.statusBanner.title")}</div>
              <div className="text-muted-foreground">
                {t(`tutor.statusBanner.${profile.verification_status}`, { defaultValue: profile.verification_status })}
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <Avatar className="h-24 w-24">
              {profile.profile_photo_url ? <AvatarImage src={profile.profile_photo_url} /> : null}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{profile.display_name || t("marketplace.unnamed")}</h1>
                  {isApproved ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> {t("marketplace.verified")}
                    </Badge>
                  ) : null}
                </div>
                {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-accent text-accent" />
                  {(profile.rating ?? 0).toFixed(1)} · {profile.reviews_count} {t("marketplace.reviews")}
                </span>
                {profile.languages?.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-4 w-4" /> {profile.languages.map((l) => l.toUpperCase()).join(", ")}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <div className="text-2xl font-semibold">{rate.toFixed(0)} {profile.currency}</div>
                  <div className="text-xs text-muted-foreground">{t("marketplace.perHour")}</div>
                </div>
                {isApproved ? (
                  <Button asChild>
                    <Link to={`/book/${profile.user_id}`}>
                      <CalIcon className="mr-2 h-4 w-4" /> {t("tutor.bookSession")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {profile.bio ? (
          <Card className="space-y-2 p-6">
            <h2 className="font-semibold">{t("tutor.about")}</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{profile.bio}</p>
          </Card>
        ) : null}

        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{t("tutor.teaching")}</h2>
          {profile.teaching_domains?.length ? (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{t("tutor.domains")}</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.teaching_domains.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
              </div>
            </div>
          ) : null}
          {profile.education_levels?.length ? (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{t("tutor.levels")}</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.education_levels.map((l) => <Badge key={l} variant="outline"><GraduationCap className="mr-1 h-3 w-3" /> {l}</Badge>)}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-3 p-6">
          <h2 className="font-semibold">{t("tutor.availability")}</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("tutor.noAvailability")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {[0,1,2,3,4,5,6].map((wd) => {
                const ds = slots.filter((s) => s.weekday === wd);
                if (ds.length === 0) return null;
                return (
                  <div key={wd} className="rounded-md border p-3">
                    <div className="text-sm font-medium">{t(`weekday.${WEEKDAY_KEYS[wd]}`)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ds.map((s) => `${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`).join(", ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-2 p-6">
          <h2 className="font-semibold">{t("tutor.reviews")}</h2>
          <p className="text-sm text-muted-foreground">{t("tutor.reviewsPlaceholder")}</p>
        </Card>

        {isApproved ? (
          <div className="flex justify-end">
            <Button size="lg" asChild>
              <Link to={`/book/${profile.user_id}`}>
                {t("tutor.bookSession")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
};

export default TutorPublicProfile;
