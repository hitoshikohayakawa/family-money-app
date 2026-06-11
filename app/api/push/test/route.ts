import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendTestPushToCurrentUser } from "@/lib/push-notifications";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST: ログイン中の本人へテスト通知を送る（任意user_id指定は不可）
export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) return jsonError("Server config error", 500);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

  const userClient = createAuthenticatedServerClient(authorization);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) return jsonError("Unauthorized", 401);

  try {
    const result = await sendTestPushToCurrentUser(user.id);
    if (result.sent === 0) {
      return NextResponse.json(
        { ok: false, message: "送信先のsubscriptionが登録されていません" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(`Push send failed: ${message}`, 500);
  }
}
