import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

type System = { id: string; code: string; name_pl: string; name_en: string | null; name_es: string | null };
type Level = { id: string; education_system_id: string; code: string; order_index: number; name_pl: string; name_en: string | null; name_es: string | null };
type Domain = { id: string; code: string; name_pl: string; name_en: string | null; name_es: string | null; domain_type: string };

export type CurriculumSelection = {
  system?: System;
  level?: Level;
  domain?: Domain;
};

interface Props {
  onChange: (sel: CurriculumSelection) => void;
}

export function CurriculumPicker({ onChange }: Props) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const localized = (row: { name_pl: string; name_en: string | null; name_es: string | null }) =>
    (lang === "en" ? row.name_en : lang === "es" ? row.name_es : row.name_pl) || row.name_pl;

  const [systems, setSystems] = useState<System[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [systemId, setSystemId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("");
  const [domainId, setDomainId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, l, d] = await Promise.all([
        supabase.from("education_systems").select("id, code, name_pl, name_en, name_es").eq("is_active", true).order("code"),
        supabase.from("education_levels").select("id, education_system_id, code, order_index, name_pl, name_en, name_es").eq("is_active", true).order("order_index"),
        supabase.from("learning_domains").select("id, code, name_pl, name_en, name_es, domain_type").eq("is_active", true).order("name_pl"),
      ]);
      setSystems((s.data as System[]) || []);
      setLevels((l.data as Level[]) || []);
      setDomains((d.data as Domain[]) || []);
      setLoading(false);
    })();
  }, []);

  const filteredLevels = useMemo(
    () => (systemId ? levels.filter((lv) => lv.education_system_id === systemId) : []),
    [systemId, levels],
  );

  useEffect(() => {
    const system = systems.find((s) => s.id === systemId);
    const level = filteredLevels.find((l) => l.id === levelId);
    const domain = domains.find((d) => d.id === domainId);
    onChange({ system, level, domain });
  }, [systemId, levelId, domainId, systems, filteredLevels, domains, onChange]);

  if (loading) return <p className="text-xs text-muted-foreground">{t("diagnoseTaxonomy.loading")}</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="text-xs font-medium mb-1 block">{t("diagnoseTaxonomy.system")}</label>
        <select
          value={systemId}
          onChange={(e) => { setSystemId(e.target.value); setLevelId(""); }}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">{t("diagnoseTaxonomy.any")}</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{localized(s)}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">{t("diagnoseTaxonomy.level")}</label>
        <select
          value={levelId}
          onChange={(e) => setLevelId(e.target.value)}
          disabled={!systemId}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
        >
          <option value="">{t("diagnoseTaxonomy.any")}</option>
          {filteredLevels.map((lv) => <option key={lv.id} value={lv.id}>{localized(lv)}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium mb-1 block">{t("diagnoseTaxonomy.domain")}</label>
        <select
          value={domainId}
          onChange={(e) => setDomainId(e.target.value)}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">{t("diagnoseTaxonomy.any")}</option>
          {domains.map((d) => <option key={d.id} value={d.id}>{localized(d)}</option>)}
        </select>
      </div>
    </div>
  );
}
