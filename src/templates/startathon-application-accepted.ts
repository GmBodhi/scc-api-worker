const CLIENT_URL = "https://startathon.sctcoding.club";

/**
 * UTM tags on every link, matching the scheme the client already reads off the
 * query string (see startathon-registration-open.ts).
 */
const UTM =
  "utm_source=email&utm_medium=email&utm_campaign=application-accepted";

const DASHBOARD_URL = `${CLIENT_URL}/?${UTM}`;
const FORMAT_URL = `${CLIENT_URL}/format?${UTM}`;

/**
 * Same group the timeline-update and domains announcements pointed people at.
 * It is the primary CTA here on purpose: shortlisted teams have nothing to do
 * in the dashboard yet, and everything they do need next -- venue, reporting
 * time, what to bring -- goes out on WhatsApp before it reaches their inbox.
 */
const WHATSAPP_URL = "https://chat.whatsapp.com/Cve43TFFjy0BQ9i5kgoWuA";

/**
 * From this email forward only. The submission and shortlisting dates have
 * passed and are noise to a team that just cleared both.
 */
const TIMELINE: ReadonlyArray<{
  date: string;
  label: string;
  emphasis?: boolean;
}> = [
  { date: "SOON", label: "Fee, venue and logistics" },
  { date: "SEP 5 &amp; 6", label: "Startathon.", emphasis: true },
];

interface StartathonApplicationAcceptedData {
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
      ? "font-size:20px;font-weight:900;color:#C8FF00;letter-spacing:-0.01em;"
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

export function getStartathonApplicationAcceptedEmail(
  data: StartathonApplicationAcceptedData,
): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const teamName = escapeHtml(data.teamName.trim());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon: your team is shortlisted</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    ${teamName} is through to Startathon, Sep 5 and 6. Join the WhatsApp group, where logistics go first.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
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
                Shortlisted &middot; Top 20
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                You&rsquo;re<br />in.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, <strong style="color:#ffffff;font-weight:700;">${teamName}</strong> is one of the twenty teams
                shortlisted for Startathon.<br />
                We read every submission and scored them all against the same
                criteria. The field was tight. Yours came through it.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Clean slate -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Everyone starts on zero</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      Your application score decided the shortlist and nothing else.
                      All twenty teams walk into Sep 5 level.
                      <a href="${FORMAT_URL}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">How judging works</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nothing to do yet -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Nothing to do right now</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      No form to fill, nothing to confirm. Venue, reporting time
                      and what to bring go out shortly, on WhatsApp first.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Heads-up: the per-person fee. Marked with the rupee glyph rather
               than a tick because it is the one thing on this list that is not
               already handled -- it is money the team will owe. Amount, deadline
               and method are all deliberately absent: none of them is decided
               yet, and a number in an email is the number people will remember
               even after a later mail corrects it. -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:1px;">
                    <span style="font-size:12px;color:#C8FF00;font-weight:700;">&#8377;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">A per-person fee comes later</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">
                      Shortlisted teams pay a participation fee per person. Nothing
                      is due yet and there is nothing to pay right now. The amount,
                      the deadline and how to pay it come with the rest of the
                      details.
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

          <!-- WhatsApp block: the only real CTA -->
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
                      Get everyone in the group.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                      Every logistics update from here runs through WhatsApp before<br />
                      it reaches your inbox. Make sure all of ${teamName} is in it,<br />
                      not just you.
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
