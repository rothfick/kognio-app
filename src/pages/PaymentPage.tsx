import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";

type Booking = { id: string; tutor_id: string; student_id: string; price_cents: number; currency: string };
type PM = { id: string; method_type: string; label: string; details: string; is_default: boolean };
type Payment = { id: string; status: string; method_type: string; method_details: string; amount_cents: number; currency: string; reference_code: string; marked_paid_at: string | null; confirmed_at: string | null };

const PaymentPage = () => {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [methods, setMethods] = useState<PM[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!bookingId) return;
    const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    setBooking(b as Booking);
    if (b) {
      const { data: pms } = await supabase.from("tutor_payment_methods").select("*").eq("tutor_id", b.tutor_id);
      setMethods((pms as PM[]) || []);
      const { data: p } = await supabase.from("payments").select("*").eq("booking_id", bookingId).maybeSingle();
      setPayment(p as Payment);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [bookingId]);

  const createPayment = async (m: PM) => {
    if (!user || !booking) return;
    const ref = `MDR-${booking.id.slice(0, 6).toUpperCase()}`;
    const { error } = await supabase.from("payments").insert({
      booking_id: booking.id, student_id: booking.student_id, tutor_id: booking.tutor_id,
      amount_cents: booking.price_cents, currency: booking.currency,
      method_type: m.method_type as "blik" | "iban" | "revolut" | "paypal" | "other", method_details: m.details, reference_code: ref,
    });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const markPaid = async () => {
    if (!payment) return;
    await supabase.from("payments").update({ status: "marked_paid", marked_paid_at: new Date().toISOString() }).eq("id", payment.id);
    toast.success(t("payment.markedPaidToast"));
    load();
  };

  const confirmReceived = async () => {
    if (!payment) return;
    await supabase.from("payments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", payment.id);
    toast.success(t("payment.confirmedToast"));
    load();
  };

  if (loading) return <AppShell><div className="container py-10">{t("common.loading")}</div></AppShell>;
  if (!booking) return <AppShell><div className="container py-10">{t("payment.notFound")}</div></AppShell>;

  const isStudent = user?.id === booking.student_id;
  const isTutor = user?.id === booking.tutor_id;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-hero text-primary-foreground"><Wallet className="h-5 w-5" /></div>
          <h1 className="text-3xl font-bold">{t("payment.title")}</h1>
        </div>

        <Card className="p-6 bg-card-soft mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-muted-foreground">{t("payment.amountDue")}</span>
            <span className="text-3xl font-bold">{(booking.price_cents / 100).toFixed(2)} {booking.currency}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("payment.directNote")}</p>
        </Card>

        {!payment ? (
          isStudent ? (
            methods.length === 0 ? (
              <Card className="p-6 text-center bg-card-soft text-muted-foreground">{t("payment.noMethods")}</Card>
            ) : (
              <Card className="p-6 bg-card-soft">
                <h2 className="font-semibold mb-3">{t("payment.chooseMethod")}</h2>
                <div className="space-y-2">
                  {methods.map((m) => (
                    <button key={m.id} onClick={() => createPayment(m)} className="w-full flex items-center gap-3 p-4 rounded-lg border bg-background hover:bg-secondary transition-smooth text-left">
                      <span className="uppercase text-xs font-bold text-accent w-16">{m.method_type}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{m.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.details}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )
          ) : <Card className="p-6 bg-card-soft text-center text-muted-foreground">{t("payment.waitingStudent")}</Card>
        ) : (
          <Card className="p-6 bg-card-soft space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={payment.status === "confirmed" ? "default" : "secondary"} className="capitalize">
                {payment.status === "pending" && t("payment.statusPending")}
                {payment.status === "marked_paid" && t("payment.statusMarked")}
                {payment.status === "confirmed" && <><CheckCircle2 className="h-3 w-3 mr-1 inline" />{t("payment.statusConfirmed")}</>}
              </Badge>
              <span className="text-sm font-mono">{payment.reference_code}</span>
            </div>

            <div className="rounded-lg bg-background border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t("payment.method")}</p>
                <p className="font-bold uppercase">{payment.method_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t("payment.transferDetails")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm p-2 bg-secondary rounded break-all">{payment.method_details}</code>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(payment.method_details); toast.success(t("payment.copyToast")); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">{t("payment.transferTitle")}</p>
                <code className="font-mono text-sm p-2 bg-secondary rounded inline-block">{payment.reference_code}</code>
              </div>
            </div>

            {isStudent && payment.status === "pending" && (
              <Button onClick={markPaid} className="w-full bg-accent-gradient text-accent-foreground">{t("payment.markPaid")}</Button>
            )}
            {isTutor && payment.status === "marked_paid" && (
              <Button onClick={confirmReceived} className="w-full bg-success text-success-foreground hover:opacity-90">{t("payment.confirmReceived")}</Button>
            )}
            {payment.status === "confirmed" && (
              <p className="text-center text-success font-medium flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5" /> {t("payment.completed")}</p>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default PaymentPage;
