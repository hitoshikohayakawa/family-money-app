import "./load-local-env.mjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const userEmail = process.env.USER_EMAIL?.trim().toLowerCase();
const tempPassword = process.env.TEMP_PASSWORD?.trim();
const displayName = process.env.DISPLAY_NAME?.trim() || null;
const createIfMissing = process.env.CREATE_IF_MISSING === "true";

if (!supabaseUrl || !supabaseServiceRoleKey || !userEmail || !tempPassword) {
  const missing = [];

  if (!supabaseUrl) {
    missing.push("TEST_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    missing.push("TEST_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!userEmail) {
    missing.push("USER_EMAIL");
  }

  if (!tempPassword) {
    missing.push("TEMP_PASSWORD");
  }

  console.error(["Missing required env vars.", ...missing.map((name) => `- ${name}`)].join("\n"));
  process.exit(1);
}

if (tempPassword.length < 6) {
  console.error("TEMP_PASSWORD must be at least 6 characters.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const matchedUser =
      data.users.find((user) => (user.email ?? "").toLowerCase() === email) ?? null;

    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function ensureProfile(userId, email) {
  const { error } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName,
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw new Error(`Failed to upsert profile: ${error.message}`);
  }
}

try {
  let user = await findUserByEmail(userEmail);

  if (!user) {
    if (!createIfMissing) {
      throw new Error("User not found. Re-run with CREATE_IF_MISSING=true if you want to create it.");
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: userEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        requires_password_setup: true,
      },
    });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    if (!data.user) {
      throw new Error("User creation returned no user.");
    }

    user = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.updateUserById(user.id, {
      password: tempPassword,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        display_name: displayName ?? user.user_metadata?.display_name ?? null,
        requires_password_setup: true,
      },
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Failed to update user password: ${error.message}`);
    }

    if (!data.user) {
      throw new Error("User update returned no user.");
    }

    user = data.user;
  }

  await ensureProfile(user.id, userEmail);

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: userEmail,
        user_id: user.id,
        requires_password_setup: true,
        created: createIfMissing,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
