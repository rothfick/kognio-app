import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FileCheck, FileX, MessageSquare, Star, Layers } from "lucide-react";

type Stats = {
  activeCohorts: number;
  participants: number;
  consentsAccepted: number;
  consentsWithdrawn: number;
  feedbackEntries: number;
  averageRating: number | null;
};

type RecentFeedback = {
  id: string;
  context_type: string;
  rating: number | null;
  created_at: string;
  owner_type: "self" | "parent_child";
};

export function PilotReadinessSection() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [
        { count: activeCohorts },
        { count: participants },
        { count: consentsAccepted },
        { count: consentsWithdrawn },
        { count: feedbackEntries },
        { data: ratingsData },
        { data: recentData },
      ] = await Promise.all([
        supabase.from("pilot_cohorts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("pilot_participants").select("id", { count: "exact", head: true }),
        supabase.from("consent_records").select("id", { count: "exact", head: true }).eq("status", "accepted"),
        supabase.from("consent_records").select("id", { count: "exact", head: true }).eq("status", "withdrawn"),
        supabase.from("user_feedback").select("id", { count: "exact", head: true }),
        supabase.from("user_feedback").select("rating").not("rating", "is", null).limit(1000),
        supabase
          .from("user_feedback")
          .select("id, context_type, rating, created_at, user_id, child_id")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const ratings = (ratingsData ?? []).map((r: any) => r.rating).filter((n: any) => typeof n === "number");
      const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;

      setStats({
        activeCohorts: activeCohorts ?? 0,
        participants: participants ?? 0,
        consentsAccepted: consentsAccepted ?? 0,
        consentsWithdrawn: consentsWithdrawn ?? 0,
        feedbackEntries: feedbackEntries ?? 0,
        averageRating: avg,
      });

      setRecent(
        (recentData ?? []).map((r: any) => ({
          id: r.id,
          context_type: r.context_type,
          rating: r.rating,
          created_at: r.created_at,
          owner_type: r.child_id ? "parent_child" : "self",
        }))
      );

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t("pilot.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pilot.subtitle")}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Layers} label={t("pilot.activeCohorts")} value={loading ? "…" : String(stats?.activeCohorts ?? 0)} />
        <StatCard icon={Users} label={t("pilot.participants")} value={loading ? "…" : String(stats?.participants ?? 0)} />
        <StatCard icon={FileCheck} label={t("pilot.consentsAccepted")} value={loading ? "…" : String(stats?.consentsAccepted ?? 0)} />
        <StatCard icon={FileX} label={t("pilot.consentsWithdrawn")} value={loading ? "…" : String(stats?.consentsWithdrawn ?? 0)} />
        <StatCard icon={MessageSquare} label={t("pilot.feedbackEntries")} value={loading ? "…" : String(stats?.feedbackEntries ?? 0)} />
        <StatCard
          icon={Star}
          label={t("pilot.averageRating")}
          value={loading ? "…" : stats?.averageRating != null ? stats.averageRating.toFixed(2) : "—"}
        />
      </div>

      <Surface className="p-4">
        <h3 className="text-sm font-semibold mb-3">{t("pilot.recentFeedback")}</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pilot.noFeedback")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("feedback.context")}</TableHead>
                <TableHead>{t("feedback.rating")}</TableHead>
                <TableHead>{t("feedback.anonymousOwner")}</TableHead>
                <TableHead>{t("consent.acceptedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.context_type}</TableCell>
                  <TableCell>{r.rating ?? "—"}</TableCell>
                  <TableCell>{r.owner_type === "parent_child" ? t("pilot.ownerParentChild") : t("pilot.ownerSelf")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Surface>
    </section>
  );
}
