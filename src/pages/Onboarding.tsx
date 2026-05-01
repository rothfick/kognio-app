import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    return <div className="grid min-h-[50vh] place-items-center text-muted-foreground">{t("onboarding.loading")}</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const isOrg = selected === "school" || selected === "training_company";

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      if (selected === "tutor") {
        toast.error(t("onboarding.tutorBlocked"));
        setSubmitting(false);
        return;
      }

      // Ensure we have a fresh session before any RLS-protected writes.
      const { data: sessionData } = await supabase.auth.getSession();
      const activeUserId = sessionData.session?.user?.id;
      if (!activeUserId) {
        toast.error(t("onboarding.sessionExpired", { defaultValue: "Sesja wygasła. Zaloguj się ponownie." }));
        setSubmitting(false);
        navigate("/auth", { replace: true });
        return;
      }

      // Add the chosen role for parent/school/training_company (student auto-added by trigger).
      if (selected === "parent" || selected === "school" || selected === "training_company") {
        const { data: existing } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", activeUserId)
          .eq("role", selected)
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: activeUserId, role: selected });
          if (error) throw error;
        }
      }

      // Create the organization for school / training_company
      if (isOrg) {
        if (!orgName.trim()) {
          toast.error(t("onboarding.orgNameRequired"));
          setSubmitting(false);
          return;
        }
        const baseSlug = slugify(orgName);
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: org, error: oErr } = await supabase
          .from("organizations")
          .insert({
            owner_id: activeUserId,
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
        isOrg ? t("onboarding.orgCreated")
        : selected === "parent" ? t("onboarding.parentWelcome")
        : t("onboarding.studentWelcome")
      );
      navigate(dest, { replace: true });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("onboarding.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">{t("onboarding.welcome")}</h1>
          <p className="text-lg text-muted-foreground">
            {t("onboarding.subtitle")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <RoleCard
            active={selected === "student"}
            onClick={() => setSelected("student")}
            icon={<GraduationCap className="h-7 w-7" />}
            title={t("onboarding.roles.student")}
            description={t("onboarding.roleDescriptions.student")}
            bullets={[t("onboarding.roleDescriptions.studentB1"), t("onboarding.roleDescriptions.studentB2"), t("onboarding.roleDescriptions.studentB3")]}
          />
          <RoleCard
            active={selected === "parent"}
            onClick={() => setSelected("parent")}
            icon={<Users className="h-7 w-7" />}
            title={t("onboarding.roles.parent")}
            description={t("onboarding.roles.parentDesc")}
            bullets={[t("onboarding.roles.parentB1"), t("onboarding.roles.parentB2"), t("onboarding.roles.parentB3")]}
          />
          <RoleCard
            active={selected === "tutor"}
            onClick={() => setSelected("tutor")}
            icon={<Sparkles className="h-7 w-7" />}
            title={t("onboarding.roles.tutor")}
            description={t("onboarding.roleDescriptions.tutorDesc")}
            bullets={[t("onboarding.roles.tutorB1"), t("onboarding.roles.tutorB2"), t("onboarding.roles.tutorB3")]}
          />
          <RoleCard
            active={selected === "school"}
            onClick={() => setSelected("school")}
            icon={<School className="h-7 w-7" />}
            title={t("onboarding.roles.school")}
            description={t("onboarding.roles.schoolDesc")}
            bullets={[t("onboarding.roles.schoolB1"), t("onboarding.roles.schoolB2"), t("onboarding.roles.schoolB3")]}
          />
          <RoleCard
            active={selected === "training_company"}
            onClick={() => setSelected("training_company")}
            icon={<Building2 className="h-7 w-7" />}
            title={t("onboarding.roles.company")}
            description={t("onboarding.roles.companyDesc")}
            bullets={[t("onboarding.roles.companyB1"), t("onboarding.roles.companyB2"), t("onboarding.roles.companyB3")]}
          />
        </div>

        {isOrg && (
          <Card className="p-6 mb-8 bg-card-soft">
            <h2 className="text-xl font-semibold mb-1">
              {selected === "school" ? t("onboarding.org.schoolDataTitle") : t("onboarding.org.companyDataTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("onboarding.org.intro")}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="org-name">{t("onboarding.org.name")}</Label>
                <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={selected === "school" ? t("onboarding.org.nameHintSchool") : t("onboarding.org.nameHintCompany")} />
              </div>
              <div>
                <Label htmlFor="org-taxid">{t("onboarding.org.taxId")}</Label>
                <Input id="org-taxid" value={orgTaxId} onChange={(e) => setOrgTaxId(e.target.value)} placeholder={t("onboarding.org.optional")} />
              </div>
              <div>
                <Label htmlFor="org-city">{t("onboarding.org.city")}</Label>
                <Input id="org-city" value={orgCity} onChange={(e) => setOrgCity(e.target.value)} placeholder={t("onboarding.org.cityHint")} />
              </div>
              <div>
                <Label htmlFor="org-web">{t("onboarding.org.website")}</Label>
                <Input id="org-web" value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} placeholder="https://…" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="org-desc">{t("onboarding.org.description")}</Label>
                <Textarea id="org-desc" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} rows={3} placeholder={t("onboarding.org.descriptionHint")} />
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
            {t("onboarding.continue")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          {t("onboarding.tutorPendingNote")}
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
