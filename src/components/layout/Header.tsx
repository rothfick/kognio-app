import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, Globe, LogOut, User as UserIcon, Search, Users, HandHelping, Calendar, Brain, Settings } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/discover", key: "discover", Icon: Search },
  { to: "/circles", key: "circles", Icon: Users },
  { to: "/peer", key: "peer", Icon: HandHelping },
  { to: "/calendar", key: "calendar", Icon: Calendar },
  { to: "/brain", key: "brain", Icon: Brain },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleLang = () => {
    const next = i18n.language?.startsWith("en") ? "pl" : "en";
    i18n.changeLanguage(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero text-primary-foreground shadow-soft">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">{t("brand.name")}</span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, key, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-smooth ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleLang} aria-label="language">
            <Globe className="h-4 w-4" />
            <span className="ml-1 text-xs uppercase">{i18n.language?.slice(0, 2) || "pl"}</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[140px] truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("nav.myProfile")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" /> {t("nav.settings")}
                </DropdownMenuItem>
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
