import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, User as UserIcon, GraduationCap, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";

const TZ_OPTIONS = [
  "Europe/Warsaw", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC",
];

const Profile = () => {
  const { user } = useAuth();
  const { isTutor } = useUserRoles();
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [becoming, setBecoming] = useState(false);

  const becomeTutor = async () => {
    if (!user) return;
    setBecoming(true);
    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "tutor" });
    if (roleErr && !roleErr.message.includes("duplicate")) { toast.error(roleErr.message); setBecoming(false); return; }
    const { data: existing } = await supabase.from("tutor_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!existing) {
      await supabase.from("tutor_profiles").insert({ user_id: user.id, hourly_rate_cents: 0, is_published: false });
    }
    toast.success("Witaj w gronie tutorów! Uzupełnij profil, by zostać opublikowanym.");
    setBecoming(false);
    window.location.href = "/settings";
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setDisplayName(data.display_name || "");
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setTimezone(data.timezone || "Europe/Warsaw");
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      timezone,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profil zapisany");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 4 * 1024 * 1024) { toast.error("Maks 4 MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast.success("Avatar zaktualizowany");
  };

  if (loading) return <AppShell><div className="container py-10">Ładowanie…</div></AppShell>;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-hero text-primary-foreground"><UserIcon className="h-5 w-5" /></div>
          <h1 className="text-3xl font-bold">Twój profil</h1>
        </div>

        <Card className="p-6 bg-card-soft mb-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-24 w-24">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="avatar" />}
              <AvatarFallback className="bg-accent/20 text-accent text-3xl font-bold">
                {(displayName || user?.email || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium mb-1">{displayName || "Bez nazwy"}</p>
              <p className="text-sm text-muted-foreground mb-3">{user?.email}</p>
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
                <span>
                  <Button asChild variant="outline" size="sm" disabled={uploading}>
                    <span className="cursor-pointer">
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Zmień avatar
                    </span>
                  </Button>
                </span>
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card-soft space-y-4">
          <div>
            <Label>Nazwa wyświetlana</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="np. Anna K." />
          </div>
          <div>
            <Label>Imię i nazwisko (prywatne)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Anna Kowalska" />
          </div>
          <div>
            <Label>O mnie</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Krótko o sobie…" rows={4} />
          </div>
          <div>
            <Label>Strefa czasowa</Label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TZ_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-accent-gradient text-accent-foreground">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Zapisz profil
          </Button>
        </Card>
      </div>
    </AppShell>
  );
};

export default Profile;
