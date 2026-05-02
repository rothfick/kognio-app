import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import {
  Globe2, Layers, BookOpen, GraduationCap, Network, Library, BadgeCheck, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Curr = {
  systems: number; levels: number; domains: number; competencies: number;
  edges: number; sources: number; approved: number; draft: number;
  mapped: number; unmapped: number;
};

const AdminCurriculum = () => {
  const { t } = useTranslation();
  const [c, setC] = useState<Curr | null>(null);

  useEffect(() => {
    (async () => {
      const [es, el, ld, comps, edges, src, approved, draft, mappedM, unmappedM] = await Promise.all([
        supabase.from("education_systems").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("education_levels").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("learning_domains").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("competency_prerequisites").select("id", { count: "exact", head: true }),
        supabase.from("curriculum_sources").select("id", { count: "exact", head: true }),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true).in("review_status", ["approved", "expert_reviewed"]),
        supabase.from("competencies").select("id", { count: "exact", head: true }).eq("is_active", true).in("review_status", ["draft", "ai_generated"]),
        supabase.from("user_competency_mastery").select("id", { count: "exact", head: true }).not("competency_id", "is", null),
        supabase.from("user_competency_mastery").select("id", { count: "exact", head: true }).is("competency_id", null),
      ]);
      setC({
        systems: es.count ?? 0, levels: el.count ?? 0, domains: ld.count ?? 0,
        competencies: comps.count ?? 0, edges: edges.count ?? 0, sources: src.count ?? 0,
        approved: approved.count ?? 0, draft: draft.count ?? 0,
        mapped: mappedM.count ?? 0, unmapped: unmappedM.count ?? 0,
      });
    })();
  }, []);

  const v = (n?: number) => (n === undefined ? "…" : String(n));

  return (
    <AdminPageShell title={t("adminCurriculum.title")} subtitle={t("adminCurriculum.subtitle")}>
      <Surface className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-accent" /> {t("adminCurriculum.graphTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-4 mb-4">
          <StatCard icon={Globe2} label={t("adminCurriculum.systems")} value={v(c?.systems)} />
          <StatCard icon={Layers} label={t("adminCurriculum.levels")} value={v(c?.levels)} />
          <StatCard icon={BookOpen} label={t("adminCurriculum.domains")} value={v(c?.domains)} />
          <StatCard icon={GraduationCap} label={t("adminCurriculum.competencies")} value={v(c?.competencies)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={Network} label={t("adminCurriculum.edges")} value={v(c?.edges)} />
          <StatCard icon={Library} label={t("adminCurriculum.sources")} value={v(c?.sources)} />
          <StatCard icon={BadgeCheck} label={t("adminCurriculum.approved")} value={v(c?.approved)} />
          <StatCard icon={ClipboardList} label={t("adminCurriculum.draft")} value={v(c?.draft)} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">{t("adminCurriculum.note")}</p>
      </Surface>

      <Surface className="p-5">
        <h2 className="font-semibold mb-3">{t("adminCurriculum.mappingTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={BadgeCheck} label={t("adminCurriculum.mapped")} value={v(c?.mapped)} />
          <StatCard icon={ClipboardList} label={t("adminCurriculum.unmapped")} value={v(c?.unmapped)} />
        </div>
      </Surface>
    </AdminPageShell>
  );
};

export default AdminCurriculum;
