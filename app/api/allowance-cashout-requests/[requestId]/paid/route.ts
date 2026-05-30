import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
export const runtime = "nodejs";

type PaidCashoutRequest = {
  cashout_request_id: string;
  requested_amount_jpy: number;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
) {
  if (!hasServerSupabaseEnv()) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  const { requestId } = await context.params;

  if (!requestId) {
    return jsonError("支払い申請IDが指定されていません。");
  }

  const userClient = createAuthenticatedServerClient(authorization);
  const { data, error } = await userClient.rpc("mark_allowance_cashout_paid", {
    target_cashout_request_id: requestId,
  });

  if (error) {
    return jsonError(`支払い完了の保存に失敗しました: ${error.message}`, 500);
  }

  const cashoutRequest = Array.isArray(data)
    ? (data[0] as PaidCashoutRequest | undefined)
    : undefined;

  return NextResponse.json({ cashoutRequest });
}
