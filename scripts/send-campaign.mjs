/**
 * send-campaign.mjs
 *
 * Operator-only script to send a marketing email campaign.
 * Run from terminal after creating a campaign row in Supabase Studio.
 *
 * Usage:
 *   npm run campaign:send -- --id <campaignId>
 *   CAMPAIGN_ID=<id> npm run campaign:send
 *
 * Required env vars (in .env.local):
 *   SUPABASE_SERVICE_ROLE_KEY  (or TEST_SUPABASE_SERVICE_ROLE_KEY)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   RESEND_API_KEY
 *
 * Supabase Studio setup:
 *   1. Insert a row in email_campaigns with status='draft'
 *   2. Run this script with the campaign id
 *
 * is_operator setup (one-time):
 *   Run in Supabase Studio SQL editor:
 *     UPDATE public.profiles SET is_operator = true WHERE email = 'your@email.com';
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — rely on actual env vars
}

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

const FROM_ADDRESS = "ファミマネ運営 <news@famimane.me>";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://famimane.me";
const CONTACT_URL = "https://forms.gle/yWjnWtfwQqf1RX9GA";
const DAILY_SEND_LIMIT = 90;

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let campaignId = process.env.CAMPAIGN_ID ?? null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id" && args[i + 1]) { campaignId = args[i + 1]; break; }
  if (args[i]?.startsWith("--id=")) { campaignId = args[i].slice(5); break; }
}

if (!campaignId) {
  console.error("❌  キャンペーンIDが必要です。--id <campaignId> または CAMPAIGN_ID=xxx を指定してください。");
  process.exit(1);
}
if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
  process.exit(1);
}
if (!resendApiKey) {
  console.error("❌  RESEND_API_KEY が未設定です。");
  process.exit(1);
}

// ── Email builders ────────────────────────────────────────────────────────────
function buildText(bodyText, unsubscribeUrl) {
  return `${bodyText}


━━━━━━━━━━━━━━━━━━━━━━━━

ファミマネ
家族でお金を学ぶアプリ

${APP_URL}

お問い合わせはこちら
${CONTACT_URL}

━━━━━━━━━━━━━━━━━━━━━━━━

今後メールの受信を希望しない場合はこちら
${unsubscribeUrl}`;
}

function buildHtml(bodyText, unsubscribeUrl) {
  const escaped = bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlBody = escaped.split("\n").map(l => l === "" ? "<br>" : `${l}<br>`).join("\n");
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px;color:#1F2D20">
  <div style="background:#2F8F57;padding:20px 24px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:900">ファミマネ</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px">家族でお金を学ぶアプリ</p>
  </div>
  <div style="background:#fff;padding:32px 24px;border:1px solid #E0EDE0;line-height:1.8;font-size:15px">${htmlBody}</div>
  <div style="background:#F4FAF5;padding:20px 24px;border:1px solid #E0EDE0;border-top:none;border-radius:0 0 12px 12px;font-size:12px;color:#516251;line-height:1.8">
    <strong style="color:#2F8F57">ファミマネ</strong> — <a href="${APP_URL}" style="color:#378C41">${APP_URL}</a><br>
    お問い合わせ：<a href="${CONTACT_URL}" style="color:#378C41">お問い合わせフォーム</a><br><br>
    <a href="${unsubscribeUrl}" style="color:#999;font-size:11px">メール配信を停止する</a>
  </div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Get campaign
const { data: campaign, error: campaignError } = await admin
  .from("email_campaigns")
  .select("*")
  .eq("id", campaignId)
  .single();

if (campaignError || !campaign) {
  console.error("❌  キャンペーンが見つかりません:", campaignError?.message);
  process.exit(1);
}
// Validate enum values (mirrors public.email_campaign_target_role / email_campaign_status)
const VALID_TARGET_ROLES = ["all", "guardian", "child"];
const VALID_STATUSES     = ["draft", "sending", "done", "failed"];

if (!VALID_TARGET_ROLES.includes(campaign.target_role)) {
  console.error(`❌  不正な target_role: "${campaign.target_role}". 有効値: ${VALID_TARGET_ROLES.join(", ")}`);
  process.exit(1);
}
if (!VALID_STATUSES.includes(campaign.status)) {
  console.error(`❌  不正な status: "${campaign.status}". 有効値: ${VALID_STATUSES.join(", ")}`);
  process.exit(1);
}
if (campaign.status === "sending") {
  console.error("❌  このキャンペーンはすでに送信中です。");
  process.exit(1);
}
if (campaign.status === "done") {
  console.error("❌  このキャンペーンはすでに送信済みです。");
  process.exit(1);
}

console.log(`📧  キャンペーン: ${campaign.subject}`);
console.log(`   対象: ${campaign.target_role} / ステータス: ${campaign.status}`);

// 2. Build recipients (auto-create tokens via direct query)
// Ensure tokens exist
const { data: candidateUsers } = await admin
  .from("profiles")
  .select("id")
  .eq("marketing_email_enabled", true)
  .not("email", "is", null);

for (const u of candidateUsers ?? []) {
  await admin.from("email_unsubscribe_tokens").upsert({ user_id: u.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

// Get filtered recipients
const targetRole = campaign.target_role;
let query = admin
  .from("profiles")
  .select(`id, email, email_unsubscribe_tokens(token), family_memberships!inner(role, status)`)
  .eq("marketing_email_enabled", true)
  .not("email", "is", null)
  .eq("family_memberships.status", "active");

if (targetRole === "guardian") {
  query = query.in("family_memberships.role", ["guardian_admin", "guardian"]);
} else if (targetRole === "child") {
  query = query.eq("family_memberships.role", "child");
}

const { data: rawRecipients, error: recipientsError } = await query;
if (recipientsError) {
  console.error("❌  受信者取得に失敗:", recipientsError.message);
  process.exit(1);
}

// Deduplicate by user id
const seen = new Set();
const recipients = [];
for (const r of rawRecipients ?? []) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  const token = Array.isArray(r.email_unsubscribe_tokens)
    ? r.email_unsubscribe_tokens[0]?.token
    : r.email_unsubscribe_tokens?.token;
  if (!token) continue;
  recipients.push({ user_id: r.id, email: r.email, token });
}

if (recipients.length === 0) {
  console.error("❌  送信対象ユーザーがいません（全員が配信停止済みの可能性があります）。");
  process.exit(1);
}

// 3. Daily limit check
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const { count: todayCount } = await admin
  .from("email_campaign_recipients")
  .select("*", { count: "exact", head: true })
  .eq("status", "sent")
  .gte("sent_at", todayStart.toISOString());

if ((todayCount ?? 0) + recipients.length > DAILY_SEND_LIMIT) {
  console.error(`❌  本日の送信上限（${DAILY_SEND_LIMIT}通）を超えます。`);
  console.error(`   本日送信済み: ${todayCount ?? 0}通 / 送信予定: ${recipients.length}通`);
  process.exit(1);
}

console.log(`✅  送信対象: ${recipients.length}人`);
console.log("   送信を開始します...\n");

// 4. Mark campaign as sending
await admin.from("email_campaigns")
  .update({ status: "sending", total_count: recipients.length })
  .eq("id", campaignId);

// 5. Upsert pending recipients
await admin.from("email_campaign_recipients").upsert(
  recipients.map(r => ({ campaign_id: campaignId, user_id: r.user_id, email: r.email, status: "pending" })),
  { onConflict: "campaign_id,user_id", ignoreDuplicates: true }
);

// 6. Send emails
let successCount = 0;
let failCount = 0;

for (const r of recipients) {
  const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?token=${r.token}`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [r.email],
        subject: campaign.subject,
        text: buildText(campaign.body_text, unsubscribeUrl),
        html: buildHtml(campaign.body_text, unsubscribeUrl),
      }),
    });

    const now = new Date().toISOString();
    if (res.ok) {
      const json = await res.json();
      successCount++;
      process.stdout.write(`  ✓ ${r.email}\n`);
      await admin.from("email_campaign_recipients")
        .update({ status: "sent", resend_id: json.id ?? null, sent_at: now })
        .eq("campaign_id", campaignId).eq("user_id", r.user_id);
    } else {
      const text = await res.text();
      failCount++;
      process.stdout.write(`  ✗ ${r.email} — ${text.slice(0, 100)}\n`);
      await admin.from("email_campaign_recipients")
        .update({ status: "failed", error_msg: text.slice(0, 500), sent_at: now })
        .eq("campaign_id", campaignId).eq("user_id", r.user_id);
    }
  } catch (err) {
    failCount++;
    const msg = String(err);
    process.stdout.write(`  ✗ ${r.email} — ${msg}\n`);
    await admin.from("email_campaign_recipients")
      .update({ status: "failed", error_msg: msg.slice(0, 500), sent_at: new Date().toISOString() })
      .eq("campaign_id", campaignId).eq("user_id", r.user_id);
  }
}

// 7. Update campaign status
const finalStatus = failCount === recipients.length ? "failed" : "done";
await admin.from("email_campaigns").update({
  status: finalStatus,
  success_count: successCount,
  fail_count: failCount,
  sent_at: new Date().toISOString(),
}).eq("id", campaignId);

console.log(`\n${"─".repeat(40)}`);
console.log(`📊  結果: 成功 ${successCount}件 / 失敗 ${failCount}件 / 合計 ${recipients.length}件`);
console.log(`   ステータス: ${finalStatus}`);
process.exit(failCount > 0 && successCount === 0 ? 1 : 0);
