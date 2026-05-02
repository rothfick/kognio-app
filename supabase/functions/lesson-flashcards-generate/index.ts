// supabase/functions/lesson-flashcards-generate/index.ts
// Generates 5-10 flashcards for the student/child from an approved (or draft if tutor) lesson summary,
// or falls back to transcript/notes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You generate concise study flashcards for the Kogni tutoring platform.
Output STRICT JSON: {"cards":[{"front":"...","back":"...","explanation":""}]}.
Rules:
- 5–10 cards, max ~25 words each side, no markdown.
- "front" is a question or term, "back" is a short answer/definition.
- "explanation" is optional (1 sentence, max 30 words).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "missing auth" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => null) as { booking_id?: string; count?: number } | null;
    const bookingId = body?.booking_id;
    const requested = Math.max(3, Math.min(10, body?.count ?? 5));
    if (!bookingId) return json(400, { error: "booking_id required" });

    const { data: booking } = await supabase
      .from("bookings").select("id,tutor_id,student_id,parent_user_id,child_id,competency_id,skill_area_label")
      .eq("id", bookingId).maybeSingle();
    if (!booking) return json(404, { error: "booking not found" });

    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    const isTutor = (booking as any).tutor_id === user.id;
    const isStudent = (booking as any).student_id === user.id;
    const isParent = (booking as any).parent_user_id === user.id;
    if (!isAdmin && !isTutor && !isStudent && !isParent) return json(403, { error: "not allowed" });

    // Source: prefer approved student summary; tutor may use draft
    let sourceText = "";
    let sourceId: string | null = null;
    const { data: summaries } = await supabase
      .from("lesson_summaries").select("id,audience,status,markdown")
      .eq("booking_id", bookingId).order("created_at", { ascending: false });
    const approvedStudent = (summaries as any[] || []).find((s) => s.audience === "student" && s.status === "approved");
    const draftStudent = isTutor ? (summaries as any[] || []).find((s) => s.audience === "student") : null;
    const draftTutor = isTutor ? (summaries as any[] || []).find((s) => s.audience === "tutor") : null;
    const pick = approvedStudent || draftStudent || draftTutor;
    if (pick) { sourceText = pick.markdown || ""; sourceId = pick.id; }

    if (!sourceText) {
      const { data: notes } = await supabase
        .from("session_notes").select("notes,covered_skill_areas,recommended_next_step")
        .eq("booking_id", bookingId).maybeSingle();
      sourceText = (notes as any)?.notes || (booking as any).skill_area_label || "";
    }

    if (!sourceText) return json(400, { error: "no source content available" });

    const key = Deno.env.get("LOVABLE_API_KEY");
    let parsed: any = null;
    let model = "google/gemini-2.5-flash";
    if (key) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `Skill: ${(booking as any).skill_area_label || "—"}\nGenerate ${requested} flashcards from:\n${sourceText.slice(0, 6000)}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (aiRes.status === 429) return json(429, { error: "rate_limited" });
        if (aiRes.status === 402) return json(402, { error: "ai_credits" });
        if (aiRes.ok) {
          const data = await aiRes.json();
          const txt = data?.choices?.[0]?.message?.content;
          if (txt) parsed = JSON.parse(txt);
        }
      } catch (_e) {/*fallback*/}
    }

    let cards = Array.isArray(parsed?.cards) ? parsed.cards : null;
    if (!cards || cards.length === 0) {
      const area = (booking as any).skill_area_label || "ten temat";
      cards = [
        { front: `Co to jest: ${area}?`, back: "Krótka definicja — uzupełnij na podstawie lekcji.", explanation: "" },
        { front: `Podaj przykład z obszaru: ${area}.`, back: "Przykład — uzupełnij na podstawie lekcji.", explanation: "" },
        { front: `Najczęstszy błąd przy: ${area}.`, back: "Krótka uwaga — uzupełnij.", explanation: "" },
      ];
    }
    cards = cards.filter((c: any) => typeof c?.front === "string" && typeof c?.back === "string").slice(0, 10);

    // Decide owner
    let ownerType: "user" | "child" = "user";
    let userIdField: string | null = null;
    let childIdField: string | null = null;
    if ((booking as any).child_id) { ownerType = "child"; childIdField = (booking as any).child_id; }
    else if ((booking as any).student_id) { ownerType = "user"; userIdField = (booking as any).student_id; }

    const rows = cards.map((c: any) => ({
      owner_type: ownerType,
      user_id: userIdField,
      child_id: childIdField,
      booking_id: bookingId,
      source_type: "lesson_summary",
      source_id: sourceId,
      competency_id: (booking as any).competency_id || null,
      skill_area_label: (booking as any).skill_area_label || null,
      front: String(c.front).slice(0, 400),
      back: String(c.back).slice(0, 600),
      explanation: c.explanation ? String(c.explanation).slice(0, 600) : null,
      status: "active",
    }));

    const { data: inserted, error: iErr } = await supabase
      .from("flashcards").insert(rows as never).select("id");
    if (iErr) return json(400, { error: iErr.message });

    try {
      const recipient = (booking as any).child_id
        ? (booking as any).parent_user_id
        : (booking as any).student_id;
      if (recipient) {
        await supabase.from("notifications").insert({
          user_id: recipient, type: "flashcards_ready",
          payload: { booking_id: bookingId, count: rows.length },
        } as never);
      }
    } catch (_e) {/*non-blocking*/}

    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "flashcards_generated",
        owner_type: ownerType, user_id: userIdField, child_id: childIdField,
        algorithm_version: "lesson_flashcards_v1",
        input_summary: { booking_id: bookingId, source_id: sourceId },
        output_summary: { count: (inserted as any[])?.length ?? rows.length },
        metrics: {}, created_by: user.id,
      } as never);
    } catch (_e) {/*non-blocking*/}

    return json(200, { ok: true, count: (inserted as any[])?.length ?? rows.length });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
