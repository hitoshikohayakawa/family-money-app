type SendEmailParams = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

type SendEmailResult = {
  sent: boolean;
  skippedReason?: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const notificationEmailFrom =
  process.env.NOTIFICATION_EMAIL_FROM ?? "ミラマネ <noreply@miramane.me>";

export async function sendNotificationEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<SendEmailResult> {
  const recipients = to
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, emails) => email.length > 0 && emails.indexOf(email) === index);

  if (recipients.length === 0) {
    return { sent: false, skippedReason: "送信先メールアドレスがありません。" };
  }

  if (!resendApiKey) {
    return {
      sent: false,
      skippedReason: "RESEND_API_KEY が未設定のため、メール送信をスキップしました。",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: notificationEmailFrom,
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(`メール送信に失敗しました: ${response.status} ${responseText}`);
  }

  return { sent: true };
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildGuardianPaymentRequestHtml({
  childName,
  amount,
  requestType,
  appUrl,
}: {
  childName: string;
  amount: string;
  requestType: string;
  appUrl: string;
}) {
  const logoUrl = `${appUrl}/assets/lp/logo.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7f1;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">

    <div style="text-align:center;margin-bottom:28px;">
      <img src="${logoUrl}" alt="ミラマネ" width="160" style="max-width:160px;height:auto;">
    </div>

    <div style="background:#ffffff;border-radius:24px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">

      <p style="font-size:20px;font-weight:bold;color:#1a3d1a;margin:0 0 24px 0;">
        ${escapeHtml(childName)}さんから<br>払い出し申請が来ました！
      </p>

      <div style="background:#f3fbf4;border-radius:16px;padding:20px 20px 16px;margin:0 0 24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;color:#6b9b6b;padding:5px 0;width:52px;vertical-align:top;">子ども</td>
            <td style="font-size:15px;font-weight:bold;color:#1a3d1a;padding:5px 0;">${escapeHtml(childName)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b9b6b;padding:5px 0;vertical-align:top;">金額</td>
            <td style="font-size:24px;font-weight:900;color:#1a3d1a;padding:5px 0;">${escapeHtml(amount)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b9b6b;padding:5px 0;vertical-align:top;">内容</td>
            <td style="font-size:13px;color:#1a3d1a;padding:5px 0;">${escapeHtml(requestType)}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:15px;color:#1a3d1a;line-height:1.9;margin:0 0 20px 0;">
        ${escapeHtml(childName)}さんにお金を渡したら<br>
        ミラマネで「渡した」ボタンを押してください。
      </p>

      <div style="background:#fffbf0;border-left:3px solid #e6b93a;border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 28px 0;">
        <p style="font-size:13px;color:#6b5a1a;line-height:1.8;margin:0;">
          また、お金を渡すだけでなく、<br>
          どうして今払い出しを行ったのかを<br>
          話し合ってみてください。
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${escapeHtml(appUrl)}"
           style="display:inline-block;background:#2d7a4f;color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:100px;font-size:15px;font-weight:bold;letter-spacing:0.05em;">
          ミラマネを開く
        </a>
      </div>

    </div>

    <div style="text-align:center;padding:24px 0 8px;">
      <p style="font-size:12px;color:#aab8aa;margin:0 0 4px 0;">家族と学ぶお金学習アプリ</p>
      <p style="font-size:13px;font-weight:bold;color:#9aaa9a;margin:0;">〜〜 ミラマネ 〜〜</p>
    </div>

  </div>
</body>
</html>`;
}
