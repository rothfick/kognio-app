import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check, X, Inbox, ExternalLink, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardHeader, DashboardShell } from "@/components/layout/DashboardShell";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { dismissNotification, markAllRead, markNotificationRead } from "@/lib/notifications";
import type { NotificationRow } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const SEVERITY_CLASSES: Record<string, string> = {
  info: "border-l-primary",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  critical: "border-l-destructive",
};

type Filter = "unread" | "all" | "dismissed";

export default function Notifications() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<Filter>("unread");
  const [loading, setLoading] = useState(true);
  const lang = i18n.language?.startsWith("pl") ? "pl-PL" : i18n.language?.startsWith("es") ? "es-ES" : "en-US";

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data || []) as unknown as NotificationRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((n) => n.status === "unread");
    if (filter === "dismissed") return items.filter((n) => n.status === "dismissed");
    return items;
  }, [items, filter]);

  if (authLoading) return <AppShell><div className="container py-12 text-sm text-muted-foreground">{t("common.loading")}</div></AppShell>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleAction = async (n: NotificationRow) => {
    if (n.status === "unread") await markNotificationRead(n.id, user.id, n.type, n.severity, n.action_url);
    if (n.action_url) navigate(n.action_url);
    load();
  };

  const handleDismiss = async (n: NotificationRow) => {
    await dismissNotification(n.id, user.id, n.type, n.severity, n.action_url);
    load();
  };

  const handleMarkAll = async () => { await markAllRead(user.id); load(); };

  const unreadCount = items.filter((n) => n.status === "unread").length;

  return (
    <AppShell>
      <DashboardShell>
        <DashboardHeader
          title={t("notifications.pageTitle")}
          subtitle={t("notifications.pageSubtitle")}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {t("common.back")}
              </Button>
              {unreadCount > 0 && (
                <Button size="sm" onClick={handleMarkAll}>
                  <Check className="h-4 w-4 mr-1" /> {t("notifications.markAllRead")}
                </Button>
              )}
            </div>
          }
        />
        <Surface className="p-5">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="unread">{t("notifications.filter.unread")} ({unreadCount})</TabsTrigger>
              <TabsTrigger value="all">{t("notifications.filter.all")}</TabsTrigger>
              <TabsTrigger value="dismissed">{t("notifications.filter.dismissed")}</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} className="mt-4">
              {loading ? (
                <p className="text-sm text-muted-foreground py-6">{t("common.loading")}</p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                  <p className="text-sm">{t("notifications.empty")}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        "rounded-lg border bg-card border-l-4 p-4 flex items-start justify-between gap-4",
                        SEVERITY_CLASSES[n.severity] || "border-l-primary",
                        n.status === "unread" ? "shadow-soft" : "opacity-80",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className={cn("text-sm", n.status === "unread" ? "font-semibold" : "font-medium")}>{n.title}</p>
                          <Badge variant="secondary" className="text-[10px]">{t(`notificationType.${n.type}`, n.type)}</Badge>
                          <Badge variant="outline" className="text-[10px]">{t(`severity.${n.severity}`)}</Badge>
                          <span className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString(lang)}</span>
                        </div>
                        {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {n.action_url && n.status !== "dismissed" && (
                          <Button size="sm" variant="outline" onClick={() => handleAction(n)}>
                            {n.action_label || t("notifications.open")} <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                        {n.status !== "dismissed" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDismiss(n)}>
                            <X className="h-3 w-3 mr-1" /> {t("notifications.dismiss")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </Surface>
      </DashboardShell>
    </AppShell>
  );
}
