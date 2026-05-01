import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { UpcomingBookingItem } from "@/components/booking/UpcomingBookingCard";

type Mode = "student_self" | "tutor" | "parent_children";

interface RawBooking {
  id: string;
  starts_at: string;
  status: string;
  payment_status: string;
  tutor_id: string;
  student_id: string | null;
  parent_user_id: string | null;
  child_id: string | null;
}

export function useUpcomingBookings(mode: Mode) {
  const { user } = useAuth();
  const [items, setItems] = useState<UpcomingBookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("bookings")
        .select("id, starts_at, status, payment_status, tutor_id, student_id, parent_user_id, child_id")
        .gte("ends_at", nowIso)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(10);

      if (mode === "student_self") q = q.eq("student_id", user.id);
      else if (mode === "tutor") q = q.eq("tutor_id", user.id);
      else if (mode === "parent_children") q = q.eq("parent_user_id", user.id);

      const { data: rows } = await q;
      const bookings = (rows || []) as RawBooking[];

      if (bookings.length === 0) {
        if (!cancelled) { setItems([]); setLoading(false); }
        return;
      }

      const tutorIds = Array.from(new Set(bookings.map((b) => b.tutor_id)));
      const childIds = Array.from(new Set(bookings.map((b) => b.child_id).filter(Boolean) as string[]));
      const studentIds = Array.from(new Set(bookings.map((b) => b.student_id).filter(Boolean) as string[]));
      const allProfileIds = Array.from(new Set([...tutorIds, ...studentIds]));

      const [{ data: profs }, { data: kids }, { data: pays }] = await Promise.all([
        allProfileIds.length ? supabase.from("profiles").select("id, display_name").in("id", allProfileIds) : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> }),
        childIds.length ? supabase.from("parent_children").select("id, display_name").in("id", childIds) : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
        supabase.from("payment_records").select("booking_id, status").in("booking_id", bookings.map((b) => b.id)),
      ]);

      const profMap = new Map(((profs || []) as Array<{ id: string; display_name: string | null }>).map((p) => [p.id, p.display_name || ""]));
      const childMap = new Map(((kids || []) as Array<{ id: string; display_name: string }>).map((c) => [c.id, c.display_name]));
      const payMap = new Map(((pays || []) as Array<{ booking_id: string; status: string }>).map((p) => [p.booking_id, p.status]));

      const result: UpcomingBookingItem[] = bookings.map((b) => {
        const payStatus = payMap.get(b.id) || b.payment_status;
        const needsProof = mode !== "tutor" && (payStatus === "pending" || payStatus === "unpaid");
        const isTutorView = mode === "tutor";
        const learnerName = b.child_id
          ? childMap.get(b.child_id) || ""
          : b.student_id
            ? profMap.get(b.student_id) || ""
            : "";
        return {
          id: b.id,
          starts_at: b.starts_at,
          status: b.status,
          payment_status: b.payment_status,
          tutor_name: isTutorView ? null : profMap.get(b.tutor_id) || "",
          learner_name: isTutorView ? learnerName : (b.child_id ? childMap.get(b.child_id) || null : null),
          needs_proof: needsProof,
        };
      });

      if (!cancelled) {
        setItems(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, mode]);

  return { items, loading };
}
