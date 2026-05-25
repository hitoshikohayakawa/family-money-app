import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error("Missing Supabase env vars for allowance cashout smoke test.");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const guardianEmail = `allowance-cashout-guardian-${randomSuffix}@example.test`;
const childEmail = `allowance-cashout-child-${randomSuffix}@example.test`;
const password = `Test-pass-${randomSuffix}`;
const familyName = `allowance-cashout-smoke-${randomSuffix}`;

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

  const { error } = await client.auth.signInWithPassword({ email, password });

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
    { onConflict: "id" }
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
  console.log("Creating allowance cashout smoke-test users...");
  guardianUserId = await createUser(guardianEmail);
  childUserId = await createUser(childEmail);

  await upsertProfile(guardianUserId, guardianEmail);
  await upsertProfile(childUserId, childEmail);

  const guardianClient = await signIn(guardianEmail);
  const childClient = await signIn(childEmail);

  console.log("Creating family as guardian...");
  const { data: familyData, error: familyError } = await guardianClient.rpc(
    "create_family_with_owner_membership",
    { input_family_name: familyName }
  );

  if (familyError) {
    throw new Error(`Failed to create family: ${familyError.message}`);
  }

  const createdFamily = Array.isArray(familyData) ? familyData[0] : null;
  assert(createdFamily?.family_id, "Family creation returned no family_id");
  familyId = createdFamily.family_id;

  console.log("Adding child membership...");
  const { error: childMembershipError } = await serviceClient.from("family_members").insert({
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
      grant_note: "smoke test cashout allowance",
      grant_granted_at: new Date().toISOString(),
    }
  );

  if (allowanceError) {
    throw new Error(`create_allowance_grant failed: ${allowanceError.message}`);
  }

  const allowanceGrant = Array.isArray(allowanceData) ? allowanceData[0] : null;
  assert(allowanceGrant?.id, "Allowance creation returned no id");
  allowanceGrantId = allowanceGrant.id;

  console.log("Choosing investment as child...");
  const { data: assetOptions, error: assetOptionsError } = await childClient.rpc(
    "list_investment_assets_for_current_user"
  );

  if (assetOptionsError) {
    throw new Error(
      `list_investment_assets_for_current_user failed: ${assetOptionsError.message}`
    );
  }

  const investmentAsset = Array.isArray(assetOptions) ? assetOptions[0] : null;
  assert(investmentAsset?.asset_id, "Investment asset option was missing");

  const { error: decisionError } = await childClient.rpc("request_investment_for_allowance", {
    target_allowance_grant_id: allowanceGrantId,
    target_asset_id: investmentAsset.asset_id,
  });

  if (decisionError) {
    throw new Error(`request_investment_for_allowance failed: ${decisionError.message}`);
  }

  console.log("Requesting cashout as child...");
  const { data: cashoutData, error: cashoutError } = await childClient.rpc(
    "request_cashout_for_allowances",
    { target_allowance_grant_ids: [allowanceGrantId] }
  );

  if (cashoutError) {
    throw new Error(`request_cashout_for_allowances failed: ${cashoutError.message}`);
  }

  const cashoutRequest = Array.isArray(cashoutData) ? cashoutData[0] : null;
  assert(cashoutRequest?.cashout_request_id, "Cashout request id is missing");
  assert(cashoutRequest.status === "requested", `Expected requested, got ${cashoutRequest.status}`);
  assert(cashoutRequest.requested_amount_jpy > 0, "Requested amount is missing");

  console.log("Verifying allowance list hides requested amount from active balance...");
  const { data: listedGrants, error: listError } = await childClient.rpc(
    "list_allowance_grants_for_current_user"
  );

  if (listError) {
    throw new Error(`list_allowance_grants_for_current_user failed: ${listError.message}`);
  }

  const listedGrant = Array.isArray(listedGrants)
    ? listedGrants.find((grant) => grant.id === allowanceGrantId)
    : null;
  assert(listedGrant?.cashout_request_id, "Listed grant is missing cashout request id");
  assert(listedGrant.cashout_status === "requested", `Expected requested in list, got ${listedGrant.cashout_status}`);

  console.log("Verifying guardian can see the cashout request...");
  const { data: guardianListedGrants, error: guardianListError } = await guardianClient.rpc(
    "list_allowance_grants_for_current_user"
  );

  if (guardianListError) {
    throw new Error(
      `guardian list_allowance_grants_for_current_user failed: ${guardianListError.message}`
    );
  }

  const guardianListedGrant = Array.isArray(guardianListedGrants)
    ? guardianListedGrants.find((grant) => grant.id === allowanceGrantId)
    : null;
  assert(guardianListedGrant?.cashout_request_id, "Guardian list is missing cashout request id");
  assert(
    guardianListedGrant.cashout_status === "requested",
    `Expected requested in guardian list, got ${guardianListedGrant.cashout_status}`
  );

  console.log("Marking cashout paid as guardian...");
  const { data: paidData, error: paidError } = await guardianClient.rpc(
    "mark_allowance_cashout_paid",
    { target_cashout_request_id: cashoutRequest.cashout_request_id }
  );

  if (paidError) {
    throw new Error(`mark_allowance_cashout_paid failed: ${paidError.message}`);
  }

  const paidRequest = Array.isArray(paidData) ? paidData[0] : null;
  assert(paidRequest?.status === "paid", `Expected paid, got ${paidRequest?.status}`);
  assert(paidRequest.paid_at, "paid_at is missing");

  console.log("Allowance cashout smoke test passed.");
  process.exit(0);
} catch (error) {
  console.error("Allowance cashout smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
