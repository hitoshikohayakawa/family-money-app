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
      "Missing Supabase env vars for family tasks smoke test.",
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
const guardianEmail = `family-tasks-guardian-${randomSuffix}@example.test`;
const childEmail = `family-tasks-child-${randomSuffix}@example.test`;
const otherChildEmail = `family-tasks-child2-${randomSuffix}@example.test`;
const password = `Test-pass-${randomSuffix}`;
const familyName = `family-tasks-smoke-${randomSuffix}`;

let guardianUserId = null;
let childUserId = null;
let otherChildUserId = null;
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

async function addChildMembership(userId) {
  const { error } = await serviceClient.from("family_members").insert({
    family_id: familyId,
    user_id: userId,
    role: "child",
  });

  if (error) {
    throw new Error(`Failed to add child membership: ${error.message}`);
  }
}

async function cleanup() {
  // family 削除で family_tasks / allowance_grants / grant_decisions は cascade
  if (familyId) {
    await serviceClient.from("families").delete().eq("id", familyId);
  }
  if (guardianUserId) {
    await serviceClient.auth.admin.deleteUser(guardianUserId);
  }
  if (childUserId) {
    await serviceClient.auth.admin.deleteUser(childUserId);
  }
  if (otherChildUserId) {
    await serviceClient.auth.admin.deleteUser(otherChildUserId);
  }
}

