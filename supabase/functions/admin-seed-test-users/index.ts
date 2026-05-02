// Admin-only test users & scenario seeder for Kogni.
// Creates [TEST] users under @test.kogni.local and optional scenario data.
// Uses service-role client server-side. Never exposes service role to client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_EMAIL_DOMAIN = "@test.kogni.local";
const SEED_BATCH = "kogni_test_seed_v1";
const DEFAULT_PASSWORD = "KogniTest!2026";
const TEST_PREFIX = "[TEST]";

type Mode = "users_only" | "full_scenarios";

type Spec = {
  key: string;
  email: string;
  displayName: string;
  roles: string[]; // app_role values
  scenario: string;
  tutorVerification?: "pending" | "approved" | "rejected" | "suspended";
  isPublishedTutor?: boolean;
};

const USER_SPECS: Spec[] = [
  { key: "admin", email: `admin.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Admin`, roles: ["admin"], scenario: "platform_admin" },
  { key: "student", email: `student.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Self Student`, roles: ["student"], scenario: "self_student" },
  { key: "parent", email: `parent.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Parent`, roles: ["parent"], scenario: "parent_child" },
  { key: "tutor_approved", email: `tutor.approved.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Tutor Approved`, roles: ["tutor"], scenario: "tutor_marketplace", tutorVerification: "approved", isPublishedTutor: true },
  { key: "tutor_pending", email: `tutor.pending.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Tutor Pending`, roles: ["student"], scenario: "tutor_pending_block", tutorVerification: "pending" },
  { key: "tutor_rejected", email: `tutor.rejected.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Tutor Rejected`, roles: ["student"], scenario: "tutor_rejected_block", tutorVerification: "rejected" },
  { key: "tutor_suspended", email: `tutor.suspended.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Tutor Suspended`, roles: ["tutor"], scenario: "tutor_suspended_block", tutorVerification: "suspended" },
  { key: "expert", email: `expert.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Expert Reviewer`, roles: ["admin"], scenario: "expert_review" },
  { key: "org_owner", email: `org.owner.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Org Owner`, roles: ["school"], scenario: "org_owner" },
  { key: "org_coordinator", email: `org.coordinator.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Org Coordinator`, roles: ["school"], scenario: "org_coordinator" },
  { key: "org_student", email: `org.student.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Org Student`, roles: ["student"], scenario: "org_student" },
  { key: "org_parent", email: `org.parent.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Org Parent`, roles: ["parent"], scenario: "org_parent" },
  { key: "org_tutor", email: `org.tutor.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Org Tutor`, roles: ["tutor"], scenario: "org_tutor", tutorVerification: "approved", isPublishedTutor: true },
  { key: "student_empty", email: `student.empty.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Student Empty`, roles: ["student"], scenario: "no_progress" },
  { key: "student_diagonly", email: `student.diagonly.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Student Diag Only`, roles: ["student"], scenario: "diag_only" },
  { key: "student_planonly", email: `student.planonly.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Student Plan Draft`, roles: ["student"], scenario: "plan_not_active" },
  { key: "student_checkpointready", email: `student.checkpointready.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Student Checkpoint Ready`, roles: ["student"], scenario: "checkpoint_ready" },
  { key: "student_lowfeedback", email: `student.lowfeedback.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Student Low Feedback`, roles: ["student"], scenario: "low_feedback" },
  { key: "unauthorized", email: `unauthorized.test${TEST_EMAIL_DOMAIN}`, displayName: `${TEST_PREFIX} Unauthorized`, roles: ["student"], scenario: "unauthorized_probe" },
];

