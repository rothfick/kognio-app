// supabase/functions/homework-generate/index.ts
// Generates a homework assignment with 5-8 items targeted at a weak skill area.
// Uses Lovable AI Gateway (LOVABLE_API_KEY) for item generation, with a deterministic fallback.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateBody {
  source_type: "diagnosis" | "learning_plan" | "booking" | "session_note" | "manual";
  source_id?: string | null;
  owner_type: "user" | "child";
  child_id?: string | null;
  // Context (any of these used to seed):
  skill_area_label?: string | null;
  competency_id?: string | null;
  learning_domain_id?: string | null;
  education_level_id?: string | null;
  diagnostic_attempt_id?: string | null;
  learning_plan_id?: string | null;
  learning_plan_item_id?: string | null;
  booking_id?: string | null;
  session_note_id?: string | null;
  language?: "pl" | "en" | "es";
  title_hint?: string | null;
}

interface AiItem {
  prompt: string;
  item_type: "multiple_choice" | "true_false" | "short_answer";
  choices?: string[];
  correct_answer?: string | boolean | null;
  explanation?: string;
  difficulty_level?: number;
}

const SYSTEM_PROMPT = (lang: string) => `You are an educational content generator for the Kogni learning platform.
Generate 6 short practice questions for the given weak skill area.
Mix item types: 3 multiple_choice (4 options each), 2 true_false, 1 short_answer.
Output JSON only matching this exact shape:
{
  "items": [
    {"prompt":"...","item_type":"multiple_choice","choices":["A","B","C","D"],"correct_answer":"A","explanation":"...","difficulty_level":2}
  ]
}
Language: ${lang}. Keep questions concise, age-appropriate, and pedagogically sound.`;

function fallbackItems(area: string, lang: string): AiItem[] {
  const a = area || "general practice";
  const t = (pl: string, en: string, es: string) => lang === "pl" ? pl : lang === "es" ? es : en;
  return [
    {
      prompt: t(`Krótkie pytanie powtórkowe z obszaru: ${a}. Wybierz najlepszą odpowiedź.`,
               `Short review question on: ${a}. Choose the best answer.`,
               `Pregunta breve de repaso sobre: ${a}. Elige la mejor respuesta.`),
      item_type: "multiple_choice",
      choices: ["A", "B", "C", "D"],
      correct_answer: "A",
      explanation: t("Wybór A jest poprawny w kontekście tego obszaru.", "Option A is correct for this area.", "La opción A es correcta para esta área."),
      difficulty_level: 2,
    },
    {
      prompt: t(`Czy poniższe stwierdzenie dotyczące obszaru "${a}" jest prawdziwe?`,
               `Is the following statement about "${a}" true?`,
               `¿Es verdadera la siguiente afirmación sobre "${a}"?`),
      item_type: "true_false",
      correct_answer: true,
      explanation: t("Stwierdzenie jest poprawne.", "The statement is correct.", "La afirmación es correcta."),
      difficulty_level: 2,
    },
    {
      prompt: t(`Wyjaśnij krótko kluczowe pojęcie z obszaru: ${a}.`,
               `Briefly explain the key concept of: ${a}.`,
               `Explica brevemente el concepto clave de: ${a}.`),
      item_type: "short_answer",
      correct_answer: null,
      explanation: t("Odpowiedź zostanie sprawdzona przez korepetytora.", "Your tutor will review this answer.", "Tu tutor revisará esta respuesta."),
      difficulty_level: 2,
    },
  ];
}

