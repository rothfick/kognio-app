import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Level = "novice" | "developing" | "proficient" | "mastered" | "unknown";

const META: Record<Level, { cls: string }> = {
  unknown:    { cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  novice:     { cls: "bg-destructive/10 text-destructive border-destructive/30" },
  developing: { cls: "bg-warning/10 text-warning border-warning/30" },
  proficient: { cls: "bg-accent/10 text-accent border-accent/30" },
  mastered:   { cls: "bg-success/10 text-success border-success/30" },
};

/** Visual mastery indicator. Currently a placeholder — real values flow in after SKG ships. */
export function MasteryBadge({
  level = "unknown",
  className,
}: {
  level?: Level;
  className?: string;
}) {
  const { t } = useTranslation();
  const m = META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        m.cls,
        className,
      )}
    >
      {t(`mastery.${level}`)}
    </span>
  );
}
