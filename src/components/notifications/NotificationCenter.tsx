import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check, X, Inbox, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type NotificationRow } from "@/hooks/useNotifications";
import { dismissNotification, markAllRead, markNotificationRead } from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const SEVERITY_CLASSES: Record<string, string> = {
  info: "border-l-primary",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  critical: "border-l-destructive",
};

export function NotificationCenter() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, unreadCount, refresh } = useNotifications(10);

  if (!user) return null;

  const handleClick = async (n: NotificationRow) => {
    if (n.status === "unread") {
      await markNotificationRead(n.id, user.id, n.type, n.severity, n.action_url);
    }
    if (n.action_url) navigate(n.action_url);
    refresh();
  };

  const handleDismiss = async (e: React.MouseEvent, n: NotificationRow) => {
    e.stopPropagation();
    await dismissNotification(n.id, user.id, n.type, n.severity, n.action_url);
    refresh();
  };

  const handleMarkAll = async () => {
    await markAllRead(user.id);
    refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.title")}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-accent text-accent-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">{t("notifications.title")}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAll}>
              <Check className="h-3 w-3 mr-1" /> {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Inbox className="h-6 w-6" />
              <p className="text-xs">{t("notifications.empty")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-secondary/60 border-l-2 transition-smooth",
                    SEVERITY_CLASSES[n.severity] || "border-l-primary",
                    n.status === "unread" ? "bg-secondary/30" : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm truncate", n.status === "unread" ? "font-semibold" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      {n.action_label && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary mt-1">
                          {n.action_label} <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDismiss(e, n)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      aria-label={t("notifications.dismiss")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/notifications")}>
            {t("notifications.viewAll")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
