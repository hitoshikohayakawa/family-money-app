import type { Session, SupabaseClient } from "@supabase/supabase-js";

function isInvalidRefreshTokenMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid refresh token") ||
    normalized.includes("refresh token not found") ||
    normalized.includes("refresh_token_not_found")
  );
}

async function clearLocalSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Ignore cleanup failures and let callers treat the session as missing.
  }
}

export async function getSafeSession(client: SupabaseClient): Promise<{
  data: { session: Session | null };
  error: Error | null;
}> {
  try {
    const result = await client.auth.getSession();

    if (result.error && isInvalidRefreshTokenMessage(result.error.message)) {
      await clearLocalSession(client);
      return {
        data: { session: null },
        error: null,
      };
    }

    return {
      data: {
        session: result.data.session,
      },
      error: result.error,
    };
  } catch (error) {
    if (error instanceof Error && isInvalidRefreshTokenMessage(error.message)) {
      await clearLocalSession(client);
      return {
        data: { session: null },
        error: null,
      };
    }

    throw error;
  }
}
