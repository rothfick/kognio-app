import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MyOrgRow = {
  organization_id: string;
  name: string;
  org_type: string;
  status: string;
  member_role: string; // owner | admin | teacher | student | observer
};

/**
 * Returns the organizations the current user belongs to (as owner or via organization_members).
 * Uses existing tables only — no schema changes.
 */
export function useMyOrganizations() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<MyOrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setOrgs([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const map = new Map<string, MyOrgRow>();
      // Owner
      const { data: owned } = await supabase
        .from("organizations")
        .select("id,name,org_type,status")
        .eq("owner_id", user.id);
      (owned || []).forEach((o: any) => map.set(o.id, {
        organization_id: o.id, name: o.name, org_type: o.org_type, status: o.status, member_role: "owner",
      }));
      // Member
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id, member_role, organizations:organization_id(id,name,org_type,status)")
        .eq("user_id", user.id);
      (mem || []).forEach((m: any) => {
        const o = m.organizations;
        if (!o) return;
        if (!map.has(o.id)) {
          map.set(o.id, {
            organization_id: o.id, name: o.name, org_type: o.org_type, status: o.status, member_role: m.member_role,
          });
        }
      });
      if (!cancelled) {
        setOrgs(Array.from(map.values()));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { orgs, loading };
}
