// Admin-only cleanup of test data created by admin-seed-test-users.
// Identifies test data by @test.kogni.local email domain.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_EMAIL_DOMAIN = "@test.kogni.local";
const SEED_BATCH = "kogni_test_seed_v1";
const TEST_PREFIX = "[TEST]";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
    const { data: isAdminRow } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "forbidden_admin_only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE_TEST_DATA") {
      return new Response(JSON.stringify({ error: "confirmation_required", hint: 'pass {"confirm":"DELETE_TEST_DATA"}' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const summary: Record<string, number | string> = {};

    // Collect test user IDs by email domain
    const testUserIds: string[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) {
        if ((u.email || "").toLowerCase().endsWith(TEST_EMAIL_DOMAIN)) testUserIds.push(u.id);
      }
      if (data.users.length < 200) break;
    }
    summary.testUsersFound = testUserIds.length;

    // Test orgs by [TEST] name prefix or seed slug
    const { data: testOrgs } = await admin.from("organizations").select("id").or(`name.ilike.${TEST_PREFIX}%,slug.ilike.%${SEED_BATCH}%`);
    const orgIds = (testOrgs ?? []).map((o: any) => o.id);
    summary.testOrgsFound = orgIds.length;

    // Helper for safe deletes (table may not have rows / column types vary)
    const safeDelete = async (label: string, q: any) => {
      try { const { error, count } = await q; if (error) summary[`${label}_err`] = error.message; else summary[label] = count ?? "ok"; }
      catch (e: any) { summary[`${label}_err`] = e?.message ?? String(e); }
    };

    if (testUserIds.length) {
      // SMART events tied to test users or test seed
      await safeDelete("smart_evidence_events_users", admin.from("smart_evidence_events").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("smart_evidence_events_created_by", admin.from("smart_evidence_events").delete({ count: "exact" }).in("created_by", testUserIds));
      await safeDelete("smart_evidence_events_seed", admin.from("smart_evidence_events").delete({ count: "exact" }).contains("input_summary", { seed_batch: SEED_BATCH }));

      await safeDelete("notifications", admin.from("notifications").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("user_feedback", admin.from("user_feedback").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("flashcards_user", admin.from("flashcards").delete({ count: "exact" }).in("user_id", testUserIds));

      // Bookings (and cascades will clean payment_records, sessions, lesson_*)
      await safeDelete("bookings_student", admin.from("bookings").delete({ count: "exact" }).in("student_id", testUserIds));
      await safeDelete("bookings_tutor", admin.from("bookings").delete({ count: "exact" }).in("tutor_id", testUserIds));

      await safeDelete("expert_reviews_user", admin.from("expert_reviews").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("expert_reviews_reviewer", admin.from("expert_reviews").delete({ count: "exact" }).in("reviewer_id", testUserIds));

      await safeDelete("learning_checkpoints", admin.from("learning_checkpoints").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("learning_plans", admin.from("learning_plans").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("user_competency_mastery", admin.from("user_competency_mastery").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("diagnostic_attempts_user", admin.from("diagnostic_attempts").delete({ count: "exact" }).in("started_by", testUserIds));

      // parent_children with [TEST] prefix
      await safeDelete("parent_children", admin.from("parent_children").delete({ count: "exact" }).in("parent_id", testUserIds));

      // tutor profile + competencies + availability
      await safeDelete("tutor_competencies", admin.from("tutor_competencies").delete({ count: "exact" }).in("tutor_id", testUserIds));
      await safeDelete("tutor_availability_slots", admin.from("tutor_availability_slots").delete({ count: "exact" }).in("tutor_id", testUserIds));
      await safeDelete("tutor_profiles", admin.from("tutor_profiles").delete({ count: "exact" }).in("user_id", testUserIds));
    }

    // Org-related cleanup
    if (orgIds.length) {
      await safeDelete("cohort_members", admin.from("cohort_members").delete({ count: "exact" }).in("cohort_id",
        ((await admin.from("cohorts").select("id").in("organization_id", orgIds)).data ?? []).map((c: any) => c.id)));
      await safeDelete("cohorts", admin.from("cohorts").delete({ count: "exact" }).in("organization_id", orgIds));
      await safeDelete("organization_invites", admin.from("organization_invites").delete({ count: "exact" }).in("organization_id", orgIds));
      await safeDelete("organization_members", admin.from("organization_members").delete({ count: "exact" }).in("organization_id", orgIds));
      await safeDelete("organizations", admin.from("organizations").delete({ count: "exact" }).in("id", orgIds));
    }

    if (testUserIds.length) {
      await safeDelete("user_roles", admin.from("user_roles").delete({ count: "exact" }).in("user_id", testUserIds));
      await safeDelete("profiles", admin.from("profiles").delete({ count: "exact" }).in("id", testUserIds));

      // Auth users last
      let authDeleted = 0; let authErrors = 0;
      for (const uid of testUserIds) {
        const { error } = await admin.auth.admin.deleteUser(uid);
        if (error) authErrors++; else authDeleted++;
      }
      summary.auth_users_deleted = authDeleted;
      if (authErrors) summary.auth_users_errors = authErrors;
    }

    return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
