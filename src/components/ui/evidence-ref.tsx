import { LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline citation linking an AI claim back to source evidence. */
export function EvidenceRef({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10 transition-smooth",
        className,
      )}
    >
      <LinkIcon className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}
