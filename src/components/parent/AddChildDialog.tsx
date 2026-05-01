import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CONSENT_COPY =
  "Potwierdzam, że jestem rodzicem lub opiekunem prawnym dziecka i wyrażam zgodę na utworzenie profilu ucznia oraz przetwarzanie danych w celu prowadzenia nauki, diagnozy edukacyjnej i generowania raportów postępów.";

export function AddChildDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [primarySubject, setPrimarySubject] = useState("");
  const [relation, setRelation] = useState<"parent" | "guardian" | "other">("parent");
  const [consent, setConsent] = useState(false);

  const reset = () => {
    setDisplayName(""); setEmail(""); setDob(""); setGradeLevel("");
    setPrimarySubject(""); setRelation("parent"); setConsent(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) { toast.error("Podaj imię dziecka."); return; }
    if (!consent) { toast.error("Zgoda rodzica/opiekuna jest wymagana."); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("parent_children").insert({
        parent_id: user.id,
        display_name: displayName.trim(),
        email: email.trim() || null,
        dob: dob || null,
        grade_level: gradeLevel || null,
        primary_subject: primarySubject || null,
        relation,
        status: "active",
        consent_signed_at: new Date().toISOString(),
        consent_version: "v1",
      });
      if (error) throw error;
      toast.success("Profil dziecka został dodany.");
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Nie udało się dodać profilu dziecka.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent-gradient text-accent-foreground">
          <Plus className="h-4 w-4 mr-2" /> Dodaj dziecko
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dodaj profil dziecka</DialogTitle>
          <DialogDescription>
            Utworzysz profil ucznia powiązany z Twoim kontem rodzica.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Imię dziecka *</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dob">Data urodzenia</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grade">Klasa</Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger id="grade"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {["SP4","SP5","SP6","SP7","SP8","LO1","LO2","LO3","LO4"].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Główny przedmiot</Label>
            <Select value={primarySubject} onValueChange={setPrimarySubject}>
              <SelectTrigger id="subject"><SelectValue placeholder="Wybierz przedmiot" /></SelectTrigger>
              <SelectContent>
                {["Matematyka","Fizyka","Chemia","Biologia","Język polski","Język angielski","Informatyka"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail dziecka (opcjonalny)</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="np. anna@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="relation">Relacja</Label>
            <Select value={relation} onValueChange={(v) => setRelation(v as any)}>
              <SelectTrigger id="relation"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Rodzic</SelectItem>
                <SelectItem value="guardian">Opiekun prawny</SelectItem>
                <SelectItem value="other">Inny</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-2 rounded-md border p-3 bg-muted/30 text-xs leading-relaxed cursor-pointer">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
            <span>{CONSENT_COPY}</span>
          </label>
          <p className="text-[10px] text-muted-foreground">
            Wersja zgody: v1. Dokumenty prawne wymagają weryfikacji przed publicznym uruchomieniem.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button type="submit" disabled={submitting} className="bg-accent-gradient text-accent-foreground">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dodaj dziecko
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
