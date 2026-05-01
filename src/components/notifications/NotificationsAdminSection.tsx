import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, BellOff, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

export function NotificationsAdminSection() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ total: number; unread: number; dismissed: number; byType: Record<string, number> } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ count: total }, { count: unread }, { count: dismissed }, { data: typed }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "unread"),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
        supabase.from("notifications").select("type").limit(1000),
      ]);
      const byType: Record<string, number> = {};
      (typed || []).forEach((r: { type: string }) => { byType[r.type] = (byType[r.type] || 0) + 1; });
      setStats({ total: total || 0, unread: unread || 0, dismissed: dismissed || 0, byType });
    })();
  }, []);

  return (
    <Surface className="p-5 mb-6">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-accent" /> {t("notifications.adminSection")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard icon={Layers} label={t("notifications.metrics.total")} value={stats === null ? "…" : String(stats.total)} />
        <StatCard icon={BellRing} label={t("notifications.metrics.unread")} value={stats === null ? "…" : String(stats.unread)} />
        <StatCard icon={BellOff} label={t("notifications.metrics.dismissed")} value={stats === null ? "…" : String(stats.dismissed)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">{t("notifications.metrics.byType")}</p>
        <div className="flex flex-wrap gap-2">
          {stats === null ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : Object.keys(stats.byType).length === 0 ? (
            <span className="text-xs text-muted-foreground">{t("notifications.empty")}</span>
          ) : (
            Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {t(`notificationType.${type}`, type)}: {count}
              </Badge>
            ))
          )}
        </div>
      </div>
    </Surface>
  );
}
