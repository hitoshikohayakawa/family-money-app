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
  process.env.NOTIFICATION_EMAIL_FROM ?? "ファミマネ <noreply@famimane.me>";

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