function isProductionEnv(): boolean {
  const env = (Deno.env.get("DENO_ENV") || Deno.env.get("ENVIRONMENT") || "").toLowerCase();
  return env === "production" || env === "prod";
}
function seedingAllowed(): boolean {
  if (Deno.env.get("ALLOW_TEST_SEEDING") === "true") return true;
  return !isProductionEnv();
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  // Paginate auth.admin.listUsers — sufficient for small test datasets.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(admin: ReturnType<typeof createClient>, spec: Spec): Promise<{ userId: string; created: boolean }>{
  let userId = await findUserByEmail(admin, spec.email);
  let created = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: spec.displayName,
        is_test: true,
        seed_batch: SEED_BATCH,
        scenario: spec.scenario,
      },
    });
    if (error) throw new Error(`createUser ${spec.email}: ${error.message}`);
    userId = data.user!.id;
    created = true;
  }
  // upsert profile (the on-signup trigger may have created it; ensure marker prefix)
  await admin.from("profiles").upsert({
    id: userId,
    full_name: spec.displayName,
    display_name: spec.displayName,
  }, { onConflict: "id" });
  // ensure roles
  for (const role of spec.roles) {
    await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  }
  // tutor profile if needed
  if (spec.tutorVerification) {
    await admin.from("tutor_profiles").upsert({
      user_id: userId,
      display_name: spec.displayName,
      headline: `${TEST_PREFIX} Tutor headline`,
      bio: `${TEST_PREFIX} Auto-generated tutor for QA.`,
      hourly_rate_cents: 12000,
      currency: "PLN",
      languages: ["pl", "en"],
      teaching_domains: ["math"],
      education_levels: ["primary"],
      is_verified: spec.tutorVerification === "approved",
      is_published: !!spec.isPublishedTutor,
      verification_status: spec.tutorVerification,
    }, { onConflict: "user_id" });
  }
  return { userId, created };
}

