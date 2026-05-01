import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Star, ArrowRight, ShieldCheck, GraduationCap, Globe, Sparkles } from "lucide-react";

type TutorRow = {
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
};

type DomainOpt = { id: string; code: string; name_pl: string; name_en: string; name_es: string | null };
type LevelOpt = { id: string; code: string; name_pl: string; name_en: string; name_es: string | null };

const localizedName = (
  lang: string,
  row: { name_pl: string; name_en: string; name_es: string | null } | undefined,
) => {
  if (!row) return "";
  if (lang.startsWith("en")) return row.name_en || row.name_pl;
  if (lang.startsWith("es")) return row.name_es || row.name_en || row.name_pl;
  return row.name_pl;
};

const DEFAULTS = { q: "", domain: "all", level: "all", language: "all", maxPrice: "", minRating: "any" };

const Marketplace = () => {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState(DEFAULTS.q);
  const [domain, setDomain] = useState<string>(DEFAULTS.domain);
  const [level, setLevel] = useState<string>(DEFAULTS.level);
  const [language, setLanguage] = useState<string>(DEFAULTS.language);
  const [maxPrice, setMaxPrice] = useState<string>(DEFAULTS.maxPrice);
  const [minRating, setMinRating] = useState<string>(DEFAULTS.minRating);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [domains, setDomains] = useState<DomainOpt[]>([]);
  const [levels, setLevels] = useState<LevelOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const resetFilters = () => {
    setQ(DEFAULTS.q); setDomain(DEFAULTS.domain); setLevel(DEFAULTS.level);
    setLanguage(DEFAULTS.language); setMaxPrice(DEFAULTS.maxPrice); setMinRating(DEFAULTS.minRating);
  };
  const filtersDirty = q !== DEFAULTS.q || domain !== DEFAULTS.domain || level !== DEFAULTS.level
    || language !== DEFAULTS.language || maxPrice !== DEFAULTS.maxPrice || minRating !== DEFAULTS.minRating;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: tt }, { data: dd }, { data: ll }] = await Promise.all([
        supabase
          .from("tutor_profiles")
          .select("user_id, display_name, headline, bio, hourly_rate, hourly_rate_cents, currency, rating, reviews_count, languages, teaching_domains, education_levels, profile_photo_url, is_verified, verification_status")
          .eq("is_verified", true)
          .eq("verification_status", "approved")
          .limit(200),
        supabase.from("learning_domains").select("id, code, name_pl, name_en, name_es").eq("is_active", true).order("name_pl"),
        supabase.from("education_levels").select("id, code, name_pl, name_en, name_es").eq("is_active", true).order("order_index"),
      ]);
      setTutors((tt || []) as TutorRow[]);
      setDomains((dd || []) as DomainOpt[]);
      setLevels((ll || []) as LevelOpt[]);
      setLoading(false);
    })();
  }, []);

  const allLanguages = useMemo(() => {
    const set = new Set<string>();
    tutors.forEach((t) => t.languages?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [tutors]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const max = maxPrice ? parseFloat(maxPrice) : Number.POSITIVE_INFINITY;
    const minRate = minRating === "any" ? 0 : parseFloat(minRating);
    return tutors.filter((row) => {
      if (needle) {
        const hay = [row.display_name, row.headline, row.bio, ...(row.teaching_domains || [])].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (domain !== "all" && !(row.teaching_domains || []).includes(domain)) return false;
      if (level !== "all" && !(row.education_levels || []).includes(level)) return false;
      if (language !== "all" && !(row.languages || []).includes(language)) return false;
      const rate = row.hourly_rate ?? row.hourly_rate_cents / 100;
      if (rate > max) return false;
      if ((row.rating ?? 0) < minRate) return false;
      return true;
    });
  }, [tutors, q, domain, level, language, maxPrice, minRating]);

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>{t("marketplace.eyebrow")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("marketplace.title")}</h1>
          <p className="text-muted-foreground">{t("marketplace.subtitle")}</p>
        </header>

        <Card className="p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("marketplace.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <div className="md:col-span-2">
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger><SelectValue placeholder={t("marketplace.filter.domain")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("marketplace.filter.allDomains")}</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.code}>{localizedName(i18n.language, d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder={t("marketplace.filter.level")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("marketplace.filter.allLevels")}</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.code}>{localizedName(i18n.language, l)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue placeholder={t("marketplace.filter.language")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("marketplace.filter.allLanguages")}</SelectItem>
                  {allLanguages.map((l) => (
                    <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={t("marketplace.filter.maxPrice")}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger><SelectValue placeholder={t("marketplace.filter.rating")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("marketplace.filter.any")}</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="rounded-full bg-accent/10 p-4">
              <GraduationCap className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold">{t("marketplace.empty.title")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">{t("marketplace.empty.body")}</p>
            <Button asChild>
              <Link to="/tutor/onboarding">{t("marketplace.empty.cta")}</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => {
              const rate = row.hourly_rate ?? row.hourly_rate_cents / 100;
              const initials = (row.display_name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Card key={row.user_id} className="flex flex-col gap-3 p-5 shadow-soft transition hover:shadow-elegant">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {row.profile_photo_url ? <AvatarImage src={row.profile_photo_url} /> : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{row.display_name || t("marketplace.unnamed")}</h3>
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {t("marketplace.verified")}
                        </Badge>
                      </div>
                      {row.headline ? <p className="truncate text-sm text-muted-foreground">{row.headline}</p> : null}
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                        {(row.rating ?? 0).toFixed(1)} · {row.reviews_count} {t("marketplace.reviews")}
                      </div>
                    </div>
                  </div>

                  {row.languages?.length ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      {row.languages.map((l) => (
                        <Badge key={l} variant="outline" className="px-1.5 py-0 text-[10px]">{l.toUpperCase()}</Badge>
                      ))}
                    </div>
                  ) : null}

                  {row.teaching_domains?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.teaching_domains.slice(0, 4).map((d) => (
                        <Badge key={d} variant="secondary" className="px-2 py-0.5 text-[11px]">{d}</Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    <div>
                      <div className="text-lg font-semibold">{rate.toFixed(0)} {row.currency}</div>
                      <div className="text-xs text-muted-foreground">{t("marketplace.perHour")}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/tutors/${row.user_id}`}>{t("marketplace.openProfile")}</Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link to={`/book/${row.user_id}`}>
                          {t("marketplace.book")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Marketplace;
