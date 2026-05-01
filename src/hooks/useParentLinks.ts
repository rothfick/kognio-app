import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ParentLinkScopes = {
  stats: boolean;
  plans: boolean;
  sessions: boolean;
  full: boolean;
};

export type ParentLinkRow = {
  id: string;
  student_id: string;
  parent_id: string | null;
  invited_email: string | null;
  pairing_code: string | null;
  status: "pending" | "active" | "revoked" | "declined" | "expired";
  scopes: ParentLinkScopes;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  parent_profile?: { display_name: string | null; full_name: string | null } | null;
  student_profile?: { display_name: string | null; full_name: string | null } | null;
};

const DEFAULT_SCOPES: ParentLinkScopes = { stats: true, plans: true, sessions: true, full: false };

function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Hook for STUDENT — manage links granting access to parents. */
export function useStudentParentLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<ParentLinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("student_parent_links")
      .select("*")
      .eq("student_id", user.id)
      .neq("status", "revoked")
      .order("created_at", { ascending: false });
    const rows = (data || []) as unknown as ParentLinkRow[];
    // Hydrate parent display names if linked
    const parentIds = Array.from(new Set(rows.map((r) => r.parent_id).filter(Boolean) as string[]));
    if (parentIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", parentIds);
      const map = new Map((profs || []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        if (r.parent_id) r.parent_profile = (map.get(r.parent_id) as ParentLinkRow["parent_profile"]) || null;
      });
    }
    setLinks(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const inviteByEmail = useCallback(async (email: string, scopes: Partial<ParentLinkScopes> = {}) => {
    if (!user) throw new Error("not_authenticated");
    const code = genCode();
    const { data, error } = await supabase
      .from("student_parent_links")
      .insert({
        student_id: user.id,
        invited_email: email.trim().toLowerCase(),
        pairing_code: code,
        scopes: { ...DEFAULT_SCOPES, ...scopes },
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    await load();
    return data as unknown as ParentLinkRow;
  }, [user, load]);

  const generateCode = useCallback(async (scopes: Partial<ParentLinkScopes> = {}) => {
    if (!user) throw new Error("not_authenticated");
    const code = genCode();
    const { data, error } = await supabase
      .from("student_parent_links")
      .insert({
        student_id: user.id,
        pairing_code: code,
        scopes: { ...DEFAULT_SCOPES, ...scopes },
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    await load();
    return data as unknown as ParentLinkRow;
  }, [user, load]);

  const revoke = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("student_parent_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await load();
  }, [load]);

  const updateScopes = useCallback(async (id: string, scopes: Partial<ParentLinkScopes>) => {
    const link = links.find((l) => l.id === id);
    const merged = { ...(link?.scopes || DEFAULT_SCOPES), ...scopes };
    const { error } = await supabase
      .from("student_parent_links")
      .update({ scopes: merged })
      .eq("id", id);
    if (error) throw error;
    await load();
  }, [links, load]);

  return { links, loading, refresh: load, inviteByEmail, generateCode, revoke, updateScopes };
}

/** Hook for PARENT — list students who have linked them, plus pending invitations by email. */
export function useLinkedStudents() {
  const { user } = useAuth();
  const [active, setActive] = useState<ParentLinkRow[]>([]);
  const [pending, setPending] = useState<ParentLinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setActive([]); setPending([]); setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("student_parent_links")
      .select("*")
      .or(`parent_id.eq.${user.id},invited_email.eq.${(user.email || "").toLowerCase()}`)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });
    const rows = (data || []) as unknown as ParentLinkRow[];
    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    if (studentIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", studentIds);
      const map = new Map((profs || []).map((p) => [p.id, p]));
      rows.forEach((r) => {
        r.student_profile = (map.get(r.student_id) as ParentLinkRow["student_profile"]) || null;
      });
    }
    setActive(rows.filter((r) => r.status === "active" && r.parent_id === user.id));
    setPending(rows.filter((r) => r.status === "pending"));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const acceptByCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.rpc("accept_student_parent_link", { _code: code.trim().toUpperCase() });
    if (error) throw error;
    await load();
    return data as string;
  }, [load]);

  const acceptInvite = useCallback(async (linkId: string) => {
    const { data, error } = await supabase.rpc("accept_student_parent_link_by_id", { _link_id: linkId });
    if (error) throw error;
    await load();
    return data as string;
  }, [load]);

  const declineInvite = useCallback(async (linkId: string) => {
    const { error } = await supabase
      .from("student_parent_links")
      .update({ status: "declined" })
      .eq("id", linkId);
    if (error) throw error;
    await load();
  }, [load]);

  return { active, pending, loading, refresh: load, acceptByCode, acceptInvite, declineInvite };
}
