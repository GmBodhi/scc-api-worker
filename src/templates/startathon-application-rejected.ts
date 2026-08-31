interface StartathonApplicationRejectedData {
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

/**
 * General observations from the evaluation, not feedback on any one submission
 * -- and the copy says so, because a team reading this will otherwise take each
 * line as a verdict on theirs.
 *
 * Deliberately two, both about process rather than the idea itself: they are
 * the things that cost teams points independently of how good the idea was,
 * which makes them the ones worth carrying into the next hackathon.
 */
const OBSERVATIONS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Fill in the profiles when asked",
    body: "GitHub, LinkedIn, anything the form asks for. A profile is what lets a judge believe the team can actually build the thing it is proposing.",
  },
  {
    title: "Finish a day early",
    body: "Decks and recordings made against the deadline show it. A day of slack is usually the difference between a submission that lands and one that almost did.",
  },
];

/**
 * The accent is white rather than the usual lime. Same shell as every other
 * Startathon email, but the celebratory colour would read badly on this one.
 */
function renderObservations(): string {
  return OBSERVATIONS.map(({ title, body }, index) => {
    const isLast = index === OBSERVATIONS.length - 1;

    return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="26" style="vertical-align:top;padding-top:4px;">
                    <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:rgba(255,255,255,0.25);">0${index + 1}</span>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;font-size:14px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;line-height:1.3;">
                      ${title}
                    </p>
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.38);line-height:1.75;">
                      ${body}
                    </p>
                  </td>
                </tr>
              </table>${
                isLast
                  ? ""
                  : `
              <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
              <div style="height:1px;background:rgba(255,255,255,0.06);line-height:1px;font-size:0;">&nbsp;</div>
              <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>`
              }`;
  }).join("");
}

export function getStartathonApplicationRejectedEmail(
  data: StartathonApplicationRejectedData,
): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const teamName = escapeHtml(data.teamName.trim());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon shortlisting result</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    ${teamName} didn&rsquo;t make the twenty. The margins were small, and the idea is still yours to build.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Top hairline accent, white rather than lime -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent);"></div>
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
                    <span style="display:inline-block;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:50px;padding:4px 10px;">
                      <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-weight:500;">
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
              <p style="margin:0 0 14px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-weight:500;">
                Shortlisting result
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                Not this<br />time.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, <strong style="color:#ffffff;font-weight:700;">${teamName}</strong> isn&rsquo;t among the twenty teams
                moving on to Startathon.<br />
                We wanted to tell you directly rather than let you work it out
                from silence.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- The honest part -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 18px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                What actually happened
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.85;">
                We read every submission and scored them all against the same criteria,
                in the same way, to keep this as consistent and as fair as we could make it.
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.85;">
                There were a lot of applications, and the competition was rigorous. In many
                cases the gap between one team and the next was very small. Twenty places
                is a hard cut, not a judgement on the rest. Not being on the list does not
                mean your submission was poor.
              </p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.85;">
                Whether a team was shortlisted or not, the idea is still yours. It came out
                of your time and your thinking, and Startathon ending is not a reason for it
                to end. Keep building it.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Observations -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 10px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                Two things worth carrying forward
              </p>
              <p style="margin:0 0 24px;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.75;">
                For a lot of you this was a first hackathon, and the same criteria had to
                apply to everyone. These are general observations from reading the whole
                pile, not comments on your submission.
              </p>
              ${renderObservations()}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:32px 36px 36px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.85;">
                Thank you for entering Startathon, and for the work you put into it.
                We are glad you showed up, and we hope to see what ${teamName} builds next.
              </p>
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
