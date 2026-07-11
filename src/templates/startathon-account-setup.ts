const CLIENT_URL = "https://startathon.sctcoding.club";

interface StartathonAccountSetupData {
  name: string;
  teamName: string;
  teamId: string;
  role: string;
  resetToken: string;
}

export function getStartathonAccountSetupEmail(
  data: StartathonAccountSetupData,
): string {
  const { name, teamName, teamId, role, resetToken } = data;
  const setupUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your team is registered for Startathon</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#ffffff;">Startathon<span style="color:#888888;">.</span></p>
              <h1 style="margin:20px 0 12px;font-size:22px;color:#ffffff;">You're in, ${name}!</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Your team <strong style="color:#ffffff;">${teamName}</strong> has been registered for Startathon.
                You joined as <strong style="color:#ffffff;">${role}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#888888;">Team ID: <span style="color:rgba(200,255,0,0.9);font-family:monospace;">${teamId}</span></p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#bbbbbb;">
                Set a password to access your team dashboard. You can also sign in with Google using this email address.
              </p>
              <a href="${setupUrl}" style="display:inline-block;background:rgba(200,255,0,0.9);color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Set your password</a>
              <p style="margin:24px 0 0;font-size:12px;color:#666666;">This link is valid for 7 days. If you weren't expecting this email, you can ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
