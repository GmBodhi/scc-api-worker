const BASE_URL = "https://api.sctcoding.club/api/v3";
const CLIENT_URL = "https://startathon.sctcoding.club";

/**
 * UTM tags carried by every CTA link. The client reads these off the query
 * string at signup and persists them onto startathon_users (migration 0024),
 * so waitlist-sourced signups are attributable after the fact.
 */
const UTM =
  "utm_source=email&utm_medium=email&utm_campaign=waitlist-registration-open";

const SIGNUP_URL = `${CLIENT_URL}/?${UTM}`;

interface StartathonRegistrationOpenData {
  name: string;
  waitlistId: string;
}

/**
 * Waitlist names are raw user input (startathonWaitlist.ts inserts them
 * unmodified), so they are escaped before landing in the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trackLink(waitlistId: string, destination: string): string {
  return `${BASE_URL}/events/email/click?id=${encodeURIComponent(waitlistId)}&url=${encodeURIComponent(destination)}`;
}

export function getStartathonRegistrationOpenEmail(
  data: StartathonRegistrationOpenData,
): string {
  const { waitlistId } = data;
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const pixelUrl = `${BASE_URL}/events/email/open?id=${encodeURIComponent(waitlistId)}`;
  const ctaUrl = trackLink(waitlistId, SIGNUP_URL);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon registrations are open</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    This is the email we promised. Registrations are open &mdash; 20 teams only.
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
                Registrations are open
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                Go<br />build.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, this is the one email we promised you.<br />
                Applications for Startathon 2026 are live. 20 teams get in.
              </p>
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td style="padding:0 36px 36px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#C8FF00;border-radius:8px;">
                    <a href="${ctaUrl}" style="display:inline-block;text-decoration:none;padding:15px 32px;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                      Claim your spot &rarr;
                    </a>
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

          <!-- Stat pills -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                What you signed up for
              </p>
              <table cellpadding="0" cellspacing="0" border="0">
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

          <!-- How to enter -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                How to enter
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Create your account</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Email and password, or one tap with Google. Takes under a minute.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Form your team</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Create one and invite your people by email, or join an existing team with its code.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Pay &#8377;100 and lock it in</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">One flat fee for the whole team. Your slot isn&rsquo;t held until this clears.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Scarcity + repeat CTA -->
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
                      20 teams only
                    </p>
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Don&rsquo;t sit on this.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                      Slots are held in the order teams pay, not the order they sign up.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="background-color:#C8FF00;border-radius:8px;">
                          <a href="${ctaUrl}" style="display:inline-block;text-decoration:none;padding:13px 28px;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                            Register now
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Socials -->
          <tr>
            <td style="padding:0 36px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${trackLink(waitlistId, "https://www.instagram.com/codingclubsctce/")}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:9px 18px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                      Instagram
                    </a>
                  </td>
                  <td>
                    <a href="${trackLink(waitlistId, "https://www.linkedin.com/company/sct-coding-club")}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:9px 18px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                      LinkedIn
                    </a>
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
                You joined the Startathon waitlist and asked to be told when registrations opened. This is that email &mdash; we won&rsquo;t send another.
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
