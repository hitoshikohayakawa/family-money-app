import "./load-local-env.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
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
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const inviteId = normalizeCliValue(process.env.INVITE_ID);
const invitedEmail = normalizeCliValue(process.env.INVITED_USER_EMAIL)?.toLowerCase();

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !inviteId || !invitedEmail) {
  const missing = [];

  if (!supabaseUrl) missing.push("TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("TEST_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseServiceRoleKey) {
    missing.push("TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!inviteId) missing.push("INVITE_ID");
  if (!invitedEmail) missing.push("INVITED_USER_EMAIL");

  console.error(["Missing required env vars.", ...missing.map((name) => `- ${name}`)].join("\n"));
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function writeLog(payload) {
  const logsDir = path.join(process.cwd(), "tmp", "invite-accept-logs");
  ensureDir(logsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(logsDir, `${timestamp}-${inviteId}.json`);
  writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function fail(message, payload = {}) {
  const filePath = writeLog({
    ok: false,
    message,
    ...payload,
  });

  console.error(message);
  console.error(`Log written to ${filePath}`);
  process.exit(1);
}

async function fetchInviteRow() {
  const { data, error } = await adminClient
    .from("family_invites")
    .select("id, family_id, email, role, status, accepted_at, expires_at, created_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    fail(`Failed to fetch invite row: ${error.message}`);
  }

  return data;
}

async function fetchAcceptedMembership(familyId) {
  const { data, error } = await adminClient
    .from("family_members")
    .select("family_id, user_id, role, joined_at")
    .eq("family_id", familyId);

  if (error) {
    fail(`Failed to fetch family_members rows: ${error.message}`, { familyId });
  }

  return data ?? [];
}

const beforeInvite = await fetchInviteRow();

if (!beforeInvite) {
  fail("Invite row not found", { inviteId });
}

if (beforeInvite.email.toLowerCase() !== invitedEmail.toLowerCase()) {
  fail("Invite email does not match INVITED_USER_EMAIL", {
    inviteId,
    invitedEmail,
    inviteRowEmail: beforeInvite.email,
  });
}

const beforeLog = {
  invite: beforeInvite,
  startedAt: new Date().toISOString(),
};

console.log("Generating magic link session for invited user...");
const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
  type: "magiclink",
  email: invitedEmail,
});

if (linkError) {
  fail(`Failed to generate magic link: ${linkError.message}`, beforeLog);
}

const tokenHash = linkData?.properties?.hashed_token;
if (!tokenHash) {
  fail("Magic link generation returned no hashed_token", {
    ...beforeLog,
    linkData,
  });
}

console.log("Verifying OTP to create invited-user session...");
const { data: verifyData, error: verifyError } = await userClient.auth.verifyOtp({
  token_hash: tokenHash,
  type: "email",
});

if (verifyError) {
  fail(`verifyOtp failed: ${verifyError.message}`, {
    ...beforeLog,
    tokenHashPresent: true,
  });
}

const invitedUserId = verifyData.user?.id ?? null;

console.log("Fetching invite details before acceptance...");
const { data: inviteDetailsBeforeData, error: inviteDetailsBeforeError } = await userClient.rpc(
  "get_family_invite_details",
  {
    target_invite_id: inviteId,
  }
);

if (inviteDetailsBeforeError) {
  fail(`Failed to fetch invite details before acceptance: ${inviteDetailsBeforeError.message}`, {
    ...beforeLog,
    invitedUserId,
  });
}

const inviteDetailsBefore = Array.isArray(inviteDetailsBeforeData)
  ? inviteDetailsBeforeData[0]
  : null;

console.log("Accepting invite...");
const { data: acceptData, error: acceptError } = await userClient.rpc("accept_family_invite", {
  invite_id: inviteId,
});

if (acceptError) {
  fail(`accept_family_invite failed: ${acceptError.message}`, {
    ...beforeLog,
    invitedUserId,
    inviteDetailsBefore,
  });
}

const acceptResult = Array.isArray(acceptData) ? acceptData[0] : null;

console.log("Fetching invite details after acceptance...");
const { data: inviteDetailsAfterData, error: inviteDetailsAfterError } = await userClient.rpc(
  "get_family_invite_details",
  {
    target_invite_id: inviteId,
  }
);

if (inviteDetailsAfterError) {
  fail(`Failed to fetch invite details after acceptance: ${inviteDetailsAfterError.message}`, {
    ...beforeLog,
    invitedUserId,
    inviteDetailsBefore,
    acceptResult,
  });
}

const inviteDetailsAfter = Array.isArray(inviteDetailsAfterData)
  ? inviteDetailsAfterData[0]
  : null;

const afterInvite = await fetchInviteRow();
const familyMembers = await fetchAcceptedMembership(beforeInvite.family_id);

const acceptedMembership =
  invitedUserId == null
    ? null
    : familyMembers.find((row) => row.user_id === invitedUserId) ?? null;

const payload = {
  ok: true,
  message: "Real invite acceptance completed",
  inviteId,
  invitedEmail,
  invitedUserId,
  beforeInvite,
  inviteDetailsBefore,
  acceptResult,
  inviteDetailsAfter,
  afterInvite,
  acceptedMembership,
  finishedAt: new Date().toISOString(),
};

const logPath = writeLog(payload);

console.log("Invite acceptance completed.");
console.log(`Log written to ${logPath}`);
console.log(
  JSON.stringify(
    {
      acceptResult,
      afterInvite: {
        status: afterInvite?.status ?? null,
        accepted_at: afterInvite?.accepted_at ?? null,
      },
      acceptedMembership,
    },
    null,
    2
  )
);
