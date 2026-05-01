import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

const TutorProfile = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tutor, setTutor] = useState<{
    user_id: string; headline: string | null; description: string | null; hourly_rate_cents: number; currency: string;
    rating: number | null; sessions_completed: number;
    profiles: { display_name: string | null; bio: string | null } | null;
  } | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tutor_profiles")
        .select("user_id, headline, description, hourly_rate_cents, currency, rating, sessions_completed, profiles!inner(display_name, bio)")
        .eq("user_id", id as string)
        .maybeSingle();
      setTutor(data as any);
      setLoading(false);
    })();
  }, [id]);

  const book = async () => {
    if (!user || !tutor || !date) { toast.error("Wybierz datę"); return; }
    const starts = new Date(`${date}T${time}:00`);
    const ends = new Date(starts.getTime() + 60 * 60 * 1000);
    const { data, error } = await supabase.from("bookings").insert({
      student_id: user.id, tutor_id: tutor.user_id,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price_cents: tutor.hourly_rate_cents, currency: tutor.currency, status: "pending",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      const room = `room-${data.id.slice(0, 8)}`;
      await supabase.from("sessions").insert({ booking_id: data.id, room_name: room });
    }
    toast.success("Rezerwacja utworzona");
    navigate("/calendar");
  };

  if (loading) return <AppShell><div className="container py-10">{t("common.loading")}</div></AppShell>;
  if (!tutor) return <AppShell><div className="container py-10">Tutor nie znaleziony.</div></AppShell>;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Card className="p-8 bg-card-soft mb-6 shadow-soft">
          <div className="flex items-start gap-5 mb-6">
            <Avatar className="h-20 w-20"><AvatarFallback className="bg-accent/20 text-accent text-2xl font-bold">{tutor.profiles?.display_name?.[0]?.toUpperCase() || "?"}</AvatarFallback></Avatar>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{tutor.profiles?.display_name}</h1>
              <p className="text-lg text-muted-foreground">{tutor.headline}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-accent text-accent" /> {tutor.rating?.toFixed(1) || "—"}</span>
                <span className="text-muted-foreground">{tutor.sessions_completed} sesji</span>
                <span className="font-bold text-lg">{(tutor.hourly_rate_cents / 100).toFixed(0)} {tutor.currency}/h</span>
              </div>
            </div>
          </div>
          <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{tutor.description || tutor.profiles?.bio || "—"}</p>
        </Card>

        <Card className="p-6 bg-card-soft">
          <h2 className="text-xl font-semibold mb-4">Zarezerwuj sesję (1h)</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></div>
            <div><Label>Godzina</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <Button onClick={book} className="w-full bg-accent-gradient text-accent-foreground" disabled={!user}>
            {user ? "Zarezerwuj" : "Zaloguj się aby zarezerwować"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
};

export default TutorProfile;
