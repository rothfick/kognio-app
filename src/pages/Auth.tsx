import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { GraduationCap } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
});

const Auth = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const next = params.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(safeNext);
  }, [user, navigate, safeNext]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(issue.path[0] === "email" ? t("auth.invalidEmail") : t("auth.passwordMin"));
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}${safeNext}` },
        });
        if (error) throw error;
        toast.success(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
        navigate(safeNext);
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : t("auth.errorGeneric");
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${safeNext}` });
    if (result.error) {
      toast.error(t("auth.errorGeneric"));
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate(safeNext);
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8 shadow-elegant bg-card-soft">
          <div className="flex flex-col items-center mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-hero text-primary-foreground shadow-soft mb-4">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">{t(mode === "signup" ? "auth.signupTitle" : "auth.signinTitle")}</h1>
          </div>

          <Button type="button" variant="outline" className="w-full mb-4" onClick={onGoogle} disabled={loading}>
            {t("auth.google")}
          </Button>

          <div className="flex items-center gap-3 my-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase">{t("auth.or")}</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
            <Button type="submit" className="w-full bg-accent-gradient text-accent-foreground hover:opacity-90" disabled={loading}>
              {t(mode === "signup" ? "auth.submitSignup" : "auth.submitSignin")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
            <button
              type="button"
              className="text-accent font-medium hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? t("auth.signinHere") : t("auth.signupHere")}
            </button>
          </p>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:underline">← {t("common.back")}</Link>
        </p>
      </div>
    </AppShell>
  );
};

export default Auth;
