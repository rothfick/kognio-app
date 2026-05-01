import { cn } from "@/lib/utils";

type Level = "novice" | "developing" | "proficient" | "mastered" | "unknown";

const META: Record<Level, { label: string; cls: string }> = {
  unknown:    { label: "Brak danych",  cls: "bg-muted text-muted-foreground border-muted-foreground/20" },
  novice:     { label: "Początek",     cls: "bg-destructive/10 text-destructive border-destructive/30" },
  developing: { label: "Rozwija się",  cls: "bg-warning/10 text-warning border-warning/30" },
  proficient: { label: "Sprawnie",     cls: "bg-accent/10 text-accent border-accent/30" },
  mastered:   { label: "Opanowane",    cls: "bg-success/10 text-success border-success/30" },
};

/** Visual mastery indicator. Currently a placeholder — real values flow in after SKG ships. */
export function MasteryBadge({
  level = "unknown",
  className,
}: {
  level?: Level;
  className?: string;
}) {
  const m = META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  );
}
