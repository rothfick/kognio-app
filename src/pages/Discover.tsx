import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Star, ArrowRight } from "lucide-react";

type TutorRow = {
  user_id: string;
  headline: string | null;
  hourly_rate_cents: number;
  currency: string;
  rating: number | null;
  sessions_completed: number;
  profiles: { display_name: string | null; avatar_url: string | null; bio: string | null } | null;
};

const Discover = () => {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tutor_profiles")
        .select("user_id, headline, hourly_rate_cents, currency, rating, sessions_completed, profiles!inner(display_name, avatar_url, bio)")
        .eq("is_published", true)
        .limit(50);
      setTutors((data as unknown as TutorRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = tutors.filter((tt) => {
    if (!q.trim()) return true;
    const hay = `${tt.headline || ""} ${tt.profiles?.display_name || ""} ${tt.profiles?.bio || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("discover.title")}</h1>
          <p className="text-muted-foreground">{t("discover.subtitle")}</p>
        </div>

        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder={t("discover.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button asChild variant="outline"><Link to="/settings">{t("discover.becomeTutor")}</Link></Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center bg-card-soft">
            <p className="text-muted-foreground mb-4">{t("discover.noTutors")}</p>
            <Button asChild className="bg-accent-gradient text-accent-foreground"><Link to="/settings">{t("discover.becomeTutor")}</Link></Button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tt) => (
              <Card key={tt.user_id} className="p-5 hover:shadow-elegant transition-smooth bg-card-soft">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-accent/20 text-accent font-semibold">
                      {tt.profiles?.display_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{tt.profiles?.display_name || "Tutor"}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{tt.headline}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4 text-sm">
                  <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3 fill-current" /> {tt.rating?.toFixed(1) || "—"}</Badge>
                  <span className="font-bold text-lg">
                    {(tt.hourly_rate_cents / 100).toFixed(0)} {tt.currency}<span className="text-sm font-normal text-muted-foreground">{t("discover.perHour")}</span>
                  </span>
                </div>
                <Button asChild className="w-full" variant="outline">
                  <Link to={`/tutor/${tt.user_id}`}>{t("circles.open")} <ArrowRight className="ml-2 h-3 w-3" /></Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Discover;
