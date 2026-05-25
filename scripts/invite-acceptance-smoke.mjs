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
      "Missing Supabase env vars for smoke test.",
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
const guardianEmail = `guardian-${randomSuffix}@example.test`;
const invitedEmail = `invitee-${randomSuffix}@example.test`;
const password = `Test-pass-${randomSuffix}`;
const familyName = `smoke-${randomSuffix}`;

let guardianUserId = null;
let invitedUserId = null;
let familyId = null;
let inviteId = null;

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

async function ensureOwnProfile(client, userId, email) {
  const { error } = await client.from("profiles").upsert(
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

  if (invitedUserId) {
    await serviceClient.auth.admin.deleteUser(invitedUserId);
  }
}

try {
  console.log("Creating smoke-test users...");
  guardianUserId = await createUser(guardianEmail);
  invitedUserId = await createUser(invitedEmail);

  const guardianClient = await signIn(guardianEmail);
  const invitedClient = await signIn(invitedEmail);

  await ensureOwnProfile(guardianClient, guardianUserId, guardianEmail);
  await ensureOwnProfile(invitedClient, invitedUserId, invitedEmail);

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

  console.log("Creating invite...");
  const { data: inviteInsert, error: inviteError } = await guardianClient
    .from("family_invites")
    .insert({
      family_id: familyId,
      email: invitedEmail,
      role: "guardian",
      invited_by_user_id: guardianUserId,
    })
    .select("id")
    .single();

  if (inviteError) {
    throw new Error(`Failed to create invite: ${inviteError.message}`);
  }

  inviteId = inviteInsert.id;
  assert(inviteId, "Invite creation returned no id");

  console.log("Accepting invite as invited user...");
  const { data: acceptData, error: acceptError } = await invitedClient.rpc(
    "accept_family_invite",
    {
      invite_id: inviteId,
    }
  );

  if (acceptError) {
    throw new Error(`accept_family_invite failed: ${acceptError.message}`);
  }

  const acceptResult = Array.isArray(acceptData) ? acceptData[0] : null;
  assert(acceptResult?.status === "accepted", "Invite acceptance did not return accepted");

  console.log("Verifying family_invites row...");
  const { data: inviteRow, error: inviteFetchError } = await serviceClient
    .from("family_invites")
    .select("status, accepted_at")
    .eq("id", inviteId)
    .single();

  if (inviteFetchError) {
    throw new Error(`Failed to fetch invite row: ${inviteFetchError.message}`);
  }

  assert(inviteRow.status === "accepted", `Expected invite status accepted, got ${inviteRow.status}`);
  assert(inviteRow.accepted_at, "accepted_at is still null after acceptance");

  console.log("Verifying family_members row...");
  const { data: familyMemberRow, error: familyMemberFetchError } = await serviceClient
    .from("family_members")
    .select("family_id, user_id, role")
    .eq("family_id", familyId)
    .eq("user_id", invitedUserId)
    .single();

  if (familyMemberFetchError) {
    throw new Error(`Failed to fetch family_members row: ${familyMemberFetchError.message}`);
  }

  assert(familyMemberRow.role === "guardian", `Expected guardian role, got ${familyMemberRow.role}`);

  console.log("Smoke test passed.");
  process.exit(0);
} catch (error) {
  console.error("Invite acceptance smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
