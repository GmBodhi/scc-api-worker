const BASE_URL = "https://api.sctcoding.club/api/v3";

interface StartathonWaitlistConfirmationData {
  name: string;
  waitlistId: string;
}

function trackLink(waitlistId: string, destination: string): string {
  return `${BASE_URL}/events/email/click?id=${encodeURIComponent(waitlistId)}&url=${encodeURIComponent(destination)}`;
}

export function getStartathonWaitlistConfirmationEmail(
  data: StartathonWaitlistConfirmationData,
): string {
  const { waitlistId } = data;
  const pixelUrl = `${BASE_URL}/events/email/open?id=${encodeURIComponent(waitlistId)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're on the Startathon waitlist</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    We'll reach out the moment registrations open. One email. No spam.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Top lime hairline accent -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.35),transparent);"></div>
            </td>
          </tr>

          <!-- Header: logo row -->
          <tr>
            <td style="padding:28px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">
                      Startathon<span style="color:#888888;">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(200,255,0,0.08);border:1px solid rgba(200,255,0,0.25);border-radius:50px;padding:4px 10px;">
                      <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(200,255,0,0.9);font-weight:500;">
                        &#9670; Kerala 2026
                      </span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <p style="margin:0 0 14px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                You're on the list
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                You're<br />in.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                We'll email you the moment registrations open.<br />
                No spam. Just one email when we're ready.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- What you're waiting for -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                What you're waiting for
              </p>
              <p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.8;">
                Startathon is Kerala's most curated hackathon for student builders.
                <strong style="color:rgba(255,255,255,0.75);font-weight:600;">30 hours. Real problems. 20 selected teams.</strong>
                Built around the idea that the best way to find great builders is to watch them build.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                <tr>
                  <td style="padding-right:8px;">
                    <span style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:50px;padding:6px 14px;">
                      <span style="font-size:13px;font-weight:900;color:#C8FF00;">30 HRS</span>
                      <span style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:6px;">Build sprint</span>
                    </span>
                  </td>
                  <td style="padding-right:8px;">
                    <span style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:50px;padding:6px 14px;">
                      <span style="font-size:13px;font-weight:900;color:#C8FF00;">20</span>
                      <span style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:6px;">Curated teams</span>
                    </span>
                  </td>
                  <td>
                    <span style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:50px;padding:6px 14px;">
                      <span style="font-size:13px;font-weight:900;color:#C8FF00;">&#8377;2L+</span>
                      <span style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:6px;">Prize pool</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Why it matters -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                Why it matters
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">PPOs &amp; Internships</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Companies scout here. Sponsors extend pre-placement offers to builders they like &mdash; on the spot.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">1:1s with Founders &amp; CTOs</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Not a panel from 20 rows back. You sit across from technical founders who&rsquo;ve shipped things.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Fast-track Interviews</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Top performers get referred straight into hiring pipelines. No cold applications. No ghosting.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA block -->
          <tr>
            <td style="padding:0 36px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(200,255,0,0.15);overflow:hidden;">
                <tr>
                  <td style="padding:0;line-height:0;font-size:0;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.30),transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                      Stay curious
                    </p>
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Keep building.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                      Follow us so you're first to know when applications open.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="padding-right:8px;">
                          <a href="${trackLink(waitlistId, 'https://www.instagram.com/codingclubsctce/')}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:9px 18px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                            Instagram
                          </a>
                        </td>
                        <td>
                          <a href="${trackLink(waitlistId, 'https://www.linkedin.com/company/sct-coding-club')}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:9px 18px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                            LinkedIn
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pull quote -->
          <tr>
            <td style="padding:0 36px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="3" style="background:linear-gradient(180deg,#C8FF00,transparent);border-radius:2px;vertical-align:top;">&nbsp;</td>
                  <td style="padding-left:16px;">
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.7;font-style:italic;">
                      &ldquo;The builders who changed the world didn&rsquo;t wait for permission.
                      We&rsquo;re just making sure the ones from Kerala have a room to start in.&rdquo;
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.05em;">
                      Organized by <strong style="color:rgba(255,255,255,0.28);font-weight:600;">Coding Club, SCTCE</strong>
                    </p>
                    <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.12);letter-spacing:0.04em;">
                      Sree Chitra Thirunal College of Engineering &middot; Thiruvananthapuram, Kerala
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <a href="mailto:hello@sctcoding.club" style="font-size:10px;color:rgba(255,255,255,0.22);text-decoration:none;letter-spacing:0.04em;">
                      hello@sctcoding.club
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Unsubscribe -->
          <tr>
            <td style="padding:0 36px 24px;text-align:center;">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.1);letter-spacing:0.04em;">
                You&rsquo;re receiving this because you joined the Startathon waitlist.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

  <!-- Tracking pixel -->
  <img src="${pixelUrl}" width="1" height="1" border="0" style="display:block;width:1px;height:1px;" alt="" />

</body>
</html>`.trim();
}
