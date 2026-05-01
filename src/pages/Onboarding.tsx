import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, Sparkles, Users, Loader2, Check, Building2, School } from "lucide-react";
import { toast } from "sonner";

type Role = "student" | "tutor" | "parent" | "school" | "training_company";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48) || "org";

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Org form
  const [orgName, setOrgName] = useState("");
  const [orgTaxId, setOrgTaxId] = useState("");
  const [orgCity, setOrgCity] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgDescription, setOrgDescription] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.onboarded_at) {
        navigate("/dashboard", { replace: true });
      } else {
        setChecking(false);
      }
    })();
  }, [user, navigate]);

  if (loading || checking) {
    return <div className="grid min-h-[50vh] place-items-center text-muted-foreground">Ładowanie…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const isOrg = selected === "school" || selected === "training_company";

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      if (selected === "tutor") {
        toast.error("Konto korepetytora wymaga weryfikacji. Skontaktuj się z zespołem Kogni.");
        setSubmitting(false);
        return;
      }

      // Add the chosen role for parent/school/training_company (student auto-added by trigger).
      if (selected === "parent" || selected === "school" || selected === "training_company") {
        const { data: existing } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", selected)
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: user.id, role: selected });
          if (error) throw error;
        }
      }

      // Create the organization for school / training_company
      if (isOrg) {
        if (!orgName.trim()) {
          toast.error("Podaj nazwę placówki.");
          setSubmitting(false);
          return;
        }
        const baseSlug = slugify(orgName);
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: org, error: oErr } = await supabase
          .from("organizations")
          .insert({
            owner_id: user.id,
            name: orgName.trim(),
            org_type: selected,
            slug,
            tax_id: orgTaxId.trim() || null,
            city: orgCity.trim() || null,
            website: orgWebsite.trim() || null,
            description: orgDescription.trim() || null,
          })
          .select("id")
          .single();
        if (oErr) throw oErr;
        // Add owner as member with role 'owner'
        await supabase.from("organization_members").insert({
          organization_id: org.id,
          user_id: user.id,
          member_role: "owner",
        });
      }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", user.id);
      if (pErr) throw pErr;

      const dest =
        selected === "parent" ? "/dashboard/parent"
        : selected === "school" ? "/dashboard/school"
        : selected === "training_company" ? "/dashboard/company"
        : "/dashboard/student";

      toast.success(
        isOrg ? "Placówka utworzona. Możesz zapraszać uczniów i nauczycieli."
        : selected === "parent" ? "Witaj! Dodaj profil dziecka, aby rozpocząć."
        : "Świetnie, zaczynamy naukę!"
      );
      navigate(dest, { replace: true });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Coś poszło nie tak");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Witaj w Kogni 👋</h1>
          <p className="text-lg text-muted-foreground">
            Powiedz nam, jak chcesz korzystać z platformy. Zawsze możesz zmienić to później w ustawieniach.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <RoleCard
            active={selected === "student"}
            onClick={() => setSelected("student")}
            icon={<GraduationCap className="h-7 w-7" />}
            title="Uczeń"
            description="Uczę się, dołączam do kół, korzystam z AI."
            bullets={["Diagnoza wiedzy", "Tutorzy", "Drugi mózg"]}
          />
          <RoleCard
            active={selected === "parent"}
            onClick={() => setSelected("parent")}
            icon={<Users className="h-7 w-7" />}
            title="Rodzic"
            description="Profil dziecka, raporty postępów."
            bullets={["Profil dziecka", "Raporty", "Kontrola"]}
          />
          <RoleCard
            active={selected === "tutor"}
            onClick={() => setSelected("tutor")}
            icon={<Sparkles className="h-7 w-7" />}
            title="Tutor"
            description="Lekcje 1:1 z AI Co-pilotem. (weryfikacja)"
            bullets={["Profil", "AI Co-pilot", "Płatności"]}
          />
          <RoleCard
            active={selected === "school"}
            onClick={() => setSelected("school")}
            icon={<School className="h-7 w-7" />}
            title="Szkoła"
            description="Zarządzaj uczniami, nauczycielami, grupami."
            bullets={["Wielu użytkowników", "Zaproszenia", "Raporty placówki"]}
          />
          <RoleCard
            active={selected === "training_company"}
            onClick={() => setSelected("training_company")}
            icon={<Building2 className="h-7 w-7" />}
            title="Firma szkoleniowa"
            description="Kursy dla pracowników i klientów B2B."
            bullets={["Zespoły", "Zaproszenia", "Raporty firmowe"]}
          />
        </div>

        {isOrg && (
          <Card className="p-6 mb-8 bg-card-soft">
            <h2 className="text-xl font-semibold mb-1">
              {selected === "school" ? "Dane szkoły" : "Dane firmy szkoleniowej"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Te informacje pomogą uczniom i pracownikom rozpoznać Twoją placówkę. Możesz zmienić je później.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="org-name">Nazwa *</Label>
                <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={selected === "school" ? "np. SP nr 5 w Warszawie" : "np. Akademia Kodowania Sp. z o.o."} />
              </div>
              <div>
                <Label htmlFor="org-taxid">NIP / numer REGON</Label>
                <Input id="org-taxid" value={orgTaxId} onChange={(e) => setOrgTaxId(e.target.value)} placeholder="opcjonalnie" />
              </div>
              <div>
                <Label htmlFor="org-city">Miasto</Label>
                <Input id="org-city" value={orgCity} onChange={(e) => setOrgCity(e.target.value)} placeholder="np. Warszawa" />
              </div>
              <div>
                <Label htmlFor="org-web">Strona WWW</Label>
                <Input id="org-web" value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} placeholder="https://…" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="org-desc">Krótki opis</Label>
                <Textarea id="org-desc" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} rows={3} placeholder="Dla kogo, czego uczycie, kontakt…" />
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selected || submitting || (isOrg && !orgName.trim())}
            onClick={confirm}
            className="bg-accent-gradient text-accent-foreground min-w-[220px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Kontynuuj
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Konto korepetytora wymaga weryfikacji przez zespół Kogni.
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
    className={`p-5 cursor-pointer transition-all ${
      active
        ? "ring-2 ring-accent shadow-elegant bg-card"
        : "bg-card-soft hover:shadow-soft hover:-translate-y-0.5"
    }`}
  >
    <div className={`h-12 w-12 rounded-lg grid place-items-center mb-3 ${active ? "bg-accent text-accent-foreground" : "bg-hero text-primary-foreground"}`}>
      {icon}
    </div>
    <h2 className="text-lg font-semibold mb-1">{title}</h2>
    <p className="text-xs text-muted-foreground mb-3">{description}</p>
    <ul className="space-y-1">
      {bullets.map((b) => (
        <li key={b} className="text-xs flex items-start gap-2">
          <Check className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </Card>
);

export default Onboarding;
