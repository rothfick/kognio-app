import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ClipboardCheck, TrendingUp, Users, Baby } from "lucide-react";

type Funnel = {
  selfDiagnosis: number;
  selfPlan: number;
  selfPlanActive: number;
  selfCheckpoint: number;
  childDiagnosis: number;
  childPlan: number;
};

export function FirstSuccessFunnelSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<Funnel | null>(null);

  useEffect(() => {
    (async () => {
      const [diagSelf, planSelf, planSelfActive, cpSelf, diagChild, planChild] = await Promise.all([
        supabase.from("diagnostic_attempts").select("user_id").eq("status", "completed").not("user_id", "is", null),
        supabase.from("learning_plans").select("user_id").not("user_id", "is", null),
        supabase.from("learning_plans").select("user_id").eq("status", "active").not("user_id", "is", null),
        supabase.from("learning_checkpoints").select("user_id").eq("status", "completed").not("user_id", "is", null),
        supabase.from("diagnostic_attempts").select("child_id").eq("status", "completed").not("child_id", "is", null),
        supabase.from("learning_plans").select("child_id").not("child_id", "is", null),
      ]);
      const distinct = (rows: { user_id?: string | null; child_id?: string | null }[] | null, key: "user_id" | "child_id") => {
        const s = new Set<string>();
        (rows || []).forEach((r) => { const v = r[key]; if (v) s.add(v); });
        return s.size;
      };
      setData({
        selfDiagnosis: distinct(diagSelf.data as any, "user_id"),
        selfPlan: distinct(planSelf.data as any, "user_id"),
        selfPlanActive: distinct(planSelfActive.data as any, "user_id"),
        selfCheckpoint: distinct(cpSelf.data as any, "user_id"),
        childDiagnosis: distinct(diagChild.data as any, "child_id"),
        childPlan: distinct(planChild.data as any, "child_id"),
      });
    })();
  }, []);

  if (!data) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">{t("firstSuccess.funnel.title")}</h2>
      <p className="text-xs text-muted-foreground mb-3">{t("firstSuccess.funnel.subtitle")}</p>
      <Surface className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label={t("firstSuccess.funnel.selfDiagnosis")} value={data.selfDiagnosis} />
          <StatCard icon={Sparkles} label={t("firstSuccess.funnel.selfPlan")} value={data.selfPlan} />
          <StatCard icon={ClipboardCheck} label={t("firstSuccess.funnel.selfPlanActive")} value={data.selfPlanActive} />
          <StatCard icon={TrendingUp} label={t("firstSuccess.funnel.selfCheckpoint")} value={data.selfCheckpoint} />
          <StatCard icon={Baby} label={t("firstSuccess.funnel.childDiagnosis")} value={data.childDiagnosis} />
          <StatCard icon={Sparkles} label={t("firstSuccess.funnel.childPlan")} value={data.childPlan} />
        </div>
      </Surface>
    </section>
  );
}