async function seedFullScenarios(admin: ReturnType<typeof createClient>, ids: Record<string, string>) {
  const notes: string[] = [];

  // Parent + child
  const parentId = ids.parent;
  let childId: string | null = null;
  if (parentId) {
    const { data: existingChild } = await admin
      .from("parent_children").select("id").eq("parent_id", parentId).ilike("display_name", `${TEST_PREFIX}%`).maybeSingle();
    if (existingChild?.id) childId = existingChild.id;
    else {
      const { data, error } = await admin.from("parent_children").insert({
        parent_id: parentId,
        display_name: `${TEST_PREFIX} Child Learner`,
        grade_level: "5",
        relation: "parent",
        status: "active",
      }).select("id").single();
      if (!error) { childId = data.id; notes.push("parent_children created"); }
      else notes.push(`parent_children skip: ${error.message}`);
    }
  }

  // Learning plan for self student (active with items)
  const studentId = ids.student;
  if (studentId) {
    const { data: plan, error: planErr } = await admin.from("learning_plans").insert({
      owner_type: "user",
      user_id: studentId,
      title: `${TEST_PREFIX} Math foundations plan`,
      description: "Auto-seeded test plan.",
      status: "active",
      created_by: studentId,
    }).select("id").single();
    if (!planErr && plan) {
      // best-effort items insert (schema unknown — ignore failures)
      try {
        const items = Array.from({ length: 8 }, (_, i) => ({
          plan_id: plan.id,
          title: `${TEST_PREFIX} Item ${i + 1}`,
          status: i < 3 ? "done" : "pending",
          position: i,
        }));
        await admin.from("learning_plan_items").insert(items);
      } catch (_) { /* schema may differ */ }
      notes.push("learning_plan created");
    } else if (planErr) notes.push(`learning_plan skip: ${planErr.message}`);

    // notification
    await admin.from("notifications").insert({
      user_id: studentId,
      type: "test_seed",
      title: `${TEST_PREFIX} Welcome to QA test account`,
      body: "This account was created by the test seeder.",
      severity: "info",
      metadata: { test_data: true, seed_batch: SEED_BATCH },
    });

    // SMART events
    await admin.from("smart_evidence_events").insert([
      { event_type: "diagnostic_completed", user_id: studentId, owner_type: "user", input_summary: { test_data: true, seed_batch: SEED_BATCH } },
      { event_type: "learning_plan_generated", user_id: studentId, owner_type: "user", input_summary: { test_data: true, seed_batch: SEED_BATCH } },
      { event_type: "learning_plan_activated", user_id: studentId, owner_type: "user", input_summary: { test_data: true, seed_batch: SEED_BATCH } },
      { event_type: "learning_plan_item_completed", user_id: studentId, owner_type: "user", input_summary: { test_data: true, seed_batch: SEED_BATCH } },
    ]);
  }

  // Approved tutor + booking with self student
  const tutorId = ids.tutor_approved;
  if (tutorId && studentId) {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const { data: booking, error: bErr } = await admin.from("bookings").insert({
      student_id: studentId,
      tutor_id: tutorId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "confirmed",
      price_cents: 12000,
      currency: "PLN",
      notes: `${TEST_PREFIX} Auto-seed booking`,
      created_by: studentId,
    }).select("id").single();
    if (!bErr && booking) {
      await admin.from("payment_records").insert([
        { booking_id: booking.id, payer_user_id: studentId, tutor_user_id: tutorId, amount: 120, currency: "PLN", method: "blik", status: "pending" },
      ]);
      notes.push("booking + payment_record created");
    } else if (bErr) notes.push(`booking skip: ${bErr.message}`);
  }

  // Organization
  const ownerId = ids.org_owner;
  if (ownerId) {
    const slug = `test-kogni-demo-school-${SEED_BATCH}`;
    const { data: existing } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
    let orgId = existing?.id ?? null;
    if (!orgId) {
      const { data, error } = await admin.from("organizations").insert({
        name: `${TEST_PREFIX} Kogni Demo School`,
        org_type: "school",
        slug,
        owner_id: ownerId,
        status: "active",
        created_by: ownerId,
      }).select("id").single();
      if (!error && data) { orgId = data.id; notes.push("organization created"); }
      else if (error) notes.push(`organization skip: ${error.message}`);
    }
    if (orgId) {
      const memberPairs: Array<{ uid: string; role: string }> = [
        { uid: ownerId, role: "owner" },
        ...(ids.org_coordinator ? [{ uid: ids.org_coordinator, role: "admin" }] : []),
        ...(ids.org_student ? [{ uid: ids.org_student, role: "student" }] : []),
        ...(ids.org_parent ? [{ uid: ids.org_parent, role: "student" }] : []),
        ...(ids.org_tutor ? [{ uid: ids.org_tutor, role: "teacher" }] : []),
      ];
      for (const m of memberPairs) {
        await admin.from("organization_members").upsert(
          { organization_id: orgId, user_id: m.uid, member_role: m.role, invited_by: ownerId },
          { onConflict: "organization_id,user_id" },
        );
      }
      // Cohort
      const { data: existingCohort } = await admin.from("cohorts").select("id").eq("organization_id", orgId).ilike("name", `${TEST_PREFIX}%`).maybeSingle();
      let cohortId = existingCohort?.id ?? null;
      if (!cohortId) {
        const { data, error } = await admin.from("cohorts").insert({
          organization_id: orgId,
          name: `${TEST_PREFIX} Matematyka Demo Cohort`,
          status: "active",
          created_by: ownerId,
        }).select("id").single();
        if (!error && data) { cohortId = data.id; notes.push("cohort created"); }
        else if (error) notes.push(`cohort skip: ${error.message}`);
      }
      if (cohortId) {
        if (ids.org_student) await admin.from("cohort_members").upsert({ cohort_id: cohortId, user_id: ids.org_student, role: "student", status: "active", added_by: ownerId }, { onConflict: "cohort_id,user_id" });
        if (ids.org_tutor) await admin.from("cohort_members").upsert({ cohort_id: cohortId, user_id: ids.org_tutor, role: "tutor", status: "active", added_by: ownerId }, { onConflict: "cohort_id,user_id" });
      }
      // SMART org events
      await admin.from("smart_evidence_events").insert([
        { event_type: "organization_created", created_by: ownerId, input_summary: { test_data: true, seed_batch: SEED_BATCH, organization_id: orgId } },
        { event_type: "cohort_created", created_by: ownerId, input_summary: { test_data: true, seed_batch: SEED_BATCH, organization_id: orgId } },
      ]);
    }
  }

  return notes;
}

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

    if (!seedingAllowed()) {
      return new Response(JSON.stringify({ error: "seeding_disabled_in_production", hint: "Set ALLOW_TEST_SEEDING=true to enable." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const mode: Mode = body?.mode === "full_scenarios" ? "full_scenarios" : "users_only";

    const accounts: Array<{ key: string; email: string; role: string; scenario: string; userId: string; created: boolean; password: string }> = [];
    const ids: Record<string, string> = {};
    const errors: string[] = [];

    for (const spec of USER_SPECS) {
      try {
        const { userId, created } = await ensureUser(admin, spec);
        ids[spec.key] = userId;
        accounts.push({
          key: spec.key, email: spec.email, role: spec.roles[0] ?? "student",
          scenario: spec.scenario, userId, created, password: DEFAULT_PASSWORD,
        });
      } catch (e: any) {
        errors.push(`${spec.email}: ${e?.message ?? String(e)}`);
      }
    }

    let scenarioNotes: string[] = [];
    if (mode === "full_scenarios") {
      try { scenarioNotes = await seedFullScenarios(admin, ids); }
      catch (e: any) { errors.push(`scenarios: ${e?.message ?? String(e)}`); }
    }

    return new Response(JSON.stringify({
      ok: true, mode, accounts, scenarioNotes, errors,
      defaultPassword: DEFAULT_PASSWORD, seedBatch: SEED_BATCH,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