try {
  console.log("Creating family tasks smoke-test users...");
  guardianUserId = await createUser(guardianEmail);
  childUserId = await createUser(childEmail);
  otherChildUserId = await createUser(otherChildEmail);

  await upsertProfile(guardianUserId, guardianEmail);
  await upsertProfile(childUserId, childEmail);
  await upsertProfile(otherChildUserId, otherChildEmail);

  const guardianClient = await signIn(guardianEmail);
  const childClient = await signIn(childEmail);
  const otherChildClient = await signIn(otherChildEmail);

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

  console.log("Adding child memberships...");
  await addChildMembership(childUserId);
  await addChildMembership(otherChildUserId);

  // ── 1) 報酬つきタスクを作成 ────────────────────────────────────
  console.log("Creating a rewarded task as guardian...");
  const { data: rewardedTaskId, error: createError } = await guardianClient.rpc(
    "create_family_task",
    {
      target_child_user_id: childUserId,
      task_title: "宿題をする",
      task_description: "算数のプリント1枚",
      task_reward_amount_jpy: 100,
      // requires_confirmation を false で渡しても、報酬ありなので true に強制される想定
      task_requires_confirmation: false,
      task_recurrence: "none",
    }
  );

  if (createError) {
    throw new Error(`create_family_task failed: ${createError.message}`);
  }
  assert(typeof rewardedTaskId === "string" && rewardedTaskId.length > 0, "create_family_task returned no id");

  // 報酬ありは確認必須に強制されているか
  const { data: createdRow, error: createdRowError } = await serviceClient
    .from("family_tasks")
    .select("requires_confirmation, status, reward_amount_jpy")
    .eq("id", rewardedTaskId)
    .single();
  if (createdRowError) {
    throw new Error(`Failed to fetch created task: ${createdRowError.message}`);
  }
  assert(createdRow.requires_confirmation === true, "Rewarded task must force requires_confirmation=true");
  assert(createdRow.status === "open", `Expected open, got ${createdRow.status}`);

  // ── 2) 子の一覧に出るか ────────────────────────────────────────
  console.log("Listing tasks as child...");
  const { data: childTasks, error: childListError } = await childClient.rpc(
    "list_family_tasks_for_current_user"
  );
  if (childListError) {
    throw new Error(`list_family_tasks_for_current_user (child) failed: ${childListError.message}`);
  }
  assert(
    Array.isArray(childTasks) && childTasks.some((t) => t.id === rewardedTaskId),
    "Child cannot see their own task"
  );

  // ── 3) 他の子からは見えない ────────────────────────────────────
  const { data: otherChildTasks, error: otherListError } = await otherChildClient.rpc(
    "list_family_tasks_for_current_user"
  );
  if (otherListError) {
    throw new Error(`list_family_tasks_for_current_user (other child) failed: ${otherListError.message}`);
  }
  assert(
    Array.isArray(otherChildTasks) && !otherChildTasks.some((t) => t.id === rewardedTaskId),
    "Other child must not see someone else's task"
  );

  // ── 4) 他の子は完了報告できない ────────────────────────────────
  console.log("Verifying other child cannot complete the task...");
  const { error: wrongChildError } = await otherChildClient.rpc(
    "submit_family_task_completion",
    { target_task_id: rewardedTaskId }
  );
  assert(wrongChildError, "Other child should NOT be able to submit completion");

  // ── 5) 子が完了報告 → submitted ────────────────────────────────
  console.log("Child reports completion...");
  const { data: submitResult, error: submitError } = await childClient.rpc(
    "submit_family_task_completion",
    { target_task_id: rewardedTaskId }
  );
  if (submitError) {
    throw new Error(`submit_family_task_completion failed: ${submitError.message}`);
  }
  assert(submitResult === "submitted", `Expected submitted, got ${submitResult}`);

  // ── 6) 子は承認できない ────────────────────────────────────────
  const { error: childApproveError } = await childClient.rpc("approve_family_task", {
    target_task_id: rewardedTaskId,
  });
  assert(childApproveError, "Child should NOT be able to approve a task");

  // ── 7) 保護者が承認 → done ＋ お小遣い自動付与 ─────────────────
  console.log("Guardian approves the task...");
  const { data: rewardGrantId, error: approveError } = await guardianClient.rpc(
    "approve_family_task",
    { target_task_id: rewardedTaskId }
  );
  if (approveError) {
    throw new Error(`approve_family_task failed: ${approveError.message}`);
  }
  assert(typeof rewardGrantId === "string" && rewardGrantId.length > 0, "approve must return a reward grant id");

  const { data: doneRow, error: doneRowError } = await serviceClient
    .from("family_tasks")
    .select("status, approved_by_user_id, reward_grant_id")
    .eq("id", rewardedTaskId)
    .single();
  if (doneRowError) {
    throw new Error(`Failed to fetch approved task: ${doneRowError.message}`);
  }
  assert(doneRow.status === "done", `Expected done, got ${doneRow.status}`);
  assert(doneRow.approved_by_user_id === guardianUserId, "approved_by_user_id mismatch");
  assert(doneRow.reward_grant_id === rewardGrantId, "reward_grant_id mismatch");

  // 自動付与されたお小遣いの検証
  const { data: grantRow, error: grantRowError } = await serviceClient
    .from("allowance_grants")
    .select("amount_jpy, child_user_id, granted_by_user_id, family_id")
    .eq("id", rewardGrantId)
    .single();
  if (grantRowError) {
    throw new Error(`Failed to fetch reward allowance_grant: ${grantRowError.message}`);
  }
  assert(grantRow.amount_jpy === 100, `Expected reward 100, got ${grantRow.amount_jpy}`);
  assert(grantRow.child_user_id === childUserId, "Reward granted to wrong child");
  assert(grantRow.granted_by_user_id === guardianUserId, "Reward granted_by mismatch");

  const { data: decisionRow, error: decisionRowError } = await serviceClient
    .from("grant_decisions")
    .select("decision_status")
    .eq("allowance_grant_id", rewardGrantId)
    .single();
  if (decisionRowError) {
    throw new Error(`Failed to fetch grant_decisions for reward: ${decisionRowError.message}`);
  }
  assert(
    decisionRow.decision_status === "pending",
    `Expected pending decision, got ${decisionRow.decision_status}`
  );

  // ── 8) 報酬なし・確認不要タスク → 子の報告で即 done、付与は増えない ──
  console.log("Creating a free (no-reward, no-confirmation) task...");
  const { data: freeTaskId, error: freeCreateError } = await guardianClient.rpc(
    "create_family_task",
    {
      target_child_user_id: childUserId,
      task_title: "犬のさんぽ",
      task_requires_confirmation: false,
      task_recurrence: "none",
    }
  );
  if (freeCreateError) {
    throw new Error(`create_family_task (free) failed: ${freeCreateError.message}`);
  }

  const { data: freeSubmit, error: freeSubmitError } = await childClient.rpc(
    "submit_family_task_completion",
    { target_task_id: freeTaskId }
  );
  if (freeSubmitError) {
    throw new Error(`submit_family_task_completion (free) failed: ${freeSubmitError.message}`);
  }
  assert(freeSubmit === "done", `Expected done for free task, got ${freeSubmit}`);

  const { count: grantCount, error: countError } = await serviceClient
    .from("allowance_grants")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if (countError) {
    throw new Error(`Failed to count allowance grants: ${countError.message}`);
  }
  assert(grantCount === 1, `Expected exactly 1 reward grant, got ${grantCount}`);

  // ── 9) 繰り返し（毎日・報酬つき）→ 承認後も open に戻り、due_at が進む ──
  console.log("Creating a recurring (daily, rewarded) task...");
  const pastDue = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: dailyTaskId, error: dailyCreateError } = await guardianClient.rpc(
    "create_family_task",
    {
      target_child_user_id: childUserId,
      task_title: "毎日の宿題",
      task_reward_amount_jpy: 30,
      task_due_at: pastDue,
      task_recurrence: "daily",
    }
  );
  if (dailyCreateError) {
    throw new Error(`create_family_task (daily) failed: ${dailyCreateError.message}`);
  }

  const { data: dailySubmit, error: dailySubmitError } = await childClient.rpc(
    "submit_family_task_completion",
    { target_task_id: dailyTaskId }
  );
  if (dailySubmitError) {
    throw new Error(`submit_family_task_completion (daily) failed: ${dailySubmitError.message}`);
  }
  assert(dailySubmit === "submitted", `Expected submitted for daily task, got ${dailySubmit}`);

  const { error: dailyApproveError } = await guardianClient.rpc("approve_family_task", {
    target_task_id: dailyTaskId,
  });
  if (dailyApproveError) {
    throw new Error(`approve_family_task (daily) failed: ${dailyApproveError.message}`);
  }

  const { data: dailyRow, error: dailyRowError } = await serviceClient
    .from("family_tasks")
    .select("status, reward_grant_id, due_at")
    .eq("id", dailyTaskId)
    .single();
  if (dailyRowError) {
    throw new Error(`Failed to fetch daily task: ${dailyRowError.message}`);
  }
  assert(dailyRow.status === "open", `Recurring task should reopen, got ${dailyRow.status}`);
  assert(dailyRow.reward_grant_id === null, "Recurring task should clear reward_grant_id after approval");
  assert(
    new Date(dailyRow.due_at).getTime() > Date.now(),
    "Recurring task due_at should advance into the future"
  );

  const { count: grantCount2, error: countError2 } = await serviceClient
    .from("allowance_grants")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if (countError2) {
    throw new Error(`Failed to recount allowance grants: ${countError2.message}`);
  }
  assert(grantCount2 === 2, `Expected 2 reward grants after recurring approval, got ${grantCount2}`);

  // 1日1回ガード: 承認直後（同日）に子が再提出しようとしても拒否される
  const { error: reSubmitError } = await childClient.rpc("submit_family_task_completion", {
    target_task_id: dailyTaskId,
  });
  assert(reSubmitError, "Daily recurring task must not be re-submittable on the same day");

  console.log("Family tasks smoke test passed.");
  process.exit(0);
} catch (error) {
  console.error("Family tasks smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
