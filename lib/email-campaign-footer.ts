// Shared footer for marketing / update emails ONLY.
// Do NOT use this in system notification emails (invites, allowance, cashout, etc.).

const APP_URL = "https://famimane.me";
const CONTACT_URL = "https://forms.gle/yWjnWtfwQqf1RX9GA";

export function buildCampaignEmailText(
  bodyText: string,
  unsubscribeUrl: string
): string {
  return `${bodyText}


━━━━━━━━━━━━━━━━━━━━━━━━

ミラマネ
家族でお金を学ぶアプリ

${APP_URL}

お問い合わせはこちら
${CONTACT_URL}

━━━━━━━━━━━━━━━━━━━━━━━━

今後メールの受信を希望しない場合はこちら
${unsubscribeUrl}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCampaignEmailHtml(
  bodyText: string,
  unsubscribeUrl: string
): string {
  const htmlBody = escapeHtml(bodyText)
    .split("\n")
    .map((line) => (line === "" ? "<br>" : `${line}<br>`))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4FAF5;font-family:'Hiragino Kaku Gothic ProN',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4FAF5;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#2F8F57;padding:24px 32px">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:900">ミラマネ</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px">家族でお金を学ぶアプリ</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#1F2D20;font-size:15px;line-height:1.8">
            ${htmlBody}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;background:#F4FAF5;border-top:1px solid #E0EDE0">
            <p style="margin:0;color:#516251;font-size:12px;line-height:1.8">
              <strong style="color:#2F8F57">ミラマネ</strong> — 家族でお金を学ぶアプリ<br>
              <a href="${APP_URL}" style="color:#378C41">${APP_URL}</a><br><br>
              お問い合わせ：<a href="${CONTACT_URL}" style="color:#378C41">お問い合わせフォーム</a>
            </p>
            <p style="margin:16px 0 0;font-size:11px;color:#9AA89A">
              <a href="${unsubscribeUrl}" style="color:#9AA89A">メール配信を停止する</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
