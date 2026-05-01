// AI-adaptive diagnostic engine.
// Actions: start | next | finish
// - start:  { domain, level, language, child_id?, target_questions? } -> { attempt_id, item }
// - next:   { attempt_id, item_id, selected_choice } -> { item } | { done: true, summary }
// - finish: { attempt_id } -> { summary }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const DEFAULT_TARGET = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(payload: Record<string, unknown>): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

const QUESTION_TOOL = {
  type: "function",
  function: {
    name: "emit_question",
    description: "Emit one diagnostic multiple-choice question.",
    parameters: {
      type: "object",
      properties: {
        kc_label: { type: "string", description: "Short topic / knowledge component label, e.g. 'Ułamki — dodawanie'" },
        difficulty_level: { type: "integer", minimum: 1, maximum: 5 },
        question: { type: "string" },
        choices: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: { id: { type: "string", enum: ["A", "B", "C", "D", "E"] }, text: { type: "string" } },
            required: ["id", "text"],
            additionalProperties: false,
          },
        },
        correct_choice: { type: "string", enum: ["A", "B", "C", "D", "E"] },
        explanation: { type: "string" },
      },
      required: ["kc_label", "difficulty_level", "question", "choices", "correct_choice", "explanation"],
      additionalProperties: false,
    },
  },
};

const SUMMARY_TOOL = {
  type: "function",
  function: {
    name: "emit_summary",
    description: "Emit final diagnostic summary.",
    parameters: {
      type: "object",
      properties: {
        overall_level: { type: "string", description: "One of: początkujący, podstawowy, średnio-zaawansowany, zaawansowany, ekspercki" },
        score_pct: { type: "integer", minimum: 0, maximum: 100 },
        strengths: { type: "array", items: { type: "string" }, maxItems: 8 },
        gaps: { type: "array", items: { type: "string" }, maxItems: 8 },
        kc_breakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kc_label: { type: "string" },
              mastery_pct: { type: "integer", minimum: 0, maximum: 100 },
              status: { type: "string", enum: ["mocna", "stabilna", "do_pracy", "luka"] },
            },
            required: ["kc_label", "mastery_pct", "status"],
            additionalProperties: false,
          },
        },
        recommendations: { type: "array", items: { type: "string" }, maxItems: 6 },
        next_subject_suggestion: { type: "string" },
      },
      required: ["overall_level", "score_pct", "strengths", "gaps", "kc_breakdown", "recommendations"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(domain: string, level: string, language: string) {
  const lang = language === "en" ? "English" : language === "es" ? "Spanish" : "Polish";
  return `You are an expert adaptive diagnostician for the subject "${domain}" at level "${level}". 
You write rigorous, age/level-appropriate single-choice diagnostic questions in ${lang}.
- Probe a wide range of knowledge components (KCs) across the subject — vary topics every question.
- Adapt difficulty: if the previous answer was correct, raise difficulty (1→5); if incorrect, drop difficulty.
- Never repeat the same question; never reuse identical wording.
- Each question must have exactly ONE objectively correct answer; distractors must be plausible but clearly wrong.
- Keep stems concise (max ~3 sentences). Use LaTeX for math (e.g. $x^2$).
- Always emit via the function tool, never plain text.`;
}

function buildSummaryPrompt(domain: string, level: string, language: string) {
  const lang = language === "en" ? "English" : language === "es" ? "Spanish" : "Polish";
  return `You analyze a completed adaptive diagnostic for "${domain}" at level "${level}". 
Write all labels and recommendations in ${lang}. Be specific, actionable, and honest. 
Group results into knowledge components based on the asked questions. 
Recommendations should be 3-6 concrete next steps (e.g. "Powtórz dodawanie ułamków o różnych mianownikach — 4 zadania", "Załóż 1 lekcję z tutorem skupioną na równaniach kwadratowych").`;
}

interface AskedItem {
  id: string;
  kc_label: string;
  difficulty: number;
  question: string;
  correct_choice: string;
  selected_choice: string | null;
  is_correct: boolean | null;
}

async function generateQuestion(
  domain: string,
  level: string,
  language: string,
  asked: AskedItem[],
  targetDifficulty: number,
) {
  const recentSummary = asked.slice(-6).map((a, i) => ({
    n: asked.length - 6 + i + 1,
    kc: a.kc_label,
    diff: a.difficulty,
    correct: a.is_correct,
  }));
  const userMsg = `Asked so far: ${asked.length}. Target difficulty for next: ${targetDifficulty}/5.
Already-covered KCs (avoid repeating exactly the same): ${[...new Set(asked.map((a) => a.kc_label))].join(", ") || "(none)"}.
Recent answers: ${JSON.stringify(recentSummary)}.
Generate ONE next diagnostic question that probes a DIFFERENT KC than the immediately previous one when possible.`;

  const data = await callAI({
    model: MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(domain, level, language) },
      { role: "user", content: userMsg },
    ],
    tools: [QUESTION_TOOL],
    tool_choice: { type: "function", function: { name: "emit_question" } },
  });
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  const args = JSON.parse(call.function.arguments);
  return args as {
    kc_label: string;
    difficulty_level: number;
    question: string;
    choices: { id: string; text: string }[];
    correct_choice: string;
    explanation: string;
  };
}

