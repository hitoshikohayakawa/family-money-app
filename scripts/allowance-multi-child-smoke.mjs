import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error("Missing Supabase env vars for allowance multi-child smoke test.");
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const randomSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const guardianEmail = `allowance-multi-guardian-${randomSuffix}@example.test`;
const childOneEmail = `allowance-multi-child-one-${randomSuffix}@example.test`;
const childTwoEmail = `allowance-multi-child-two-${randomSuffix}@example.test`;
const password = `Test-pass-${randomSuffix}`;
const familyName = `allowance-multi-child-smoke-${randomSuffix}`;

let guardianUserId = null;
let childOneUserId = null;
let childTwoUserId = null;
let familyId = null;

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

async function upsertProfile(userId, email, displayName) {
  const { error } = await serviceClient.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to upsert profile for ${email}: ${error.message}`);
  }
}

async function addChildMembership(userId) {
  const { error } = await serviceClient.from("family_members").insert({
    family_id: familyId,
    user_id: userId,
    role: "child",
  });

  if (error) {
    throw new Error(`Failed to add child membership ${userId}: ${error.message}`);
  }
}

async function createAllowanceGrant(guardianClient, childUserId, amountJpy, note) {
  const { data, error } = await guardianClient.rpc("create_allowance_grant", {
    target_child_user_id: childUserId,
    grant_amount_jpy: amountJpy,
    grant_note: note,
    grant_granted_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`create_allowance_grant failed for ${childUserId}: ${error.message}`);
  }

  const grant = Array.isArray(data) ? data[0] : null;
  assert(grant?.id, `Allowance creation returned no id for ${childUserId}`);
  assert(grant.child_user_id === childUserId, "Allowance grant was assigned to the wrong child");
  assert(grant.decision_status === "pending", `Expected pending, got ${grant.decision_status}`);

  return grant;
}

async function cleanup() {
  if (familyId) {
    await serviceClient.from("families").delete().eq("id", familyId);
  }

  for (const userId of [guardianUserId, childOneUserId, childTwoUserId]) {
    if (userId) {
      await serviceClient.auth.admin.deleteUser(userId);
    }
  }
}

try {
  console.log("Creating multi-child allowance smoke-test users...");
  guardianUserId = await createUser(guardianEmail);
  childOneUserId = await createUser(childOneEmail);
  childTwoUserId = await createUser(childTwoEmail);

  await upsertProfile(guardianUserId, guardianEmail, "multi guardian");
  await upsertProfile(childOneUserId, childOneEmail, "child one");
  await upsertProfile(childTwoUserId, childTwoEmail, "child two");

  const guardianClient = await signIn(guardianEmail);
  const childOneClient = await signIn(childOneEmail);
  const childTwoClient = await signIn(childTwoEmail);

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

  console.log("Adding two child memberships...");
  await addChildMembership(childOneUserId);
  await addChildMembership(childTwoUserId);

  console.log("Creating allowance grants for both children...");
  const childOneGrant = await createAllowanceGrant(
    guardianClient,
    childOneUserId,
    1000,
    "first child allowance"
  );
  const childTwoGrant = await createAllowanceGrant(
    guardianClient,
    childTwoUserId,
    2000,
    "second child allowance"
  );

  console.log("Verifying guardian sees both children and both grants...");
  const { data: guardianMembers, error: membersError } = await guardianClient.rpc(
    "list_family_members_for_current_user"
  );

  if (membersError) {
    throw new Error(`list_family_members_for_current_user failed: ${membersError.message}`);
  }

  const childMembers = Array.isArray(guardianMembers)
    ? guardianMembers.filter((member) => member.role === "child")
    : [];
  assert(childMembers.length === 2, `Expected 2 child members, got ${childMembers.length}`);
  assert(
    childMembers.some((member) => member.user_id === childOneUserId) &&
      childMembers.some((member) => member.user_id === childTwoUserId),
    "Guardian member list is missing one of the children"
  );

  const { data: guardianGrants, error: guardianGrantsError } = await guardianClient.rpc(
    "list_allowance_grants_for_current_user"
  );

  if (guardianGrantsError) {
    throw new Error(`Guardian allowance list failed: ${guardianGrantsError.message}`);
  }

  assert(
    guardianGrants.some((grant) => grant.id === childOneGrant.id),
    "Guardian list is missing first child allowance"
  );
  assert(
    guardianGrants.some((grant) => grant.id === childTwoGrant.id),
    "Guardian list is missing second child allowance"
  );

  console.log("Verifying each child sees only their own allowance...");
  const { data: childOneGrants, error: childOneListError } = await childOneClient.rpc(
    "list_allowance_grants_for_current_user"
  );

  if (childOneListError) {
    throw new Error(`First child allowance list failed: ${childOneListError.message}`);
  }

  const { data: childTwoGrants, error: childTwoListError } = await childTwoClient.rpc(
    "list_allowance_grants_for_current_user"
  );

  if (childTwoListError) {
    throw new Error(`Second child allowance list failed: ${childTwoListError.message}`);
  }

  assert(
    childOneGrants.some((grant) => grant.id === childOneGrant.id),
    "First child cannot see their own allowance"
  );
  assert(
    !childOneGrants.some((grant) => grant.id === childTwoGrant.id),
    "First child can see second child's allowance"
  );
  assert(
    childTwoGrants.some((grant) => grant.id === childTwoGrant.id),
    "Second child cannot see their own allowance"
  );
  assert(
    !childTwoGrants.some((grant) => grant.id === childOneGrant.id),
    "Second child can see first child's allowance"
  );

  console.log("Allowance multi-child smoke test passed.");
  process.exit(0);
} catch (error) {
  console.error("Allowance multi-child smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
