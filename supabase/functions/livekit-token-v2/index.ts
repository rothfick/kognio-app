// Live Lesson Room v1 — issues a LiveKit JWT keyed on booking_id.
// Validates that the caller is a participant of the booking (student, parent, tutor) or admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AccessToken } from "npm:livekit-server-sdk@2.9.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const wsUrl = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !wsUrl) {
      return json({ error: "setup_required", missing: ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"].filter(k => !Deno.env.get(k)) }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: uerr } = await supabase.auth.getUser(jwt);
    if (uerr || !userData?.user?.id) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const bookingId = body?.booking_id;
    if (!bookingId || typeof bookingId !== "string") return json({ error: "booking_id_required" }, 400);

    const { data: booking, error: berr } = await supabase
      .from("bookings")
      .select("id, student_id, tutor_id, parent_user_id, status")
      .eq("id", bookingId)
      .maybeSingle();
    if (berr || !booking) return json({ error: "not_found_or_forbidden" }, 403);

    // Determine role
    let role: "student" | "parent" | "tutor" | "admin" = "student";
    if (booking.tutor_id === userId) role = "tutor";
    else if (booking.parent_user_id === userId) role = "parent";
    else if (booking.student_id === userId) role = "student";
    else {
      // admin?
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "forbidden" }, 403);
      role = "admin";
    }

    if (booking.status === "cancelled" || booking.status === "disputed") {
      return json({ error: "booking_not_joinable", booking_status: booking.status }, 409);
    }

    const roomName = `kogni-booking-${bookingId}`;

    // Ensure live_sessions row exists
    const { data: existingLs } = await supabase
      .from("live_sessions").select("id, room_name, status").eq("booking_id", bookingId).maybeSingle();
    if (!existingLs) {
      await supabase.from("live_sessions").insert({
        booking_id: bookingId, room_name: roomName, status: "scheduled",
      });
      await supabase.from("live_session_events").insert({
        booking_id: bookingId, user_id: userId, event_type: "room_opened", payload: { role },
      });
    }

    const { data: profile } = await supabase
      .from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const name = profile?.display_name || "Participant";

    const at = new AccessToken(apiKey, apiSecret, { identity: userId, name, ttl: "2h" });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: role !== "admin",
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();

    return json({ url: wsUrl, token, roomName, participantRole: role });
  } catch (e) {
    console.error("livekit-token-v2 error", e);
    return json({ error: "internal_error" }, 500);
  }
});
