import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function DashboardHeader({
  title,
  subtitle,
  primaryAction,
}: {
  title: string;
  subtitle: string;
  primaryAction?: { label: string; to: string };
}) {
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>
      </div>
      {primaryAction && (
        <Button asChild className="bg-accent-gradient text-accent-foreground shadow-glow self-start md:self-auto">
          <Link to={primaryAction.to}>
            {primaryAction.label} <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return <div className="container mx-auto px-4 py-10 max-w-6xl">{children}</div>;
}
