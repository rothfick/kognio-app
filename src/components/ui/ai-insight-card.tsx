import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Surface } from "./surface";
import { cn } from "@/lib/utils";

/** Card highlighting an AI-generated insight, with subtle gradient + glow. */
export function AIInsightCard({
  title,
  children,
  footer,
  className,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Surface variant="ai" className={cn("p-5", className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs uppercase tracking-wide text-accent font-semibold">AI · {title}</p>
      </div>
      <div className="text-sm text-foreground/90 leading-relaxed">{children}</div>
      {footer && <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">{footer}</div>}
    </Surface>
  );
}
