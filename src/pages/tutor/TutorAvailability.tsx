import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

type Slot = {
  id: string;
  tutor_user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
};

const TutorAvailability = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ weekday: 1, start_time: "16:00", end_time: "20:00" });

  const weekdays = useMemo(
    () => [
      { v: 1, l: t("availability.mon") },
      { v: 2, l: t("availability.tue") },
      { v: 3, l: t("availability.wed") },
      { v: 4, l: t("availability.thu") },
      { v: 5, l: t("availability.fri") },
      { v: 6, l: t("availability.sat") },
      { v: 0, l: t("availability.sun") },
    ],
    [t],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutor_availability_slots")
        .select("id, tutor_user_id, weekday, start_time, end_time, timezone")
        .eq("tutor_user_id", user.id)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });
      if (!cancelled) {
        if (error) toast.error(t("availability.loadError"));
        setSlots((data || []) as Slot[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, t]);

  const addSlot = async () => {
    if (!user) return;
    if (form.start_time >= form.end_time) {
      toast.error(t("availability.invalidRange"));
      return;
    }
    setSaving(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw";
    const { data, error } = await supabase
      .from("tutor_availability_slots")
      .insert({
        tutor_user_id: user.id,
        weekday: form.weekday,
        start_time: form.start_time + ":00",
        end_time: form.end_time + ":00",
        timezone: tz,
        is_recurring: true,
      })
      .select("id, tutor_user_id, weekday, start_time, end_time, timezone")
      .single();
    setSaving(false);
    if (error) {
      toast.error(t("availability.saveError"));
      return;
    }
    setSlots((s) => [...s, data as Slot].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
    toast.success(t("availability.added"));
  };

  const removeSlot = async (id: string) => {
    const prev = slots;
    setSlots((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from("tutor_availability_slots").delete().eq("id", id);
    if (error) {
      toast.error(t("availability.deleteError"));
      setSlots(prev);
    }
  };

  const fmtTime = (hms: string) => hms.slice(0, 5);
  const labelOf = (w: number) => weekdays.find((x) => x.v === w)?.l || String(w);

  return (
    <AppShell>
      <div className="container mx-auto max-w-3xl py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t("availability.title")}</h1>
          <p className="text-muted-foreground">{t("availability.subtitle")}</p>
        </div>

        <Surface className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> {t("availability.addNew")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>{t("availability.weekday")}</Label>
              <Select value={String(form.weekday)} onValueChange={(v) => setForm((f) => ({ ...f, weekday: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {weekdays.map((w) => (
                    <SelectItem key={w.v} value={String(w.v)}>{w.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("availability.startTime")}</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("availability.endTime")}</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button onClick={addSlot} disabled={saving} className="w-full">{t("availability.add")}</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("availability.hint")}</p>
        </Surface>

        <Surface className="p-6">
          <div className="flex items-center gap-2 text-sm font-medium mb-4">
            <Clock className="h-4 w-4" /> {t("availability.yourSlots")}
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : slots.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("availability.empty")}</div>
          ) : (
            <ul className="divide-y divide-border">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-medium w-28">{labelOf(s.weekday)}</span>
                    <span className="text-muted-foreground">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                    <span className="text-xs text-muted-foreground">{s.timezone}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSlot(s.id)} aria-label={t("availability.delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </AppShell>
  );
};

export default TutorAvailability;
