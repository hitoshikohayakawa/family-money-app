const resendApiKey = process.env.RESEND_API_KEY;
const notificationEmailFrom =
  process.env.NOTIFICATION_EMAIL_FROM ?? "ミラマネ <noreply@famimane.app>";
const notificationEmailTo =
  process.env.PRICE_SYNC_ALERT_EMAIL?.trim() || "h.kohayakawa@petsallright.net";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!resendApiKey) {
  fail("RESEND_API_KEY is required to send the price sync failure notification.");
}

const repository = process.env.GITHUB_REPOSITORY ?? "unknown repository";
const runId = process.env.GITHUB_RUN_ID ?? "";
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : "";
const subject = `ミラマネ price sync エラー: ${repository}`;
const text = [
  "価格同期の GitHub Actions が失敗しました。",
  "",
  `Repository: ${repository}`,
  `Workflow: ${process.env.GITHUB_WORKFLOW ?? "unknown workflow"}`,
  `Job: ${process.env.GITHUB_JOB ?? "unknown job"}`,
  `Run ID: ${runId || "unknown"}`,
  `Run URL: ${runUrl || "unavailable"}`,
  `Branch/Ref: ${process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? "unknown ref"}`,
  "",
  "GitHub Actions のログを確認してください。",
].join("\n");

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: notificationEmailFrom,
    to: [notificationEmailTo],
    subject,
    text,
  }),
});

if (!response.ok) {
  const responseText = await response.text();
  fail(`Failed to send price sync failure notification: ${response.status} ${responseText}`);
}

console.log(`Price sync failure notification sent to ${notificationEmailTo}.`);
