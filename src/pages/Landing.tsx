import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import {
  Brain,
  Users,
  LineChart,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

const Landing = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const pillars = [
    { Icon: Brain, key: "pillar1" },
    { Icon: Users, key: "pillar2" },
    { Icon: LineChart, key: "pillar3" },
  ];

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,hsl(165_70%_42%_/0.25),transparent_55%)]" />
        <div className="container mx-auto relative px-4 py-24 md:py-32 text-primary-foreground">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur-sm border border-white/20 mb-6 font-medium">
              <Sparkles className="h-3 w-3" /> {t("landing.heroEyebrow")}
            </div>
            <h1 className="text-balance text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-primary-foreground/85 max-w-2xl text-balance">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent-gradient text-accent-foreground hover:opacity-90 shadow-glow">
                <Link to="/auth?mode=signup">
                  {t("landing.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-white/5 border-white/30 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground backdrop-blur-sm"
              >
                <a href="#how">{t("landing.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="container mx-auto px-4 py-20 md:py-24">
        <div className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-wide text-accent font-semibold mb-2">
            {t("landing.pillarsTitle")}
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            {t("landing.pillarsHeadline")}
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map(({ Icon, key }) => (
            <Surface key={key} className="p-7 hover:shadow-elegant transition-smooth">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent/10 text-accent mb-5">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(`landing.${key}Title`)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`landing.${key}Desc`)}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* Promise band */}
      <section className="container mx-auto px-4 pb-20">
        <Surface variant="ai" className="p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-accent font-semibold mb-1">
              {t("landing.promiseTitle")}
            </p>
            <p className="text-lg md:text-xl font-medium text-balance">{t("landing.promiseBody")}</p>
          </div>
        </Surface>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto px-4 py-20 md:py-24">
        <div className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-wide text-accent font-semibold mb-2">
            {t("landing.howItWorks")}
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            {t("landing.howHeadline")}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Surface key={n} className="p-5">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary text-sm font-semibold mb-3">
                {n}
              </div>
              <p className="text-sm leading-relaxed">{t(`landing.step${n}`)}</p>
            </Surface>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="container mx-auto px-4 pb-24">
        <Surface className="p-8 md:p-12 text-center">
          <div className="grid h-12 w-12 mx-auto place-items-center rounded-xl bg-accent/10 text-accent mb-5">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3 text-balance">
            {t("landing.footerCtaTitle")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            {t("landing.footerCtaBody")}
          </p>
          <Button asChild size="lg" className="bg-accent-gradient text-accent-foreground shadow-glow">
            <Link to="/auth?mode=signup&next=/diagnose">
              {t("landing.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Surface>
      </section>
    </AppShell>
  );
};

export default Landing;
