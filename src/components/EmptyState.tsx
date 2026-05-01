import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCta?: () => void;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaTo, onCta, className = "" }: Props) {
  return (
    <Card className={`p-10 text-center bg-card-soft border-dashed ${className}`}>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">{description}</p>}
      {ctaLabel && (ctaTo || onCta) && (
        ctaTo ? (
          <Button asChild className="bg-accent-gradient text-accent-foreground"><Link to={ctaTo}>{ctaLabel}</Link></Button>
        ) : (
          <Button onClick={onCta} className="bg-accent-gradient text-accent-foreground">{ctaLabel}</Button>
        )
      )}
    </Card>
  );
}
