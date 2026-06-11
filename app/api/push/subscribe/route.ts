import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getAuthToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth : null;
}

async function getVerifiedUserId(authorization: string): Promise<string | null> {
  const userClient = createAuthenticatedServerClient(authorization);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

// POST: subscription を保存
export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) return jsonError("Server config error", 500);

  const authorization = getAuthToken(request);
  if (!authorization) return jsonError("Unauthorized", 401);

  const userId = await getVerifiedUserId(authorization);
  if (!userId) return jsonError("Unauthorized", 401);

  let body: {
    subscription?: { endpoint?: string; keys?: unknown };
    userAgent?: string;
    platform?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const { subscription, userAgent, platform } = body;
  if (!subscription?.endpoint) return jsonError("subscription.endpoint is required");

  const serviceClient = createServiceRoleServerClient();
  const { error } = await serviceClient.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription,
      user_agent: userAgent ?? null,
      platform: platform ?? null,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) return jsonError(`Failed to save subscription: ${error.message}`, 500);

  return NextResponse.json({ ok: true });
}

// DELETE: subscription を無効化
export async function DELETE(request: Request) {
  if (!hasServerSupabaseEnv()) return jsonError("Server config error", 500);

  const authorization = getAuthToken(request);
  if (!authorization) return jsonError("Unauthorized", 401);

  const userId = await getVerifiedUserId(authorization);
  if (!userId) return jsonError("Unauthorized", 401);

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const { endpoint } = body;
  if (!endpoint) return jsonError("endpoint is required");

  const serviceClient = createServiceRoleServerClient();
  const { error } = await serviceClient
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) return jsonError(`Failed to disable subscription: ${error.message}`, 500);

  return NextResponse.json({ ok: true });
}
