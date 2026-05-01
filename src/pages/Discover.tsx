import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, ArrowRight, SlidersHorizontal, Sparkles } from "lucide-react";

type TutorRow = {
  user_id: string;
  headline: string | null;
  hourly_rate_cents: number;
  currency: string;
  rating: number | null;
  sessions_completed: number;
  profiles: { display_name: string | null; avatar_url: string | null; bio: string | null } | null;
  tutor_subjects: { subject_id: string }[] | null;
};

type Subject = { id: string; name_pl: string; name_en: string; slug: string };
type SortKey = "rating" | "price_asc" | "price_desc" | "experience";

const Discover = () => {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("rating");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: tt }, { data: sb }] = await Promise.all([
        supabase
          .from("tutor_profiles")
          .select("user_id, headline, hourly_rate_cents, currency, rating, sessions_completed, tutor_subjects(subject_id)")
          .eq("is_published", true)
          .limit(100),
        supabase.from("subjects").select("id, name_pl, name_en, slug").order("name_pl"),
      ]);
      const rows = (tt as Omit<TutorRow, "profiles">[]) || [];
      const ids = rows.map((r) => r.user_id);
      let profilesById: Record<string, TutorRow["profiles"]> = {};
      if (ids.length) {
        const { data: pp } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url, bio")
          .in("id", ids);
        profilesById = Object.fromEntries((pp || []).map((p: { id: string; display_name: string | null; avatar_url: string | null; bio: string | null }) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url, bio: p.bio }]));
      }
      setTutors(rows.map((r) => ({ ...r, profiles: profilesById[r.user_id] || null })));
      setSubjects((sb as Subject[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const max = parseFloat(maxPrice);
    let out = tutors.filter((tt) => {
      if (q.trim()) {
        const hay = `${tt.headline || ""} ${tt.profiles?.display_name || ""} ${tt.profiles?.bio || ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (subjectId !== "all") {
        if (!tt.tutor_subjects?.some((s) => s.subject_id === subjectId)) return false;
      }
      if (!isNaN(max) && tt.hourly_rate_cents / 100 > max) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "price_asc": return a.hourly_rate_cents - b.hourly_rate_cents;
        case "price_desc": return b.hourly_rate_cents - a.hourly_rate_cents;
        case "experience": return b.sessions_completed - a.sessions_completed;
        case "rating":
        default: return (b.rating || 0) - (a.rating || 0);
      }
    });
    return out;
  }, [tutors, q, subjectId, sort, maxPrice]);

  const subjectName = (s: Subject) => (i18n.language?.startsWith("en") ? s.name_en : s.name_pl);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("discover.title")}</h1>
          <p className="text-muted-foreground">{t("discover.subtitle")}</p>
        </div>

        <Card className="p-4 mb-6 bg-card-soft">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" placeholder={t("discover.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Przedmiot" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie przedmioty</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{subjectName(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[180px]"><SlidersHorizontal className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Najlepsza ocena</SelectItem>
                <SelectItem value="price_asc">Cena rosnąco</SelectItem>
                <SelectItem value="price_desc">Cena malejąco</SelectItem>
                <SelectItem value="experience">Najwięcej sesji</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Max zł/h" className="w-[120px]" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            <Button asChild variant="outline" className="ml-auto"><Link to="/settings">{t("discover.becomeTutor")}</Link></Button>
          </div>
        </Card>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <Card key={i} className="p-5 h-[200px] animate-pulse bg-card-soft" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center bg-card-soft">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-accent" />
            <h3 className="font-semibold mb-2">
              {tutors.length === 0 ? "Bądź pierwszym tutorem na platformie" : "Nic nie pasuje do filtrów"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {tutors.length === 0
                ? "Nie ma jeszcze opublikowanych profili. Załóż swój i zarabiaj."
                : "Spróbuj innego przedmiotu lub większego limitu ceny."}
            </p>
            {tutors.length === 0
              ? <Button asChild className="bg-accent-gradient text-accent-foreground"><Link to="/settings">{t("discover.becomeTutor")}</Link></Button>
              : <Button variant="outline" onClick={() => { setQ(""); setSubjectId("all"); setMaxPrice(""); }}>Wyczyść filtry</Button>}
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">{filtered.length} {filtered.length === 1 ? "tutor" : "tutorów"}</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tt) => (
                <Card key={tt.user_id} className="p-5 hover:shadow-elegant transition-smooth bg-card-soft flex flex-col">
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
                  <div className="flex items-center justify-between mb-4 text-sm mt-auto">
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3 fill-current" /> {tt.rating ? tt.rating.toFixed(1) : "nowy"}
                    </Badge>
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
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Discover;
