const CLIENT_URL = "https://startathon.sctcoding.club";

/**
 * UTM tags on the dashboard CTA, matching the scheme the client already reads
 * off the query string (see startathon-registration-open.ts).
 */
const UTM =
  "utm_source=email&utm_medium=email&utm_campaign=timeline-update-whatsapp";

const DASHBOARD_URL = `${CLIENT_URL}/?${UTM}`;

const WHATSAPP_URL = "https://chat.whatsapp.com/Cve43TFFjy0BQ9i5kgoWuA";

/**
 * Upcoming milestones only -- the two that have already passed (waitlist go-live,
 * registration opening) are noise to someone who is already registered.
 *
 * `emphasis` marks the event itself, which renders at hero scale.
 */
const TIMELINE: ReadonlyArray<{
  date: string;
  label: string;
  emphasis?: boolean;
}> = [
  { date: "AUG 5", label: "Idea submissions open" },
  { date: "AUG 12", label: "Submissions close and payment due" },
  { date: "AUG 15", label: "Shortlisted teams announced" },
  { date: "SEP 5&ndash;6", label: "Startathon.", emphasis: true },
];

interface StartathonTimelineUpdateData {
  name: string;
}

/**
 * startathon_users.name is raw user input (signup binds it unmodified), so it
 * is escaped before landing in the markup.
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
    const borderStyle = isLast
      ? ""
      : "border-bottom:1px solid rgba(255,255,255,0.06);";

    const dateStyle = emphasis
      ? "font-size:20px;font-weight:900;color:#C8FF00;letter-spacing:-0.01em;"
      : "font-size:13px;font-weight:800;color:#ffffff;letter-spacing:0.02em;";

    const labelStyle = emphasis
      ? "font-size:13px;font-weight:800;color:#ffffff;"
      : "font-size:12px;color:rgba(255,255,255,0.42);";

    return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:${emphasis ? "18px 0 0" : "0 0 14px"};${borderStyle}">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="${dateStyle}white-space:nowrap;">${date}</td>
                        <td align="right" style="${labelStyle}padding-left:12px;">${label}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${isLast ? "" : '<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>'}`;
  }).join("");
}

export function getStartathonTimelineUpdateEmail(
  data: StartathonTimelineUpdateData,
): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon timeline update</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    New dates &mdash; Startathon is Sep 5&ndash;6. Join the WhatsApp group for updates.
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
                Timeline update
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                New<br />dates.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, the Startathon schedule has shifted.<br />
                Here is the full timeline; treat this as the current one.
              </p>
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

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Next action -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Nothing to redo</p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.65;">Your account and team stay exactly as they are. Only the dates moved.</p>
                  </td>
                </tr>
              </table>
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
                      New &middot; Official group
                    </p>
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Get updates first.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;">
                      Schedule changes, submission reminders and day-of logistics go out<br />
                      on WhatsApp before they reach your inbox. Join it.
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
                You have a Startathon 2026 account. We only email you when something about the event actually changes.
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