async function generateAiItems(area: string, lang: string): Promise<AiItem[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT(lang) },
          { role: "user", content: `Weak skill area: ${area}. Generate 6 items.` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content;
    if (!txt) return null;
    const parsed = JSON.parse(txt);
    const items = Array.isArray(parsed?.items) ? parsed.items : null;
    if (!items || items.length === 0) return null;
    return items
      .filter((i: any) => typeof i?.prompt === "string" && i?.item_type)
      .slice(0, 8);
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as GenerateBody;
    const lang = body.language || "pl";
    let area = body.skill_area_label || "";

    // If we don't have a skill area, try to derive one
    if (!area && body.diagnostic_attempt_id) {
      const { data } = await supabase
        .from("diagnostic_attempts")
        .select("summary, domain")
        .eq("id", body.diagnostic_attempt_id)
        .maybeSingle();
      const breakdown = (data as any)?.summary?.kc_breakdown as Array<{ kc_label?: string; mastery_pct?: number }> | undefined;
      if (Array.isArray(breakdown) && breakdown.length) {
        const weak = [...breakdown].sort((a, b) => (a.mastery_pct ?? 0) - (b.mastery_pct ?? 0))[0];
        area = weak?.kc_label || (data as any)?.domain || "";
      }
    }
    if (!area && body.learning_plan_item_id) {
      const { data } = await supabase
        .from("learning_plan_items")
        .select("skill_area, title")
        .eq("id", body.learning_plan_item_id)
        .maybeSingle();
      area = (data as any)?.skill_area || (data as any)?.title || "";
    }
    if (!area && body.session_note_id) {
      const { data } = await supabase
        .from("session_notes")
        .select("covered_skill_areas, recommended_next_step, notes")
        .eq("id", body.session_note_id)
        .maybeSingle();
      const skills = (data as any)?.covered_skill_areas as string[] | null;
      area = (Array.isArray(skills) && skills[0]) || (data as any)?.recommended_next_step || "";
    }

    if (!area) area = body.title_hint || "Practice";

    // Resolve booking → tutor scope (created_by must be tutor for booking-source)
    let createdBy = user.id;
    let userIdField: string | null = null;
    let childIdField: string | null = null;
    if (body.owner_type === "user") userIdField = user.id;
    if (body.owner_type === "child" && body.child_id) childIdField = body.child_id;

    const title = body.title_hint || `${lang === "pl" ? "Praktyka" : lang === "es" ? "Práctica" : "Practice"}: ${area}`;

    // 1) Insert assignment
    const insertRow: Record<string, unknown> = {
      owner_type: body.owner_type,
      user_id: userIdField,
      child_id: childIdField,
      created_by: createdBy,
      source_type: body.source_type,
      source_id: body.source_id ?? null,
      learning_plan_id: body.learning_plan_id ?? null,
      learning_plan_item_id: body.learning_plan_item_id ?? null,
      booking_id: body.booking_id ?? null,
      session_note_id: body.session_note_id ?? null,
      diagnostic_attempt_id: body.diagnostic_attempt_id ?? null,
      learning_domain_id: body.learning_domain_id ?? null,
      education_level_id: body.education_level_id ?? null,
      competency_id: body.competency_id ?? null,
      skill_area_label: area,
      title,
      status: "assigned",
      generated_by: "homework_generator_v1",
      algorithm_version: "homework_generator_v1",
      prompt_version: "homework_prompt_v1",
      evidence: { source: body.source_type, area, language: lang },
    };

    const { data: created, error: aErr } = await supabase
      .from("assignments")
      .insert(insertRow as never)
      .select("id")
      .single();
    if (aErr || !created) {
      return new Response(JSON.stringify({ error: aErr?.message || "insert failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const assignmentId = (created as { id: string }).id;

    // 2) Generate items (AI w/ fallback)
    let items = await generateAiItems(area, lang);
    if (!items || items.length === 0) items = fallbackItems(area, lang);

    const rows = items.map((it, idx) => ({
      assignment_id: assignmentId,
      order_index: idx,
      item_type: it.item_type,
      prompt: it.prompt,
      choices: Array.isArray(it.choices) ? it.choices : [],
      correct_answer: it.correct_answer === undefined ? null : it.correct_answer,
      explanation: it.explanation || null,
      difficulty_level: it.difficulty_level ?? 2,
      points: 1,
      skill_area_label: area,
      competency_id: body.competency_id ?? null,
    }));
    const { error: iErr } = await supabase.from("assignment_items").insert(rows as never);
    if (iErr) {
      return new Response(JSON.stringify({ error: iErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) SMART evidence event (best-effort)
    try {
      await supabase.from("smart_evidence_events").insert({
        event_type: "homework_generated",
        owner_type: body.owner_type,
        user_id: userIdField,
        child_id: childIdField,
        algorithm_version: "homework_v1",
        input_summary: {
          assignment_id: assignmentId,
          source: body.source_type,
          skill_area_label: area,
          competency_id: body.competency_id ?? null,
          booking_id: body.booking_id ?? null,
        },
        output_summary: { item_count: rows.length },
        metrics: {},
        created_by: user.id,
      } as never);
    } catch (_e) { /* non-blocking */ }

    return new Response(JSON.stringify({ assignment_id: assignmentId, item_count: rows.length, area }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
