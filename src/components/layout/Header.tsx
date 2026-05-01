import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GraduationCap, Globe, LogOut, User as UserIcon, Search, Users, HandHelping,
  Calendar, Brain, Settings, LayoutDashboard,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { isTutor } = useUserRoles();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setPendingCount(0); setAvatarUrl(null); return; }
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("avatar_url, display_name").eq("id", user.id).maybeSingle();
      setAvatarUrl(profile?.avatar_url || null);
      setDisplayName(profile?.display_name || null);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !isTutor) { setPendingCount(0); return; }
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tutor_id", user.id)
        .eq("status", "pending");
      if (!cancelled) setPendingCount(count || 0);
    };
    refresh();
    const ch = supabase.channel(`hdr-bookings-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `tutor_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, isTutor]);

  const navItems = [
    { to: "/dashboard", key: "dashboard", Icon: LayoutDashboard },
    { to: "/discover", key: "discover", Icon: Search },
    { to: "/circles", key: "circles", Icon: Users },
    { to: "/peer", key: "peer", Icon: HandHelping },
    { to: "/calendar", key: "calendar", Icon: Calendar, badge: pendingCount },
    { to: "/brain", key: "brain", Icon: Brain },
  ];

  const currentLang = (["pl", "en", "es"] as const).find((l) => i18n.language?.startsWith(l)) || "pl";
  const setLang = (l: "pl" | "en" | "es") => i18n.changeLanguage(l);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero text-primary-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">{t("brand.name")}</span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, key, Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {t(`nav.${key}`)}
                {badge ? (
                  <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px] bg-accent text-accent-foreground">
                    {badge}
                  </Badge>
                ) : null}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("common.language")}> 
                <Globe className="h-4 w-4" />
                <span className="ml-1 text-xs uppercase">{currentLang}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => setLang("pl")}>Polski</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("es")}>Español</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={t("common.me")} />}
                    <AvatarFallback className="bg-accent/20 text-accent text-xs font-bold">
                      {(displayName || user.email || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline max-w-[140px] truncate text-sm">{displayName || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("nav.myProfile")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <LayoutDashboard className="h-4 w-4 mr-2" /> {t("nav.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="h-4 w-4 mr-2" /> {t("nav.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" /> {t("nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="h-4 w-4 mr-2" /> {t("nav.signout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>{t("nav.signin")}</Button>
              <Button size="sm" onClick={() => navigate("/auth?mode=signup")} className="bg-accent-gradient text-accent-foreground hover:opacity-90">
                {t("nav.signup")}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
