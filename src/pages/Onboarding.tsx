import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

type Role = "student" | "tutor";

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Jeśli użytkownik już przeszedł onboarding, przerzuć dalej
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.onboarded_at) {
        navigate("/discover", { replace: true });
      } else {
        setChecking(false);
      }
    })();
  }, [user, navigate]);

  if (loading || checking) {
    return <div className="grid min-h-[50vh] place-items-center text-muted-foreground">Ładowanie…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      // 1) Upewnij się, że jest właściwa rola
      // (trigger handle_new_user dodaje 'student' z definicji — dla tutora dorzucamy drugą rolę)
      if (selected === "tutor") {
        const { data: existing } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "tutor")
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: user.id, role: "tutor" });
          if (error) throw error;
        }
        // 2) Załóż profil tutora (upsert po user_id)
        const { error: tErr } = await supabase
          .from("tutor_profiles")
          .upsert(
            { user_id: user.id, hourly_rate_cents: 10000, currency: "PLN", is_published: false },
            { onConflict: "user_id" }
          );
        if (tErr) throw tErr;
      }

      // 3) Oznacz onboarding jako ukończony
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", user.id);
      if (pErr) throw pErr;

      toast.success(selected === "tutor" ? "Witaj wśród tutorów!" : "Świetnie, zaczynamy naukę!");
      navigate(selected === "tutor" ? "/settings" : "/discover", { replace: true });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Coś poszło nie tak");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Witaj w TutorOS AI 👋</h1>
          <p className="text-lg text-muted-foreground">
            Powiedz nam, jak chcesz korzystać z platformy. Zawsze możesz zmienić to później w ustawieniach.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <RoleCard
            active={selected === "student"}
            onClick={() => setSelected("student")}
            icon={<GraduationCap className="h-8 w-8" />}
            title="Jestem uczniem"
            description="Szukam tutorów, dołączam do kół naukowych i uczę się we własnym tempie."
            bullets={["Wyszukiwarka tutorów", "Koła naukowe i pomoc rówieśników", "Drugi mózg z notatek"]}
          />
          <RoleCard
            active={selected === "tutor"}
            onClick={() => setSelected("tutor")}
            icon={<Sparkles className="h-8 w-8" />}
            title="Jestem tutorem"
            description="Prowadzę lekcje, zarabiam na korepetycjach, korzystam z AI Co-pilota."
            bullets={["Profil w wyszukiwarce", "Twoje metody płatności (BLIK, IBAN…)", "AI Co-pilot na sesjach"]}
          />
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selected || submitting}
            onClick={confirm}
            className="bg-accent-gradient text-accent-foreground min-w-[200px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Kontynuuj
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Tutorzy mogą też uczyć się jako uczniowie — wystarczy włączyć drugą rolę w ustawieniach.
        </p>
      </div>
    </AppShell>
  );
};

const RoleCard = ({
  active, onClick, icon, title, description, bullets,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  title: string; description: string; bullets: string[];
}) => (
  <Card
    onClick={onClick}
    className={`p-6 cursor-pointer transition-all ${
      active
        ? "ring-2 ring-accent shadow-elegant bg-card"
        : "bg-card-soft hover:shadow-soft hover:-translate-y-0.5"
    }`}
  >
    <div className={`h-14 w-14 rounded-lg grid place-items-center mb-4 ${active ? "bg-accent text-accent-foreground" : "bg-hero text-primary-foreground"}`}>
      {icon}
    </div>
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    <ul className="space-y-1.5">
      {bullets.map((b) => (
        <li key={b} className="text-sm flex items-start gap-2">
          <Check className="h-4 w-4 mt-0.5 text-accent shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </Card>
);

export default Onboarding;
