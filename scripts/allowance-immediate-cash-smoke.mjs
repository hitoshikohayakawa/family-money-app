import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  const missingVars = [];

  if (!supabaseUrl) {
    missingVars.push("TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    missingVars.push("TEST_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!supabaseServiceRoleKey) {
    missingVars.push("TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  console.error(
    [
      "Missing Supabase env vars for allowance smoke test.",
      "Missing:",
      ...missingVars.map((name) => `- ${name}`),
    ].join("\n")
  );
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const guardianEmail = `allowance-guardian-${randomSuffix}@example.test`;
const childEmail = `allowance-child-${randomSuffix}@example.test`;
const password = `Test-pass-${randomSuffix}`;
const familyName = `allowance-smoke-${randomSuffix}`;

let guardianUserId = null;
let childUserId = null;
let familyId = null;
let allowanceGrantId = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createUser(email) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user ${email}: ${error.message}`);
  }

  assert(data.user?.id, `User id missing for ${email}`);
  return data.user.id;
}

async function signIn(email) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in ${email}: ${error.message}`);
  }

  return client;
}

async function upsertProfile(userId, email) {
  const { error } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: email.split("@")[0],
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw new Error(`Failed to upsert profile for ${email}: ${error.message}`);
  }
}

async function cleanup() {
  if (familyId) {
    await serviceClient.from("families").delete().eq("id", familyId);
  }

  if (guardianUserId) {
    await serviceClient.auth.admin.deleteUser(guardianUserId);
  }

  if (childUserId) {
    await serviceClient.auth.admin.deleteUser(childUserId);
  }
}

try {
  console.log("Creating allowance smoke-test users...");
  guardianUserId = await createUser(guardianEmail);
  childUserId = await createUser(childEmail);

  await upsertProfile(guardianUserId, guardianEmail);
  await upsertProfile(childUserId, childEmail);

  const guardianClient = await signIn(guardianEmail);
  const childClient = await signIn(childEmail);

  console.log("Creating family as guardian...");
  const { data: familyData, error: familyError } = await guardianClient.rpc(
    "create_family_with_owner_membership",
    {
      input_family_name: familyName,
    }
  );

  if (familyError) {
    throw new Error(`Failed to create family: ${familyError.message}`);
  }

  const createdFamily = Array.isArray(familyData) ? familyData[0] : null;
  assert(createdFamily?.family_id, "Family creation returned no family_id");
  familyId = createdFamily.family_id;

  const { data: guardianMemberships, error: guardianMembershipError } =
    await serviceClient
      .from("family_members")
      .select("family_id,user_id,role")
      .eq("user_id", guardianUserId);

  if (guardianMembershipError) {
    throw new Error(
      `Failed to fetch guardian membership after family creation: ${guardianMembershipError.message}`
    );
  }

  assert(
    guardianMemberships?.some((membership) => membership.role === "guardian_admin"),
    "Guardian membership was not created as guardian_admin"
  );

  console.log("Adding child membership...");
  const { error: childMembershipError } = await serviceClient
    .from("family_members")
    .insert({
      family_id: familyId,
      user_id: childUserId,
      role: "child",
    });

  if (childMembershipError) {
    throw new Error(`Failed to add child membership: ${childMembershipError.message}`);
  }

  console.log("Creating allowance grant...");
  const { data: allowanceData, error: allowanceError } = await guardianClient.rpc(
    "create_allowance_grant",
    {
      target_child_user_id: childUserId,
      grant_amount_jpy: 1000,
      grant_note: "smoke test allowance",
      grant_granted_at: new Date().toISOString(),
    }
  );

  if (allowanceError) {
    throw new Error(`create_allowance_grant failed: ${allowanceError.message}`);
  }

  const allowanceGrant = Array.isArray(allowanceData) ? allowanceData[0] : null;
  assert(allowanceGrant?.id, "Allowance creation returned no id");
  assert(
    allowanceGrant.decision_status === "pending",
    `Expected pending decision, got ${allowanceGrant.decision_status}`
  );
  allowanceGrantId = allowanceGrant.id;

  console.log("Requesting immediate cash as child...");
  const { data: decisionData, error: decisionError } = await childClient.rpc(
    "request_immediate_cash_for_allowance",
    {
      target_allowance_grant_id: allowanceGrantId,
    }
  );

  if (decisionError) {
    throw new Error(`request_immediate_cash_for_allowance failed: ${decisionError.message}`);
  }

  const decisionResult = Array.isArray(decisionData) ? decisionData[0] : null;
  assert(
    decisionResult?.decision_status === "immediate_cash_requested",
    `Expected immediate_cash_requested, got ${decisionResult?.decision_status}`
  );

  console.log("Verifying grant_decisions row...");
  const { data: decisionRow, error: decisionFetchError } = await serviceClient
    .from("grant_decisions")
    .select("decision_status, decided_at")
    .eq("allowance_grant_id", allowanceGrantId)
    .single();

  if (decisionFetchError) {
    throw new Error(`Failed to fetch grant_decisions row: ${decisionFetchError.message}`);
  }

  assert(
    decisionRow.decision_status === "immediate_cash_requested",
    `Expected immediate_cash_requested row, got ${decisionRow.decision_status}`
  );
  assert(decisionRow.decided_at, "decided_at is null after immediate cash request");

  console.log("Allowance immediate cash smoke test passed.");
  process.exit(0);
} catch (error) {
  console.error("Allowance immediate cash smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
