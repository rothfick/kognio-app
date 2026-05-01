import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ConsentType } from "@/components/pilot/ResearchConsentDialog";

/**
 * Returns true if a consent of given type already exists (accepted) for current user or specified child.
 * `loading` is true while checking. After accepting via the dialog, callers should call refresh().
 */
export function useConsent(consentType: ConsentType, childId?: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);

  const check = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("consent_records")
      .select("id, status")
      .eq("consent_type", consentType)
      .eq("status", "accepted")
      .limit(1);
    if (childId) {
      q = q.eq("child_id", childId);
    } else {
      q = q.eq("user_id", user.id).is("child_id", null);
    }
    const { data } = await q.maybeSingle();
    setHasConsent(!!data);
    setLoading(false);
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, childId, consentType]);

  return { hasConsent, loading, refresh: check };
}
