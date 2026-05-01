// Wystawia JWT do LiveKit dla uczestnika sesji (student lub tutor).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AccessToken } from "npm:livekit-server-sdk@2.9.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: cerr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cerr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const sessionId = body?.sessionId;
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sesja + RLS: select wykona się tylko jeśli user jest uczestnikiem bookingu (is_session_participant)
    const { data: session, error: serr } = await supabase
      .from("sessions").select("id, room_name, booking_id").eq("id", sessionId).maybeSingle();
    if (serr || !session) {
      return new Response(JSON.stringify({ error: "Session not found or access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pobierz nazwę wyświetlaną
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const name = profile?.display_name || "Uczestnik";

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const wsUrl = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !wsUrl) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name,
      ttl: "2h",
    });
    at.addGrant({
      room: session.room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return new Response(JSON.stringify({ token, wsUrl, room: session.room_name, identity: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("livekit-token error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