async function generateSummary(domain: string, level: string, language: string, asked: AskedItem[]) {
  const items = asked.map((a) => ({
    kc: a.kc_label,
    diff: a.difficulty,
    correct: a.is_correct,
    selected: a.selected_choice,
    correct_choice: a.correct_choice,
  }));
  const data = await callAI({
    model: MODEL,
    messages: [
      { role: "system", content: buildSummaryPrompt(domain, level, language) },
      { role: "user", content: `Diagnostic answers (chronological):\n${JSON.stringify(items, null, 2)}\n\nProduce the final analysis.` },
    ],
    tools: [SUMMARY_TOOL],
    tool_choice: { type: "function", function: { name: "emit_summary" } },
  });
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return summary");
  return JSON.parse(call.function.arguments);
}

function nextDifficulty(asked: AskedItem[]): number {
  if (asked.length === 0) return 2;
  const last = asked[asked.length - 1];
  if (last.is_correct) return Math.min(5, last.difficulty + 1);
  return Math.max(1, last.difficulty - 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const user = userData.user;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body?.action ?? "");

  try {
    if (action === "start") {
      const domain = String(body.domain ?? "").trim();
      const level = String(body.level ?? "").trim();
      const language = ["pl", "en", "es"].includes(body.language) ? body.language : "pl";
      const childId = body.child_id ?? null;
      const target = Math.max(8, Math.min(20, Number(body.target_questions ?? DEFAULT_TARGET)));
      if (!domain) return json({ error: "Brak dziedziny" }, 400);
      if (!level) return json({ error: "Brak poziomu" }, 400);

      // Verify parent->child if childId provided
      if (childId) {
        const { data: child } = await userClient
          .from("parent_children")
          .select("id")
          .eq("id", childId)
          .maybeSingle();
        if (!child) return json({ error: "Brak dostępu do tego dziecka" }, 403);
      }

      const insertPayload: Record<string, unknown> = {
        started_by: user.id,
        domain,
        level,
        language,
        mode: "ai_adaptive",
        status: "in_progress",
        total_items: 0,
        correct_items: 0,
      };
      if (childId) insertPayload.child_id = childId;
      else insertPayload.user_id = user.id;

      const { data: attempt, error: aErr } = await admin
        .from("diagnostic_attempts")
        .insert(insertPayload)
        .select("id")
        .single();
      if (aErr) throw aErr;

      // Generate first question
      const q = await generateQuestion(domain, level, language, [], 2);
      const { data: item, error: iErr } = await admin
        .from("diagnostic_items")
        .insert({
          attempt_id: attempt.id,
          domain,
          level,
          kc_label: q.kc_label,
          code: `ai_${attempt.id.slice(0, 8)}_1`,
          language,
          question: q.question,
          choices: q.choices,
          correct_choice: q.correct_choice,
          explanation: q.explanation,
          difficulty_level: q.difficulty_level,
          is_active: false,
          approved_by_admin: false,
          generated_by: "ai_adaptive",
        })
        .select("id, question, choices, kc_label, difficulty_level")
        .single();
      if (iErr) throw iErr;

      return json({
        attempt_id: attempt.id,
        target_questions: target,
        question_index: 1,
        item: {
          id: item.id,
          question: item.question,
          choices: item.choices,
          kc_label: item.kc_label,
          difficulty: item.difficulty_level,
        },
      });
    }

    if (action === "next") {
      const attemptId = String(body.attempt_id ?? "");
      const itemId = String(body.item_id ?? "");
      const selected = body.selected_choice ?? null; // can be null = "I don't know"
      const targetTotal = Math.max(8, Math.min(20, Number(body.target_questions ?? DEFAULT_TARGET)));
      if (!attemptId || !itemId) return json({ error: "Bad params" }, 400);

      // Load attempt + item via user client to enforce RLS
      const { data: attempt, error: aErr } = await userClient
        .from("diagnostic_attempts")
        .select("id, domain, level, language, status, total_items, correct_items, child_id, user_id")
        .eq("id", attemptId)
        .maybeSingle();
      if (aErr || !attempt) return json({ error: "Attempt not found or no access" }, 404);
      if (attempt.status !== "in_progress") return json({ error: "Attempt not in progress" }, 400);

      const { data: item, error: itErr } = await userClient
        .from("diagnostic_items")
        .select("id, attempt_id, correct_choice, kc_label, difficulty_level")
        .eq("id", itemId)
        .maybeSingle();
      if (itErr || !item || item.attempt_id !== attemptId) return json({ error: "Item not found" }, 404);

      const isCorrect = selected !== null && selected === item.correct_choice;

      // Save response (admin to bypass RLS for service-side bookkeeping)
      await admin.from("diagnostic_responses").insert({
        attempt_id: attemptId,
        item_id: itemId,
        selected_choice: selected,
        is_correct: isCorrect,
        time_ms: typeof body.time_ms === "number" ? body.time_ms : null,
      });

      const newTotal = (attempt.total_items ?? 0) + 1;
      const newCorrect = (attempt.correct_items ?? 0) + (isCorrect ? 1 : 0);

      // Build asked history
      const { data: rawAsked } = await admin
        .from("diagnostic_items")
        .select("id, kc_label, difficulty_level, correct_choice, created_at")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true });
      const { data: rawResp } = await admin
        .from("diagnostic_responses")
        .select("item_id, selected_choice, is_correct")
        .eq("attempt_id", attemptId);
      const respMap = new Map((rawResp ?? []).map((r: any) => [r.item_id, r]));
      const asked: AskedItem[] = (rawAsked ?? []).map((it: any) => {
        const r: any = respMap.get(it.id);
        return {
          id: it.id,
          kc_label: it.kc_label ?? "ogólne",
          difficulty: it.difficulty_level ?? 1,
          question: "",
          correct_choice: it.correct_choice,
          selected_choice: r?.selected_choice ?? null,
          is_correct: r ? !!r.is_correct : null,
        };
      });

      // Decide: finish or next question
      if (newTotal >= targetTotal) {
        const summary = await generateSummary(attempt.domain ?? "", attempt.level ?? "", attempt.language ?? "pl", asked);
        const score = newTotal ? newCorrect / newTotal : 0;
        await admin
          .from("diagnostic_attempts")
          .update({
            total_items: newTotal,
            correct_items: newCorrect,
            score,
            status: "completed",
            completed_at: new Date().toISOString(),
            summary,
          })
          .eq("id", attemptId);

        // If parent->child, also seed child_kc_mastery from kc_breakdown
        if (attempt.child_id && Array.isArray(summary?.kc_breakdown)) {
          for (const kb of summary.kc_breakdown) {
            try {
              await admin.from("child_kc_mastery").insert({
                child_id: attempt.child_id,
                kc_id: crypto.randomUUID(), // synthetic kc id (no real KC entry)
                mastery_prob: Math.max(0, Math.min(1, (kb.mastery_pct ?? 0) / 100)),
                confidence: 0.6,
                source: "diagnostic_ai_adaptive",
                evidence: { attempt_id: attemptId, kc_label: kb.kc_label, status: kb.status },
              });
            } catch (_) { /* swallow */ }
          }
        }

        return json({ done: true, summary, score_pct: Math.round(score * 100), total: newTotal, correct: newCorrect });
      }

      // Update running totals
      await admin
        .from("diagnostic_attempts")
        .update({ total_items: newTotal, correct_items: newCorrect })
        .eq("id", attemptId);

      const targetDiff = nextDifficulty(asked);
      const q = await generateQuestion(attempt.domain ?? "", attempt.level ?? "", attempt.language ?? "pl", asked, targetDiff);
      const { data: nextItem, error: niErr } = await admin
        .from("diagnostic_items")
        .insert({
          attempt_id: attemptId,
          domain: attempt.domain,
          level: attempt.level,
          kc_label: q.kc_label,
          code: `ai_${attemptId.slice(0, 8)}_${newTotal + 1}`,
          language: attempt.language ?? "pl",
          question: q.question,
          choices: q.choices,
          correct_choice: q.correct_choice,
          explanation: q.explanation,
          difficulty_level: q.difficulty_level,
          is_active: false,
          approved_by_admin: false,
          generated_by: "ai_adaptive",
        })
        .select("id, question, choices, kc_label, difficulty_level")
        .single();
      if (niErr) throw niErr;

      return json({
        done: false,
        question_index: newTotal + 1,
        target_questions: targetTotal,
        last: { is_correct: isCorrect, correct_choice: item.correct_choice },
        item: {
          id: nextItem.id,
          question: nextItem.question,
          choices: nextItem.choices,
          kc_label: nextItem.kc_label,
          difficulty: nextItem.difficulty_level,
        },
      });
    }

    if (action === "finish") {
      const attemptId = String(body.attempt_id ?? "");
      const { data: attempt } = await userClient
        .from("diagnostic_attempts")
        .select("id, domain, level, language, status, summary, total_items, correct_items, score")
        .eq("id", attemptId)
        .maybeSingle();
      if (!attempt) return json({ error: "not found" }, 404);
      return json({ summary: attempt.summary, total: attempt.total_items, correct: attempt.correct_items, score_pct: Math.round((attempt.score ?? 0) * 100) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error("diagnostic-adaptive error:", msg);
    if (msg === "RATE_LIMIT") return json({ error: "Za dużo zapytań — spróbuj za chwilę." }, 429);
    if (msg === "PAYMENT_REQUIRED") return json({ error: "Brak kredytów AI w workspace." }, 402);
    return json({ error: msg }, 500);
  }
});
