import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

export type SelfMilestoneKey =
  | "account_created"
  | "consent_completed"
  | "diagnosis_started"
  | "diagnosis_completed"
  | "learning_plan_generated"
  | "learning_plan_activated"
  | "checkpoint_available";

export type ParentMilestoneKey =
  | "account_created"
  | "child_added"
  | "child_consent_completed"
  | "child_diagnosis_started"
  | "child_diagnosis_completed"
  | "child_learning_plan_generated"
  | "child_learning_plan_activated"
  | "checkpoint_available";

export type SelfJourney = {
  loading: boolean;
  hasAiConsent: boolean;
  hasDiagnosisInProgress: boolean;
  hasDiagnosisCompleted: boolean;
  latestAttemptId: string | null;
  hasPlan: boolean;
  planId: string | null;
  planStatus: string | null;
  planItemsTotal: number;
  planItemsDone: number;
  hasCheckpoint: boolean;
  checkpointId: string | null;
  refresh: () => Promise<void>;
};

export type ChildJourney = {
  childId: string;
  displayName: string;
  hasConsent: boolean;
  hasDiagnosisInProgress: boolean;
  hasDiagnosisCompleted: boolean;
  latestAttemptId: string | null;
  planId: string | null;
  planStatus: string | null;
  planItemsTotal: number;
  planItemsDone: number;
  checkpointId: string | null;
};

export type ParentJourney = {
  loading: boolean;
  children: ChildJourney[];
  refresh: () => Promise<void>;
};

