import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Users, Wallet, ArrowRight, Sparkles, Video, MessageSquare } from "lucide-react";

const Landing = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const features = [
    { Icon: Brain, titleKey: "feature1Title", descKey: "feature1Desc" },
    { Icon: Users, titleKey: "feature2Title", descKey: "feature2Desc" },
    { Icon: Wallet, titleKey: "feature3Title", descKey: "feature3Desc" },
  ];

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(28_90%_55%_/0.25),transparent_60%)]" />
        <div className="container mx-auto relative px-4 py-24 md:py-32 text-primary-foreground">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur-sm border border-white/20 mb-6">
              <Sparkles className="h-3 w-3" /> {t("brand.tagline")}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-primary-foreground/85 max-w-2xl">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent-gradient text-accent-foreground hover:opacity-90 shadow-glow">
                <Link to="/auth?mode=signup">
                  {t("landing.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
                <a href="#how">{t("landing.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ Icon, titleKey, descKey }) => (
            <Card key={titleKey} className="p-7 bg-card-soft shadow-soft hover:shadow-elegant transition-smooth border">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10 text-accent mb-5">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t(`landing.${titleKey}`)}</h3>
              <p className="text-muted-foreground leading-relaxed">{t(`landing.${descKey}`)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="container mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-center mb-14">{t("landing.howItWorks")}</h2>
        <div className="mx-auto max-w-4xl space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-start gap-5 p-5 rounded-xl bg-secondary/50 border">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground font-bold">
                {n}
              </div>
              <p className="pt-2 text-lg">{t(`landing.step${n}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visual session preview */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-6 md:p-10 bg-hero text-primary-foreground border-0 shadow-elegant overflow-hidden">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-black/30 backdrop-blur-sm p-5 border border-white/10">
              <Video className="h-5 w-5 mb-3 text-accent" />
              <p className="text-sm opacity-80">Wideo + tablica + edytor zadań w jednym oknie.</p>
            </div>
            <div className="rounded-xl bg-black/30 backdrop-blur-sm p-5 border border-white/10">
              <MessageSquare className="h-5 w-5 mb-3 text-accent" />
              <p className="text-sm opacity-80">Transkrypt na żywo z diaryzacją mówców.</p>
            </div>
            <div className="rounded-xl bg-black/30 backdrop-blur-sm p-5 border border-white/10">
              <Sparkles className="h-5 w-5 mb-3 text-accent" />
              <p className="text-sm opacity-80">AI Co-pilot podpowiada w czasie rzeczywistym.</p>
            </div>
          </div>
        </Card>
      </section>
    </AppShell>
  );
};

export default Landing;
