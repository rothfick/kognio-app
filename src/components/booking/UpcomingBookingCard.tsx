import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalIcon, ArrowRight, AlertTriangle, Search } from "lucide-react";

export interface UpcomingBookingItem {
  id: string;
  starts_at: string;
  status: string;
  payment_status: string;
  tutor_name?: string | null;
  learner_name?: string | null;
  needs_proof?: boolean;
}

interface Props {
  loading?: boolean;
  items: UpcomingBookingItem[];
  /** Show "Find a tutor" CTA when there are no items. */
  emptyShowFindTutor?: boolean;
  /** Optional contextual hint, e.g. "tutor can help with your weak areas". */
  emptyHint?: string;
  /** Title override. */
  title?: string;
  /** Show a payment-attention banner for items that need proof. */
  showPaymentAttention?: boolean;
}

export function UpcomingBookingCard({
  loading,
  items,
  emptyShowFindTutor = true,
  emptyHint,
  title,
  showPaymentAttention = true,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "pl").split("-")[0];
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const attention = showPaymentAttention ? items.filter((i) => i.needs_proof) : [];

  return (
    <Surface className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-accent" /> {title || t("dashboardBooking.upcomingTitle")}
        </h2>
        {items.length > 0 && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/calendar">{t("dashboardBooking.openCalendar")} <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        )}
      </div>

      {attention.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{t("dashboardBooking.paymentAttentionTitle")}</p>
            <p className="text-muted-foreground">{t("dashboardBooking.paymentAttentionBody", { count: attention.length })}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/calendar">{t("dashboardBooking.uploadProofCta")}</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-card-soft p-5 text-center">
          <Search className="h-6 w-6 text-accent mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">{t("dashboardBooking.emptyTitle")}</p>
          <p className="text-xs text-muted-foreground mb-3">{emptyHint || t("dashboardBooking.emptyDesc")}</p>
          {emptyShowFindTutor && (
            <Button asChild size="sm" className="bg-accent-gradient text-accent-foreground">
              <Link to="/discover">{t("dashboardBooking.findTutorCta")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 3).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-md border bg-card-soft px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{fmt(b.starts_at)}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {b.tutor_name ? `${t("dashboardBooking.with")}: ${b.tutor_name}` : b.learner_name || ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                <Badge variant="secondary" className="text-[10px]">{t(`calendar.status.${b.status}`, { defaultValue: b.status })}</Badge>
                <Badge variant="outline" className="text-[10px]">{t(`payment.status.${b.payment_status}`, { defaultValue: b.payment_status })}</Badge>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                  <Link to={`/session/${b.id}`}>{t("liveLesson.joinShort", { defaultValue: "Join" })}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