/** Self-user journey state computed from real data. */
export function useSelfJourney(): SelfJourney {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Omit<SelfJourney, "loading" | "refresh">>({
    hasAiConsent: false,
    hasDiagnosisInProgress: false,
    hasDiagnosisCompleted: false,
    latestAttemptId: null,
    hasPlan: false,
    planId: null,
    planStatus: null,
    planItemsTotal: 0,
    planItemsDone: 0,
    hasCheckpoint: false,
    checkpointId: null,
  });

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [consent, diagDone, diagInProg, planRow, cp] = await Promise.all([
      supabase.from("consent_records").select("id").eq("user_id", user.id).is("child_id", null)
        .eq("consent_type", "ai_diagnosis_notice").eq("status", "accepted").limit(1).maybeSingle(),
      supabase.from("diagnostic_attempts").select("id").eq("user_id", user.id).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("diagnostic_attempts").select("id").eq("user_id", user.id).in("status", ["in_progress", "started"]).limit(1).maybeSingle(),
      supabase.from("learning_plans").select("id, status").eq("user_id", user.id).neq("status", "archived")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("learning_checkpoints").select("id").eq("user_id", user.id).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    let planItemsTotal = 0;
    let planItemsDone = 0;
    if (planRow.data?.id) {
      const { data: items } = await supabase.from("learning_plan_items").select("status").eq("plan_id", planRow.data.id);
      const list = (items || []) as { status: string }[];
      planItemsTotal = list.length;
      planItemsDone = list.filter((i) => i.status === "done").length;
    }

    setState({
      hasAiConsent: !!consent.data,
      hasDiagnosisInProgress: !!diagInProg.data,
      hasDiagnosisCompleted: !!diagDone.data,
      latestAttemptId: (diagDone.data as { id?: string } | null)?.id ?? null,
      hasPlan: !!planRow.data,
      planId: (planRow.data as { id?: string } | null)?.id ?? null,
      planStatus: (planRow.data as { status?: string } | null)?.status ?? null,
      planItemsTotal,
      planItemsDone,
      hasCheckpoint: !!cp.data,
      checkpointId: (cp.data as { id?: string } | null)?.id ?? null,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { loading, ...state, refresh: load };
}

/** Parent journey state — one ChildJourney per linked child. */
export function useParentJourney(): ParentJourney {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ChildJourney[]>([]);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: kids } = await supabase
      .from("parent_children")
      .select("id, display_name, consent_signed_at")
      .eq("parent_id", user.id)
      .order("created_at", { ascending: true });
    const kidList = (kids || []) as { id: string; display_name: string; consent_signed_at: string | null }[];

    const out: ChildJourney[] = await Promise.all(kidList.map(async (k) => {
      const [consentRec, diagDone, diagInProg, planRow, cp] = await Promise.all([
        supabase.from("consent_records").select("id").eq("child_id", k.id)
          .eq("consent_type", "parent_child_data_processing").eq("status", "accepted").limit(1).maybeSingle(),
        supabase.from("diagnostic_attempts").select("id").eq("child_id", k.id).eq("status", "completed")
          .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("diagnostic_attempts").select("id").eq("child_id", k.id).in("status", ["in_progress", "started"]).limit(1).maybeSingle(),
        supabase.from("learning_plans").select("id, status").eq("child_id", k.id).neq("status", "archived")
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("learning_checkpoints").select("id").eq("child_id", k.id).eq("status", "completed")
          .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      let planItemsTotal = 0; let planItemsDone = 0;
      if (planRow.data?.id) {
        const { data: items } = await supabase.from("learning_plan_items").select("status").eq("plan_id", planRow.data.id);
        const list = (items || []) as { status: string }[];
        planItemsTotal = list.length;
        planItemsDone = list.filter((i) => i.status === "done").length;
      }
      return {
        childId: k.id,
        displayName: k.display_name,
        hasConsent: !!consentRec.data || !!k.consent_signed_at,
        hasDiagnosisInProgress: !!diagInProg.data,
        hasDiagnosisCompleted: !!diagDone.data,
        latestAttemptId: (diagDone.data as { id?: string } | null)?.id ?? null,
        planId: (planRow.data as { id?: string } | null)?.id ?? null,
        planStatus: (planRow.data as { status?: string } | null)?.status ?? null,
        planItemsTotal,
        planItemsDone,
        checkpointId: (cp.data as { id?: string } | null)?.id ?? null,
      };
    }));

    setChildren(out);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { loading, children, refresh: load };
}

export type NextAction = {
  key: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  reason: string;
  status: "ready" | "in_progress" | "complete";
  progress?: { done: number; total: number };
};

export function computeSelfNextAction(j: SelfJourney): NextAction {
  const total = 5;
  if (!j.hasAiConsent) {
    return { key: "consent", labelKey: "nextAction.self.consent.label", descriptionKey: "nextAction.self.consent.desc", route: "/diagnose", reason: "no_consent", status: "ready", progress: { done: 0, total } };
  }
  if (!j.hasDiagnosisCompleted) {
    return { key: "diagnose", labelKey: "nextAction.self.diagnose.label", descriptionKey: "nextAction.self.diagnose.desc", route: "/diagnose", reason: j.hasDiagnosisInProgress ? "diag_in_progress" : "no_diag", status: j.hasDiagnosisInProgress ? "in_progress" : "ready", progress: { done: 1, total } };
  }
  if (!j.hasPlan) {
    return { key: "create_plan", labelKey: "nextAction.self.createPlan.label", descriptionKey: "nextAction.self.createPlan.desc", route: "/diagnose", reason: "no_plan", status: "ready", progress: { done: 2, total } };
  }
  if (j.planItemsDone < 3) {
    return { key: "do_plan", labelKey: "nextAction.self.doPlan.label", descriptionKey: "nextAction.self.doPlan.desc", route: `/plans/${j.planId}`, reason: "plan_in_progress", status: "in_progress", progress: { done: 3, total } };
  }
  if (!j.hasCheckpoint) {
    return { key: "checkpoint", labelKey: "nextAction.self.checkpoint.label", descriptionKey: "nextAction.self.checkpoint.desc", route: `/plans/${j.planId}`, reason: "ready_for_checkpoint", status: "ready", progress: { done: 4, total } };
  }
  return { key: "view_checkpoint", labelKey: "nextAction.self.viewCheckpoint.label", descriptionKey: "nextAction.self.viewCheckpoint.desc", route: `/checkpoints/${j.checkpointId}`, reason: "checkpoint_done", status: "complete", progress: { done: 5, total } };
}

export function computeChildNextAction(c: ChildJourney): NextAction {
  const total = 5;
  if (!c.hasConsent) {
    return { key: "child_consent", labelKey: "nextAction.parent.childConsent.label", descriptionKey: "nextAction.parent.childConsent.desc", route: `/parent/children/${c.childId}/diagnose`, reason: "no_child_consent", status: "ready", progress: { done: 1, total } };
  }
  if (!c.hasDiagnosisCompleted) {
    return { key: "child_diagnose", labelKey: "nextAction.parent.childDiagnose.label", descriptionKey: "nextAction.parent.childDiagnose.desc", route: `/parent/children/${c.childId}/diagnose`, reason: c.hasDiagnosisInProgress ? "child_diag_in_progress" : "no_child_diag", status: c.hasDiagnosisInProgress ? "in_progress" : "ready", progress: { done: 2, total } };
  }
  if (!c.planId) {
    return { key: "child_create_plan", labelKey: "nextAction.parent.childCreatePlan.label", descriptionKey: "nextAction.parent.childCreatePlan.desc", route: `/parent/children/${c.childId}/knowledge`, reason: "no_child_plan", status: "ready", progress: { done: 3, total } };
  }
  if (c.planItemsDone < 3) {
    return { key: "child_do_plan", labelKey: "nextAction.parent.childDoPlan.label", descriptionKey: "nextAction.parent.childDoPlan.desc", route: `/plans/${c.planId}`, reason: "child_plan_in_progress", status: "in_progress", progress: { done: 4, total } };
  }
  if (!c.checkpointId) {
    return { key: "child_checkpoint", labelKey: "nextAction.parent.childCheckpoint.label", descriptionKey: "nextAction.parent.childCheckpoint.desc", route: `/plans/${c.planId}`, reason: "child_ready_for_checkpoint", status: "ready", progress: { done: 4, total } };
  }
  return { key: "child_view_checkpoint", labelKey: "nextAction.parent.childViewCheckpoint.label", descriptionKey: "nextAction.parent.childViewCheckpoint.desc", route: `/checkpoints/${c.checkpointId}`, reason: "child_checkpoint_done", status: "complete", progress: { done: 5, total } };
}

/** Hook returning either self or parent next-best action(s). */
export function useNextBestAction() {
  const { isParent } = useUserRoles();
  const self = useSelfJourney();
  const parent = useParentJourney();

  if (isParent) {
    if (parent.loading) return { loading: true as const, mode: "parent" as const };
    if (parent.children.length === 0) {
      return {
        loading: false as const,
        mode: "parent" as const,
        addChild: true as const,
        action: { key: "add_child", labelKey: "nextAction.parent.addChild.label", descriptionKey: "nextAction.parent.addChild.desc", route: "/dashboard/parent", reason: "no_child", status: "ready" as const, progress: { done: 1, total: 5 } },
        children: [] as { child: ChildJourney; action: NextAction }[],
        refresh: parent.refresh,
      };
    }
    const perChild = parent.children
      .map((c) => ({ child: c, action: computeChildNextAction(c) }))
      // prioritize least progress (lowest done), then status complete last
      .sort((a, b) => (a.action.status === "complete" ? 1 : 0) - (b.action.status === "complete" ? 1 : 0)
        || (a.action.progress?.done ?? 0) - (b.action.progress?.done ?? 0));
    return { loading: false as const, mode: "parent" as const, addChild: false as const, action: perChild[0].action, children: perChild, refresh: parent.refresh };
  }

  if (self.loading) return { loading: true as const, mode: "self" as const };
  return { loading: false as const, mode: "self" as const, action: computeSelfNextAction(self), journey: self, refresh: self.refresh };
}
