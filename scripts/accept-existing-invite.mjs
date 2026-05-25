import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

function normalizeCliValue(value) {
  if (!value) {
    return value;
  }

  return value
    .trim()
    .replace(/^['"`‘’“”]+/, "")
    .replace(/[ '"`‘’“”]+$/g, "");
}

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const inviteId = normalizeCliValue(process.env.INVITE_ID);
const email = normalizeCliValue(process.env.INVITED_USER_EMAIL)?.toLowerCase();
const password = process.env.INVITED_USER_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set TEST_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and TEST_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
  process.exit(1);
}

if (!inviteId || !email || !password) {
  console.error(
    [
      "Missing required vars.",
      "Required:",
      "- INVITE_ID",
      "- INVITED_USER_EMAIL",
      "- INVITED_USER_PASSWORD",
    ].join("\n")
  );
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  console.log(`Signing in as ${email}...`);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`Sign-in failed: ${signInError.message}`);
  }

  console.log(`Fetching invite details for ${inviteId}...`);
  const { data: inviteDetailsData, error: inviteDetailsError } = await client.rpc(
    "get_family_invite_details",
    {
      target_invite_id: inviteId,
    }
  );

  if (inviteDetailsError) {
    throw new Error(`Failed to fetch invite details: ${inviteDetailsError.message}`);
  }

  const inviteDetails = Array.isArray(inviteDetailsData) ? inviteDetailsData[0] : null;
  assert(inviteDetails, "Invite details were empty");

  console.log("Invite details:");
  console.log(
    JSON.stringify(
      {
        email: inviteDetails.email,
        stored_status: inviteDetails.stored_status,
        effective_status: inviteDetails.effective_status,
        expires_at: inviteDetails.expires_at,
        membership_exists: inviteDetails.membership_exists,
      },
      null,
      2
    )
  );

  console.log("Accepting invite...");
  const { data: acceptData, error: acceptError } = await client.rpc(
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

  console.log("Re-fetching invite details...");
  const { data: refreshedInviteDetailsData, error: refreshedInviteDetailsError } =
    await client.rpc("get_family_invite_details", {
      target_invite_id: inviteId,
    });

  if (refreshedInviteDetailsError) {
    throw new Error(
      `Failed to re-fetch invite details: ${refreshedInviteDetailsError.message}`
    );
  }

  const refreshedInviteDetails = Array.isArray(refreshedInviteDetailsData)
    ? refreshedInviteDetailsData[0]
    : null;

  console.log("Accepted successfully.");
  console.log(
    JSON.stringify(
      {
        accept_result: acceptResult,
        refreshed_invite: refreshedInviteDetails,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("Existing invite acceptance failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
