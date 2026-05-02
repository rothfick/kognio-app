import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useUserRoles, AppRole } from "@/hooks/useUserRoles";

type ActiveRole = AppRole;

interface Ctx {
  /** Available roles the user actually has. */
  available: ActiveRole[];
  /** Currently selected active role (drives nav & default landing). */
  active: ActiveRole | null;
  setActive: (r: ActiveRole) => void;
  /** True when user has more than one selectable role and may flip. */
  hasMultiple: boolean;
}

const ActiveRoleCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "kogni.activeRole";

/**
 * Selectable roles in order of priority for default selection.
 * Admin/parent are always shown when present; tutor only when user_roles
 * actually contains 'tutor' (i.e. tutor was approved by admin).
 */
const ROLE_PRIORITY: ActiveRole[] = ["admin", "tutor", "parent", "student"];

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { roles, loading } = useUserRoles();
  const [active, setActiveState] = useState<ActiveRole | null>(null);

  const available = useMemo<ActiveRole[]>(
    () => ROLE_PRIORITY.filter((r) => roles.includes(r)),
    [roles],
  );

  // Initialize / repair active role whenever available set changes.
  useEffect(() => {
    if (loading) return;
    if (available.length === 0) { setActiveState(null); return; }
    const stored = (typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null) as ActiveRole | null;
    if (stored && available.includes(stored)) {
      setActiveState(stored);
    } else {
      setActiveState(available[0]);
    }
  }, [loading, available]);

  const setActive = (r: ActiveRole) => {
    if (!available.includes(r)) return;
    setActiveState(r);
    try { window.localStorage.setItem(STORAGE_KEY, r); } catch { /* noop */ }
  };

  const value: Ctx = {
    available,
    active,
    setActive,
    hasMultiple: available.length > 1,
  };

  return <ActiveRoleCtx.Provider value={value}>{children}</ActiveRoleCtx.Provider>;
}

export function useActiveRole() {
  const ctx = useContext(ActiveRoleCtx);
  if (!ctx) {
    // Fallback (provider not mounted yet) — behave as "no active role".
    return { available: [], active: null, setActive: () => {}, hasMultiple: false } as Ctx;
  }
  return ctx;
}
