import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const OrgInviteAccept = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    (async () => {
      // Best-effort preview (RLS lets invitee read their own invite)
      const { data } = await supabase
        .from("organization_invites")
        .select("organization_id,status,expires_at,email,organization:organizations(name)")
        .eq("token", token)
        .maybeSingle();
      if (data?.organization && (data.organization as any).name) {
        setOrgName((data.organization as any).name);
      }
    })();
  }, [token, user]);

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-muted-foreground">{t("common.loading")}</div>;
  if (!user) return <Navigate to={`/auth?next=/org/invite/${token}`} replace />;
  if (!token) return <Navigate to="/" replace />;

  const accept = async () => {
    setWorking(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("accept_org_invite", { _token: token });
    setWorking(false);
    if (rpcErr) {
      setError(rpcErr.message);
      toast.error(rpcErr.message);
      return;
    }
    setDone(true);
    toast.success(t("org.joinedToast"));
    setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    void data;
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-16 max-w-xl">
        <Card className="p-8 text-center">
          {done ? (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-accent mb-3" />
              <h1 className="text-2xl font-semibold mb-2">{t("org.joined")}</h1>
              <p className="text-muted-foreground">{t("org.redirecting")}</p>
            </>
          ) : error ? (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-3" />
              <h1 className="text-2xl font-semibold mb-2">{t("org.joinFailed")}</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => navigate("/dashboard")}>{t("org.backToDash")}</Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold mb-2">{t("org.inviteTitle")}</h1>
              <p className="text-muted-foreground mb-6">
                {orgName
                  ? <span dangerouslySetInnerHTML={{ __html: t("org.inviteBodyNamed", { name: orgName }) }} />
                  : t("org.inviteBodyGeneric")}
                <br />
                {t("org.inviteBodyClick")}
              </p>
              <Button onClick={accept} disabled={working} className="bg-accent-gradient text-accent-foreground">
                {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("org.accept")}
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                {t("org.sameEmailNote")}
              </p>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default OrgInviteAccept;
