import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "tutor" | "admin";

export function useUserRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!cancelled) {
        setRoles(((data || []) as { role: AppRole }[]).map((r) => r.role));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return {
    roles,
    loading,
    isStudent: roles.includes("student"),
    isTutor: roles.includes("tutor"),
    isAdmin: roles.includes("admin"),
  };
}
