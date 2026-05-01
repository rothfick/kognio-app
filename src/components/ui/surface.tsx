import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Calm card surface used for dashboards and primary content blocks. */
export function Surface({
  children,
  className,
  variant = "default",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "ai" | "muted";
  as?: keyof JSX.IntrinsicElements;
}) {
  const base = "rounded-xl border shadow-soft";
  const variants = {
    default: "bg-card",
    ai: "bg-ai-soft border-accent/20",
    muted: "bg-muted/40",
  } as const;
  return <Tag className={cn(base, variants[variant], className)}>{children}</Tag>;
}
