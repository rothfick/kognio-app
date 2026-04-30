import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type PaymentMethod = { id: string; method_type: string; label: string; details: string; is_default: boolean };
type TutorProfile = { user_id: string; headline: string | null; description: string | null; hourly_rate_cents: number; currency: string; is_published: boolean };

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [isTutor, setIsTutor] = useState(false);

  // form
  const [type, setType] = useState("blik");
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: m }, { data: tp }, { data: roles }] = await Promise.all([
      supabase.from("tutor_payment_methods").select("*").eq("tutor_id", user.id),
      supabase.from("tutor_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    setMethods((m as PaymentMethod[]) || []);
    setTutor(tp as TutorProfile | null);
    setIsTutor(!!roles?.some((r) => r.role === "tutor"));
  };
  useEffect(() => { load(); }, [user]);

  const becomeTutor = async () => {
    if (!user) return;
    // 1) Dodaj rolę tutor (ignoruj konflikt jeśli już istnieje)
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "tutor")
      .maybeSingle();
    if (!existingRole) {
      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "tutor" });
      if (rErr) {
        console.error("user_roles insert", rErr);
        toast.error(`Nie udało się nadać roli: ${rErr.message}`);
        return;
      }
    }
    // 2) Załóż profil tutora (upsert po user_id)
    const { error: tErr } = await supabase
      .from("tutor_profiles")
      .upsert(
        { user_id: user.id, hourly_rate_cents: 10000, currency: "PLN", is_published: false },
        { onConflict: "user_id" }
      );
    if (tErr) {
      console.error("tutor_profiles upsert", tErr);
      toast.error(`Nie udało się utworzyć profilu tutora: ${tErr.message}`);
      return;
    }
    toast.success("Jesteś tutorem! Uzupełnij profil.");
    setIsTutor(true);
    await load();
  };


  const saveTutor = async () => {
    if (!user || !tutor) return;
    const { error } = await supabase.from("tutor_profiles").update({
      headline: tutor.headline, description: tutor.description,
      hourly_rate_cents: tutor.hourly_rate_cents, currency: tutor.currency, is_published: tutor.is_published,
    }).eq("user_id", user.id);
    if (error) toast.error(error.message); else toast.success("Zapisano");
  };

  const addMethod = async () => {
    if (!user || !label.trim() || !details.trim()) return;
    const { error } = await supabase.from("tutor_payment_methods").insert({
      tutor_id: user.id, method_type: type as "blik" | "iban" | "revolut" | "paypal" | "other", label: label.trim(), details: details.trim(),
      is_default: methods.length === 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Dodano metodę"); setLabel(""); setDetails(""); load();
  };

  const removeMethod = async (id: string) => {
    await supabase.from("tutor_payment_methods").delete().eq("id", id);
    load();
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <h1 className="text-4xl font-bold">{t("settings.title")}</h1>

        {/* Language */}
        <Card className="p-6 bg-card-soft">
          <Label className="text-base mb-3 block">{t("settings.language")}</Label>
          <Select value={i18n.language?.startsWith("en") ? "en" : "pl"} onValueChange={(v) => i18n.changeLanguage(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pl">{t("settings.languagePl")}</SelectItem>
              <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Tutor profile */}
        {!isTutor ? (
          <Card className="p-6 bg-card-soft text-center">
            <p className="mb-4 text-muted-foreground">Chcesz pomagać innym i zarabiać?</p>
            <Button onClick={becomeTutor} className="bg-accent-gradient text-accent-foreground">{t("settings.becomeTutor")}</Button>
          </Card>
        ) : tutor && (
          <Card className="p-6 bg-card-soft space-y-4">
            <h2 className="text-xl font-semibold">Profil tutora</h2>
            <div>
              <Label>Nagłówek</Label>
              <Input value={tutor.headline || ""} onChange={(e) => setTutor({ ...tutor, headline: e.target.value })} placeholder="np. Matematyka maturalna z 7-letnim stażem" maxLength={120} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={tutor.description || ""} onChange={(e) => setTutor({ ...tutor, description: e.target.value })} rows={4} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stawka / h (w groszach)</Label>
                <Input type="number" value={tutor.hourly_rate_cents} onChange={(e) => setTutor({ ...tutor, hourly_rate_cents: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Waluta</Label>
                <Input value={tutor.currency} onChange={(e) => setTutor({ ...tutor, currency: e.target.value.toUpperCase().slice(0, 3) })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Opublikowany w wyszukiwarce</Label>
              <Switch checked={tutor.is_published} onCheckedChange={(v) => setTutor({ ...tutor, is_published: v })} />
            </div>
            <Button onClick={saveTutor} className="bg-accent-gradient text-accent-foreground">{t("common.save")}</Button>
          </Card>
        )}

        {/* Payment methods */}
        {isTutor && (
          <Card className="p-6 bg-card-soft space-y-4">
            <h2 className="text-xl font-semibold">{t("settings.paymentMethods")}</h2>
            <p className="text-sm text-muted-foreground">Te dane uczniowie zobaczą po rezerwacji sesji, by Ci zapłacić bezpośrednio.</p>

            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                <span className="uppercase text-xs font-bold text-accent w-16">{m.method_type}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.details}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeMethod(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blik">BLIK</SelectItem>
                  <SelectItem value="iban">IBAN</SelectItem>
                  <SelectItem value="revolut">Revolut</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="other">Inne</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Etykieta (np. mBank)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="Numer / dane" value={details} onChange={(e) => setDetails(e.target.value)} />
              <Button onClick={addMethod}><Plus className="h-4 w-4 mr-1" />{t("settings.addMethod")}</Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default Settings;
