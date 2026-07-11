const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonPasswordResetData {
  name: string;
  resetToken: string;
}

export function getStartathonPasswordResetEmail(
  data: StartathonPasswordResetData,
): string {
  const { name, resetToken } = data;
  const resetUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Startathon password</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">Password reset</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Hi ${name}, we received a request to reset your Startathon password. Click below to choose a new one.
              </p>
              <a href="${resetUrl}" style="display:inline-block;background:rgba(200,255,0,0.9);color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Reset password</a>
              <p style="margin:24px 0 0;font-size:12px;color:#666666;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
