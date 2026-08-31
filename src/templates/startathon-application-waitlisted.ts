const CLIENT_URL = "https://startathon.sctcoding.club";

/**
 * UTM tags on every link, matching the scheme the client already reads off the
 * query string (see startathon-registration-open.ts).
 */
const UTM =
  "utm_source=email&utm_medium=email&utm_campaign=application-waitlisted";

const DASHBOARD_URL = `${CLIENT_URL}/?${UTM}`;
const FORMAT_URL = `${CLIENT_URL}/format?${UTM}`;

/**
 * The WhatsApp group carries more weight here than in either of the other two
 * result emails: a standby place can open at short notice, and a team we cannot
 * reach quickly is a team we have to skip.
 */
const WHATSAPP_URL = "https://chat.whatsapp.com/Cve43TFFjy0BQ9i5kgoWuA";

/**
 * Amber rather than the usual lime. This is neither the accepted email nor the
 * rejected one, and it should not be mistaken at a glance for either.
 */
const ACCENT = "#FFB020";

const TIMELINE: ReadonlyArray<{
  date: string;
  label: string;
  emphasis?: boolean;
}> = [
  { date: "SOON", label: "We contact you only if a place opens" },
  { date: "SEP 5 &amp; 6", label: "Startathon.", emphasis: true },
];

interface StartathonApplicationWaitlistedData {
  name: string;
  teamName: string;
}

/**
 * Both fields are raw user input (startathon_users.name is bound unmodified at
 * signup, startathon_teams.name at team creation), so they are escaped before
 * landing in the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTimelineRows(): string {
  return TIMELINE.map(({ date, label, emphasis }, index) => {
    const isLast = index === TIMELINE.length - 1;

    const dateStyle = emphasis
      ? `font-size:20px;font-weight:900;color:${ACCENT};letter-spacing:-0.01em;`
      : "font-size:13px;font-weight:800;color:#ffffff;letter-spacing:0.02em;";

    const labelStyle = emphasis
      ? "font-size:13px;font-weight:800;color:#ffffff;"
      : "font-size:12px;color:rgba(255,255,255,0.42);";

    return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="${dateStyle}white-space:nowrap;">${date}</td>
                  <td align="right" style="${labelStyle}padding-left:12px;">${label}</td>
                </tr>
              </table>${
                isLast
                  ? ""
                  : `
              <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
              <div style="height:1px;background:rgba(255,255,255,0.06);line-height:1px;font-size:0;">&nbsp;</div>
              <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>`
              }`;
  }).join("");
}

export function getStartathonApplicationWaitlistedEmail(
  data: StartathonApplicationWaitlistedData,
): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const teamName = escapeHtml(data.teamName.trim());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon: your team is on standby</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    ${teamName} is on standby for Startathon. If a shortlisted team drops out, we come to you.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Top amber hairline accent -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,176,32,0.35),transparent);"></div>
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
                    <span style="display:inline-block;background:rgba(255,176,32,0.08);border:1px solid rgba(255,176,32,0.25);border-radius:50px;padding:4px 10px;">
                      <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,176,32,0.9);font-weight:500;">
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
              <p style="margin:0 0 14px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:${ACCENT};font-weight:500;">
                Waitlisted &middot; Standby
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                Next<br />in line.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, <strong style="color:#ffffff;font-weight:700;">${teamName}</strong> is on the Startathon waitlist.<br />
                Twenty teams were shortlisted and yours was not one of them, but it
                is one of ten teams held on standby. The margins between the last
                teams in and the first teams out were small.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- What standby means -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:${ACCENT};">&#9679;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">What standby means</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      If a shortlisted team withdraws or cannot make Sep 5 and 6, we
                      come to the waitlist. We cannot say how many places will open.
                      Some years none do.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nothing to do -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:${ACCENT};">&#9679;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Nothing to do, nothing to pay</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      There is no form and no fee for a waitlisted team. Shortlisted
                      teams pay a per-person participation fee; that only becomes
                      yours if a place opens, and we would tell you the amount and
                      the deadline then.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Be reachable -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:${ACCENT};">&#9679;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Stay reachable</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      A place can open at short notice. If we cannot reach your team
                      quickly we have to move to the next one, so keep your phone
                      number current on your dashboard and get everyone into the
                      WhatsApp group.
                      <a href="${FORMAT_URL}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">How judging works</a>.
                    </p>
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

          <!-- Timeline -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 22px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                What happens when
              </p>
              ${renderTimelineRows()}
            </td>
          </tr>

          <!-- WhatsApp block -->
          <tr>
            <td style="padding:0 36px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(37,211,102,0.20);overflow:hidden;">
                <tr>
                  <td style="padding:0;line-height:0;font-size:0;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,0.40),transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#25D366;font-weight:500;">
                      Do this one thing
                    </p>
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Be easy to reach.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                      Standby calls go out on WhatsApp before they go anywhere else.<br />
                      Get all of ${teamName} into the group, not just you.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="background-color:#25D366;border-radius:8px;">
                          <a href="${WHATSAPP_URL}" style="display:inline-block;text-decoration:none;padding:14px 30px;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                            Join the WhatsApp group
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 36px 32px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.85;">
                Whatever happens with the standby list, the idea is still yours and
                worth building. Thank you for the work you put into the submission.
              </p>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td style="padding:0 36px 36px;text-align:center;">
              <a href="${DASHBOARD_URL}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:11px 22px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                Open your dashboard
              </a>
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

          <!-- Why you got this -->
          <tr>
            <td style="padding:0 36px 24px;text-align:center;">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.1);letter-spacing:0.04em;">
                You are on a Startathon 2026 team that submitted an application. This is the shortlisting result.
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
