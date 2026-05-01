import { LucideIcon } from "lucide-react";
import { Surface } from "./surface";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  className?: string;
}) {
  const trendCls =
    trend?.direction === "up"
      ? "text-success"
      : trend?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <Surface className={cn("p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {(hint || trend) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {trend && <span className={cn("font-medium", trendCls)}>{trend.text} </span>}
          {hint}
        </p>
      )}
    </Surface>
  );
}
