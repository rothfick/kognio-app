/**
 * Generate next-N-days bookable slots from recurring weekday availability.
 *
 * For v1:
 *  - 60-minute fixed session duration
 *  - Each weekday slot (start_time -> end_time) expands to N consecutive
 *    1-hour windows that fit within [start_time, end_time)
 *  - We exclude any slot that overlaps an existing booking (non-cancelled)
 *  - We exclude slots in the past
 *  - All times are interpreted in the slot's timezone string but produced
 *    as UTC ISO strings via simple local-time arithmetic (good enough for
 *    pilot v1 where tutors run in Europe/Warsaw)
 */
export interface RecurringSlot {
  id: string;
  weekday: number; // 0 (Sun) .. 6 (Sat) — Postgres EXTRACT(DOW)
  start_time: string; // "HH:MM:SS"
  end_time: string;   // "HH:MM:SS"
  timezone: string;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface ExistingBooking {
  starts_at: string; // ISO
  ends_at: string;   // ISO
  status: string;
}

export interface BookableSlot {
  startsAt: string; // ISO UTC
  endsAt: string;   // ISO UTC
  weekday: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function parseHMS(hms: string): { h: number; m: number } {
  const [h, m] = hms.split(":").map((x) => parseInt(x, 10));
  return { h: h || 0, m: m || 0 };
}

export function expandAvailability(
  slots: RecurringSlot[],
  bookings: ExistingBooking[],
  daysAhead = 14,
  durationMinutes = 60,
): BookableSlot[] {
  const now = new Date();
  const out: BookableSlot[] = [];
  const busy = bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as [number, number]);

  for (let d = 0; d < daysAhead; d += 1) {
    const day = new Date(now.getTime() + d * DAY_MS);
    const weekday = day.getDay();
    const matching = slots.filter((s) => s.weekday === weekday);
    for (const s of matching) {
      // Validity window
      if (s.valid_from && day < new Date(s.valid_from)) continue;
      if (s.valid_to && day > new Date(s.valid_to)) continue;

      const { h: sh, m: sm } = parseHMS(s.start_time);
      const { h: eh, m: em } = parseHMS(s.end_time);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm, 0, 0).getTime();
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em, 0, 0).getTime();

      for (let t = dayStart; t + durationMinutes * 60 * 1000 <= dayEnd; t += durationMinutes * 60 * 1000) {
        const start = t;
        const end = t + durationMinutes * 60 * 1000;
        if (end <= now.getTime()) continue;
        const overlapsBusy = busy.some(([bs, be]) => start < be && end > bs);
        if (overlapsBusy) continue;
        out.push({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          weekday,
        });
      }
    }
  }

  out.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return out;
}

export function groupSlotsByDay(slots: BookableSlot[]): Record<string, BookableSlot[]> {
  const out: Record<string, BookableSlot[]> = {};
  for (const s of slots) {
    const key = s.startsAt.slice(0, 10);
    (out[key] ||= []).push(s);
  }
  return out;
}
