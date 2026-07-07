const BASE_URL = "https://api.sctcoding.club/api/v3";
const SITE_URL = "https://startathon.sctcoding.club";

const MONO_STACK =
  "'JetBrains Mono','SF Mono','Roboto Mono',Menlo,Consolas,monospace";
const SANS_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

interface StartathonWaitlistConfirmationData {
  name: string;
  waitlistId: string;
}

function trackLink(waitlistId: string, destination: string): string {
  return `${BASE_URL}/events/email/click?id=${encodeURIComponent(waitlistId)}&url=${encodeURIComponent(destination)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getStartathonWaitlistConfirmationEmail(
  data: StartathonWaitlistConfirmationData,
): string {
  const { name, waitlistId } = data;
  const firstName = escapeHtml(name.trim().split(/\s+/)[0] || "");
  const safeWaitlistId = escapeHtml(waitlistId);
  const pixelUrl = `${BASE_URL}/events/email/open?id=${encodeURIComponent(waitlistId)}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>You're on the Startathon waitlist</title>
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    @media only screen and (max-width: 480px) {
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .hero-h1 { font-size: 34px !important; }
      .stat-num { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:${SANS_STACK};">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;mso-hide:all;">
    We'll reach out the moment registrations open. One email. No spam.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 12px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="max-width:600px;background-color:#0a0a0a;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Top lime hairline accent -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:2px;background-color:#1a2200;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.6),transparent);"></div>
            </td>
          </tr>

          <!-- Header: logo row -->
          <tr>
            <td class="px" style="padding:28px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:16px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">
                      Startathon<span style="color:#C8FF00;">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(200,255,0,0.08);border:1px solid rgba(200,255,0,0.3);border-radius:50px;padding:5px 12px;">
                      <span style="font-family:${MONO_STACK};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                        &#9670;&nbsp;Kerala 2026
                      </span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td class="px" style="padding:44px 40px 8px;">
              <p style="margin:0 0 16px;font-family:${MONO_STACK};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                // Waitlist confirmed
              </p>
              <h1 class="hero-h1" style="margin:0 0 18px;font-size:42px;font-weight:900;color:#ffffff;line-height:1.0;letter-spacing:-0.03em;">
                You're in${firstName ? `,<br />${firstName}.` : "."}
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.75;">
                Your spot on the waitlist is locked. We'll email you the moment
                registrations open &mdash; no spam, just one email when we're ready.
              </p>
            </td>
          </tr>

          <!-- Waitlist ID reference -->
          <tr>
            <td class="px" style="padding:28px 40px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" style="background-color:#050505;border:1px dashed rgba(200,255,0,0.25);border-radius:10px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 4px;font-family:${MONO_STACK};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3);">
                      Your waitlist ID
                    </p>
                    <p style="margin:0;font-family:${MONO_STACK};font-size:14px;font-weight:700;letter-spacing:0.06em;color:#C8FF00;">
                      ${safeWaitlistId}
                    </p>
                  </td>
                  <td align="right" style="padding:14px 18px;vertical-align:middle;">
                    <span style="font-family:${MONO_STACK};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.25);">
                      Status: <span style="color:#C8FF00;">Waitlisted</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats band -->
          <tr>
            <td style="padding:0;border-top:1px solid rgba(255,255,255,0.07);border-bottom:1px solid rgba(255,255,255,0.07);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" align="center" style="padding:24px 8px;border-right:1px solid rgba(255,255,255,0.07);">
                    <p class="stat-num" style="margin:0 0 4px;font-size:24px;font-weight:900;color:#C8FF00;letter-spacing:-0.02em;">30</p>
                    <p style="margin:0;font-family:${MONO_STACK};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Hours</p>
                  </td>
                  <td width="34%" align="center" style="padding:24px 8px;border-right:1px solid rgba(255,255,255,0.07);">
                    <p class="stat-num" style="margin:0 0 4px;font-size:24px;font-weight:900;color:#C8FF00;letter-spacing:-0.02em;">20</p>
                    <p style="margin:0;font-family:${MONO_STACK};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Curated teams</p>
                  </td>
                  <td width="33%" align="center" style="padding:24px 8px;">
                    <p class="stat-num" style="margin:0 0 4px;font-size:24px;font-weight:900;color:#C8FF00;letter-spacing:-0.02em;">&#8377;2L+</p>
                    <p style="margin:0;font-family:${MONO_STACK};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Prize pool</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What you're waiting for -->
          <tr>
            <td class="px" style="padding:36px 40px 8px;">
              <p style="margin:0 0 16px;font-family:${MONO_STACK};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.3);font-weight:500;">
                // What you're waiting for
              </p>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.8;">
                Startathon is Kerala's most curated hackathon for student builders.
                <strong style="color:#ffffff;font-weight:600;">30 hours. Real problems. 20 selected teams.</strong>
                Built around the idea that the best way to find great builders is to
                watch them build.
              </p>
            </td>
          </tr>

          <!-- Why it matters -->
          <tr>
            <td class="px" style="padding:32px 40px 12px;">
              <p style="margin:0 0 22px;font-family:${MONO_STACK};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.3);font-weight:500;">
                // Why it matters
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td width="34" style="vertical-align:top;">
                    <span style="font-family:${MONO_STACK};font-size:12px;font-weight:700;color:#C8FF00;">01</span>
                  </td>
                  <td style="padding-left:6px;">
                    <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">PPOs &amp; internships</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7;">Companies scout here. Sponsors extend pre-placement offers to builders they like &mdash; on the spot.</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td width="34" style="vertical-align:top;">
                    <span style="font-family:${MONO_STACK};font-size:12px;font-weight:700;color:#C8FF00;">02</span>
                  </td>
                  <td style="padding-left:6px;">
                    <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">1:1s with founders &amp; CTOs</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7;">Not a panel from 20 rows back. You sit across from technical founders who&rsquo;ve shipped things.</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td width="34" style="vertical-align:top;">
                    <span style="font-family:${MONO_STACK};font-size:12px;font-weight:700;color:#C8FF00;">03</span>
                  </td>
                  <td style="padding-left:6px;">
                    <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">Fast-track interviews</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7;">Top performers get referred straight into hiring pipelines. No cold applications. No ghosting.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA block -->
          <tr>
            <td class="px" style="padding:16px 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d0d0d" style="background-color:#0d0d0d;border-radius:12px;border:1px solid rgba(200,255,0,0.18);overflow:hidden;">
                <tr>
                  <td style="padding:0;line-height:0;font-size:0;">
                    <div style="height:1px;background-color:#2a3800;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.4),transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;text-align:center;">
                    <p style="margin:0 0 8px;font-family:${MONO_STACK};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                      While you wait
                    </p>
                    <h2 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Keep building.
                    </h2>
                    <p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7;">
                      Check out the event details, and follow us so you're first to know when applications open.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                      <tr>
                        <td align="center" bgcolor="#C8FF00" style="background-color:#C8FF00;border-radius:8px;">
                          <a href="${trackLink(waitlistId, SITE_URL)}" style="display:inline-block;text-decoration:none;padding:13px 32px;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                            Explore Startathon &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td style="padding-right:8px;">
                          <a href="${trackLink(waitlistId, "https://www.instagram.com/codingclubsctce/")}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:9px 18px;font-family:${MONO_STACK};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6);">
                            Instagram
                          </a>
                        </td>
                        <td>
                          <a href="${trackLink(waitlistId, "https://www.linkedin.com/company/sct-coding-club")}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:9px 18px;font-family:${MONO_STACK};font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6);">
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
            <td class="px" style="padding:0 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="3" bgcolor="#C8FF00" style="background-color:#C8FF00;border-radius:2px;">&nbsp;</td>
                  <td style="padding-left:18px;">
                    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.75;font-style:italic;">
                      &ldquo;The builders who changed the world didn&rsquo;t wait for permission.
                      We&rsquo;re just making sure the ones from Kerala have a room to start in.&rdquo;
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.04em;">
                      Organized by <strong style="color:rgba(255,255,255,0.45);font-weight:600;">Coding Club, SCTCE</strong>
                    </p>
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:0.03em;">
                      Sree Chitra Thirunal College of Engineering &middot; Thiruvananthapuram, Kerala
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <a href="mailto:hello@sctcoding.club" style="font-family:${MONO_STACK};font-size:10px;color:rgba(255,255,255,0.35);text-decoration:none;letter-spacing:0.04em;">
                      hello@sctcoding.club
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Unsubscribe -->
          <tr>
            <td class="px" style="padding:0 40px 24px;text-align:center;">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.04em;">
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
