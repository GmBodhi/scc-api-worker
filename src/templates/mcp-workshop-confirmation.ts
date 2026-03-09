interface McpWorkshopConfirmationData {
  name: string;
  registrationId: string;
}

export function getMcpWorkshopConfirmationEmail(
  data: McpWorkshopConfirmationData,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>MCP Workshop Registration Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Inter',Arial,sans-serif;line-height:1.6;color:#1a1a1a;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#ed2c2c,#f05b5b);border-radius:16px 16px 0 0;padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:13px;font-weight:500;color:rgba(255,255,255,0.8);letter-spacing:0.5px;text-transform:uppercase;">SCT Coding Club</p>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">&#x1F916; MCP Workshop</h1>
                    <p style="margin:6px 0 0 0;font-size:14px;color:rgba(255,255,255,0.85);">March 14, 2026 &nbsp;&bull;&nbsp; Deep Learning LAB</p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:40px;line-height:1;">&#x1F4BB;</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY CARD -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 16px 16px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

              <!-- Success indicator -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <span style="font-size:36px;">&#x2705;</span>
                    <h2 style="margin:12px 0 4px;font-size:20px;font-weight:600;color:#1a1a1a;line-height:1.2;">You&rsquo;re registered!</h2>
                    <p style="margin:0;font-size:14px;color:#666666;">Your spot at the MCP Workshop is confirmed.</p>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:16px;color:#1a1a1a;">Hi <strong>${data.name}</strong>,</p>
              <p style="margin:0 0 24px;font-size:16px;color:#1a1a1a;">
                We&rsquo;re excited to have you at the <strong>MCP Workshop</strong> on <strong>March 14, 2026</strong> at the Deep Learning LAB. This hands-on session will walk you through building Model Context Protocol servers with Spring Boot.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 32px;">

              <!-- Registration ID badge -->
              <p style="margin:0 0 8px;font-size:12px;font-weight:500;color:#666666;text-transform:uppercase;letter-spacing:0.5px;">Your Registration ID</p>
              <div style="background:#f5f5f5;border:1px solid #e0e0e0;border-left:4px solid #ed2c2c;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:15px;color:#1a1a1a;margin-bottom:32px;">
                ${data.registrationId}
              </div>

              <!-- What to bring / prereqs note box -->
              <div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:12px;padding:20px 24px;margin-bottom:32px;">
                <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1a1a1a;">&#x1F4CB; Before you arrive</p>
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:top;padding-right:8px;font-size:14px;color:#ed2c2c;">&#x2022;</td>
                    <td style="font-size:14px;color:#666666;padding-bottom:8px;">Bring your laptop with <strong style="color:#1a1a1a;">JDK 21+</strong> and <strong style="color:#1a1a1a;">IntelliJ IDEA</strong> installed and working.</td>
                  </tr>
                  <tr>
                    <td style="vertical-align:top;padding-right:8px;font-size:14px;color:#ed2c2c;">&#x2022;</td>
                    <td style="font-size:14px;color:#666666;padding-bottom:8px;">
                      Watch these tutorials before the session:
                      <br><br>
                      <a href="https://www.youtube.com/watch?v=LPgiUILsZqQ" style="color:#ed2c2c;text-decoration:none;font-weight:500;">How to Download and Install IntelliJ IDEA &#8599;</a>
                      <br>
                      <a href="https://www.youtube.com/watch?v=V3Nde0fkmoE" style="color:#ed2c2c;text-decoration:none;font-weight:500;">Create Spring Boot Project in IntelliJ Ultimate &#8599;</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="vertical-align:top;padding-right:8px;font-size:14px;color:#ed2c2c;">&#x2022;</td>
                    <td style="font-size:14px;color:#666666;">A stable internet connection is recommended during the workshop.</td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="https://sctcoding.club/events/mcp-workshop-2026"
                       style="display:inline-block;background:#ed2c2c;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;border-bottom:3px solid #d31212;">
                      View Event Details
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 24px;">

              <!-- Help -->
              <p style="margin:0;font-size:14px;color:#666666;">
                Questions? Reach us at
                <a href="mailto:hello@sctcoding.club" style="color:#ed2c2c;text-decoration:none;font-weight:500;">hello@sctcoding.club</a>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#666666;">
                &copy; ${new Date().getFullYear()} SCT Coding Club &nbsp;&bull;&nbsp;
                <a href="https://sctcoding.club" style="color:#666666;text-decoration:none;">sctcoding.club</a>
              </p>
              <p style="margin:0;font-size:12px;color:#999999;">
                You&rsquo;re receiving this because you registered for the MCP Workshop.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}
