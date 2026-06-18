import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";
import { buildCampaignEmailText, buildCampaignEmailHtml } from "@/lib/email-campaign-footer";

export const runtime = "nodejs";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

const FROM_ADDRESS = "ミラマネ運営 <news@miramane.me>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://www.miramane.me";

// Resend free tier: 100/day, 3000/month — we cap at 90/day for safety margin
const DAILY_SEND_LIMIT = 90;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Mirrors public.email_campaign_target_role / status / type enums in DB
type CampaignTargetRole = "all" | "guardian" | "child";
type CampaignStatus = "draft" | "sending" | "done" | "failed";

type Campaign = {
  id: string;
  subject: string;
  body_text: string;
  target_role: CampaignTargetRole;
  status: CampaignStatus;
  image_url: string | null;
};

type Recipient = { user_id: string; email: string; unsubscribe_token: string };

async function sendOneEmail(
  to: string,
  subject: string,
  bodyText: string,
  unsubscribeUrl: string,
  imageUrl?: string | null
): Promise<{ resendId: string | null; error: string | null }> {
  if (!resendApiKey) {
    return { resendId: null, error: "RESEND_API_KEY が未設定です" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        text: buildCampaignEmailText(bodyText, unsubscribeUrl),
        html: buildCampaignEmailHtml(bodyText, unsubscribeUrl, imageUrl),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { resendId: null, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { resendId: json.id ?? null, error: null };
  } catch (err) {
    return { resendId: null, error: String(err) };
  }
}

// POST /api/admin/campaigns/send   body: { campaignId }
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Server configuration error", 500);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonError("認証が必要です", 401);

  // Verify caller is the service operator (is_operator = true in profiles)
  // This flag is set ONLY via Supabase Studio — general users cannot set it.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonError("認証に失敗しました", 401);

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: operatorProfile } = await adminClient
    .from("profiles")
    .select("is_operator")
    .eq("id", user.id)
    .maybeSingle();
  if (!operatorProfile?.is_operator) return jsonError("権限がありません。事務局アカウントのみ送信できます。", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("リクエストを読み取れません"); }
  const { campaignId } = body as Record<string, unknown>;
  if (typeof campaignId !== "string" || !campaignId) return jsonError("campaignId が必要です");

  // Get campaign
  const { data: campaignRaw, error: campaignError } = await adminClient
    .from("email_campaigns")
    .select("id, subject, body_text, target_role, status, image_url")
    .eq("id", campaignId)
    .eq("sent_by", user.id)
    .single();
  if (campaignError || !campaignRaw) return jsonError("キャンペーンが見つかりません", 404);
  const campaign = campaignRaw as Campaign;
  if (campaign.status === "sending") return jsonError("送信中です。しばらくお待ちください");
  if (campaign.status === "done") return jsonError("このキャンペーンは送信済みです");

  // Daily limit check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await adminClient
    .from("email_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", todayStart.toISOString());

  // Get recipients via SECURITY DEFINER RPC
  const { data: recipientsRaw, error: rpcError } = await userClient.rpc(
    "get_campaign_recipients",
    { p_target_role: campaign.target_role }
  );
  if (rpcError) return jsonError(`受信者取得に失敗しました: ${rpcError.message}`, 500);
  const recipients: Recipient[] = Array.isArray(recipientsRaw) ? recipientsRaw : [];

  if (recipients.length === 0) {
    return jsonError("送信対象ユーザーがいません（全員が配信停止済みの可能性があります）");
  }

  const currentCount = todayCount ?? 0;
  if (currentCount + recipients.length > DAILY_SEND_LIMIT) {
    return jsonError(
      `本日の送信上限（${DAILY_SEND_LIMIT}通）を超えます。本日残り ${DAILY_SEND_LIMIT - currentCount} 通 / 送信予定 ${recipients.length} 通`,
      429
    );
  }

  // Mark campaign as sending
  await adminClient
    .from("email_campaigns")
    .update({ status: "sending", total_count: recipients.length })
    .eq("id", campaignId);

  // Insert pending recipient rows (ignore duplicates from retries)
  await adminClient.from("email_campaign_recipients").upsert(
    recipients.map((r) => ({
      campaign_id: campaignId,
      user_id: r.user_id,
      email: r.email,
      status: "pending",
    })),
    { onConflict: "campaign_id,user_id", ignoreDuplicates: true }
  );

  // Send emails one by one and record results
  let successCount = 0;
  let failCount = 0;

  for (const recipient of recipients) {
    const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?token=${recipient.unsubscribe_token}`;
    const { resendId, error: sendError } = await sendOneEmail(
      recipient.email,
      campaign.subject,
      campaign.body_text,
      unsubscribeUrl,
      campaign.image_url
    );

    const now = new Date().toISOString();
    if (sendError) {
      failCount++;
      await adminClient
        .from("email_campaign_recipients")
        .update({ status: "failed", error_msg: sendError, sent_at: now })
        .eq("campaign_id", campaignId)
        .eq("user_id", recipient.user_id);
    } else {
      successCount++;
      await adminClient
        .from("email_campaign_recipients")
        .update({ status: "sent", resend_id: resendId, sent_at: now })
        .eq("campaign_id", campaignId)
        .eq("user_id", recipient.user_id);
    }
  }

  const finalStatus = failCount === recipients.length ? "failed" : "done";
  await adminClient
    .from("email_campaigns")
    .update({
      status: finalStatus,
      success_count: successCount,
      fail_count: failCount,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return NextResponse.json({
    ok: true,
    total: recipients.length,
    success: successCount,
    fail: failCount,
  });
}
