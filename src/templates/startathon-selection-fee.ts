const CLIENT_URL = "https://startathon.sctcoding.club";

const UTM = "utm_source=email&utm_medium=email&utm_campaign=selection-fee";

const DASHBOARD_URL = `${CLIENT_URL}/?${UTM}`;

/** Where logistics land first, same group the accepted email pushed. */
const WHATSAPP_URL = "https://chat.whatsapp.com/Cve43TFFjy0BQ9i5kgoWuA";

/** Per head, in rupees. Mirrors STARTATHON_SELECTION_FEE in src/types.ts. */
const FEE_PER_HEAD = 250;

/**
 * The stated deadline, in the two forms the copy needs. Held here rather than
 * derived so the pill, the sentence and the timeline row can never disagree.
 */
const DEADLINE_SHORT = "AUG 27";
const DEADLINE_LONG = "Wednesday, August 27";

const TIMELINE: ReadonlyArray<{
  date: string;
  label: string;
  emphasis?: boolean;
}> = [
  { date: DEADLINE_SHORT, label: "Fee due" },
  { date: "SEP 5 &amp; 6", label: "Startathon.", emphasis: true },
];

export interface StartathonSelectionFeeData {
  name: string;
  teamName: string;
  /** Head count on the team, which is what the team's total is priced on. */
  teamSize: number;
  /** Leaders get the bulk-payment paragraph; members do not. */
  isLeader: boolean;
}

/**
 * Team and member names are raw user input (bound unmodified at signup and at
 * team creation), so they are escaped before reaching the markup.
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
      : "font-size:12px;color:#c9c9c9;";

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
              <div style="height:1px;background:rgba(255,255,255,0.12);line-height:1px;font-size:0;">&nbsp;</div>
              <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>`
              }`;
  }).join("");
}

/**
 * The selection fee mail: what is owed, by when, and where to pay it.
 *
 * Sent to every member of a shortlisted team rather than leaders alone,
 * because the fee is per head and the payment endpoint accepts any member —
 * a member who wants to settle their own ₹250 should not have to hear about
 * it second-hand.
 *
 * The amount is stated twice on purpose: per head, which is what a member
 * pays, and as the team total, which is what a leader paying in one transfer
 * needs. Everything else is deliberately thin — this mail has one job.
 */
export function getStartathonSelectionFeeEmail(
  data: StartathonSelectionFeeData,
): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const teamName = escapeHtml(data.teamName.trim());
  const teamSize = Math.max(1, data.teamSize);
  const teamTotal = FEE_PER_HEAD * teamSize;

  const headCountLabel = teamSize === 1 ? "1 person" : `${teamSize} people`;

  // Only the leader is told about the bulk option, because only a leader is
  // likely to be paying for other people. A member reading "you can pay for
  // everyone" would be true but unhelpful — the money is not theirs to move.
  const bulkBlock = data.isLeader
    ? `
          <!-- Leader-only: the one-transfer option -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px 32px;background-color:#0a0a0a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:1px;">
                    <span style="font-size:12px;color:#C8FF00;font-weight:700;">&#8377;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">You can pay for the whole team at once</p>
                    <p style="margin:0;font-size:12px;color:#bfbfbf;line-height:1.65;">
                      One transfer of &#8377;${teamTotal} covers all ${headCountLabel},
                      and you tick off who it pays for when you submit the reference.
                      Or leave it to each person to pay their own &#8377;${FEE_PER_HEAD} &mdash;
                      both settle the same bill.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!-- Dark-only declaration. Without this, Apple Mail treats the mail as
       colour-scheme-unaware and remaps it against the device setting, which is
       how a black email arrives looking light on an iPhone. "only dark" is the
       part that matters: plain "dark" still permits the client to adapt. -->
  <meta name="color-scheme" content="only dark" />
  <meta name="supported-color-schemes" content="only dark" />
  <title>Startathon: your seat, and the fee that holds it</title>
  <style>
    :root {
      color-scheme: only dark;
      supported-color-schemes: only dark;
    }
    /* Gmail (Android/iOS app) and Outlook rewrite colours in their own dark
       themes and prefix the body with these attributes when they do. Repeating
       the palette against those prefixes keeps the surfaces black instead of
       the muddy grey the automatic remap produces. */
    [data-ogsc] .st-page, u + .body .st-page { background-color: #000000 !important; }
    [data-ogsc] .st-card, u + .body .st-card { background-color: #0a0a0a !important; }
    [data-ogsc] .st-panel, u + .body .st-panel { background-color: #0d0d0d !important; }
  </style>
</head>
<body class="body" bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    &#8377;${FEE_PER_HEAD} per person, due ${DEADLINE_LONG}. Pay from your dashboard to hold ${teamName}&rsquo;s place.
  </div>

  <table class="st-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr>
      <td class="st-page" align="center" bgcolor="#000000" style="padding:40px 16px;background-color:#000000;">

        <table class="st-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="max-width:580px;background-color:#0a0a0a;border-radius:14px;border:1px solid rgba(255,255,255,0.16);overflow:hidden;">

          <!-- Top lime hairline accent -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0;line-height:0;font-size:0;background-color:#0a0a0a;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.35),transparent);"></div>
            </td>
          </tr>

          <!-- Header: logo row -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:28px 36px 0;background-color:#0a0a0a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">
                      Startathon<span style="color:#888888;">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(200,255,0,0.08);border:1px solid rgba(200,255,0,0.25);border-radius:50px;padding:4px 10px;">
                      <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
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
            <td bgcolor="#0a0a0a" style="padding:40px 36px 32px;background-color:#0a0a0a;">
              <p style="margin:0 0 14px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                Shortlisted &middot; Fee due ${DEADLINE_SHORT}
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                &#8377;${FEE_PER_HEAD}<br />each.
              </h1>
              <p style="margin:0;font-size:13px;color:#c9c9c9;line-height:1.8;">
                ${firstName}, this is the participation fee we told you about when
                <strong style="color:#ffffff;font-weight:700;">${teamName}</strong> was shortlisted.
                &#8377;${FEE_PER_HEAD} per person &mdash; &#8377;${teamTotal} for your ${headCountLabel} &mdash;
                and it is what holds your place in the twenty.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px;background-color:#0a0a0a;">
              <div style="height:1px;background:rgba(255,255,255,0.14);"></div>
            </td>
          </tr>

          <!-- How to pay -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:32px 36px 28px;background-color:#0a0a0a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#10003;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Pay from your dashboard</p>
                    <p style="margin:0;font-size:12px;color:#bfbfbf;line-height:1.65;">
                      Open the dashboard, scan the UPI code, then paste the
                      transaction reference back into the page. Your status turns
                      confirmed on its own once the payment reaches us &mdash;
                      usually within minutes, and there is nothing to email us.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${bulkBlock}
          <!-- The deadline, and what missing it costs -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px 32px;background-color:#0a0a0a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="18" style="vertical-align:top;padding-top:2px;">
                    <span style="font-size:11px;color:#C8FF00;">&#8250;</span>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">${DEADLINE_LONG}</p>
                    <p style="margin:0;font-size:12px;color:#bfbfbf;line-height:1.65;">
                      Unpaid seats go to waitlisted teams after that date. There is
                      a real queue behind you, so if something about the fee is a
                      problem, reply to this email before the deadline rather than
                      after it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px;background-color:#0a0a0a;">
              <div style="height:1px;background:rgba(255,255,255,0.14);"></div>
            </td>
          </tr>

          <!-- Timeline -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:32px 36px;background-color:#0a0a0a;">
              <p style="margin:0 0 22px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:#9d9d9d;font-weight:500;">
                What happens when
              </p>
              ${renderTimelineRows()}
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px 36px;background-color:#0a0a0a;">
              <table class="st-panel" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d0d0d" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(200,255,0,0.20);overflow:hidden;">
                <tr>
                  <td bgcolor="#0a0a0a" style="padding:0;line-height:0;font-size:0;background-color:#0a0a0a;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.40),transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td bgcolor="#0a0a0a" style="padding:28px 28px 24px;text-align:center;background-color:#0a0a0a;">
                    <p style="margin:0 0 6px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#C8FF00;font-weight:500;">
                      Do this now
                    </p>
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">
                      Hold your seat.
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:#bfbfbf;line-height:1.7;">
                      It takes about a minute, and the page shows you<br />
                      exactly who on ${teamName} has paid and who hasn&rsquo;t.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="background-color:#C8FF00;border-radius:8px;">
                          <a href="${DASHBOARD_URL}" style="display:inline-block;text-decoration:none;padding:14px 30px;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                            Pay &#8377;${FEE_PER_HEAD}
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
            <td bgcolor="#0a0a0a" style="padding:0 36px 36px;text-align:center;background-color:#0a0a0a;">
              <a href="${WHATSAPP_URL}" style="display:inline-block;text-decoration:none;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);border-radius:6px;padding:11px 22px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#dadada;">
                Join the WhatsApp group
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px;background-color:#0a0a0a;">
              <div style="height:1px;background:rgba(255,255,255,0.12);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:24px 36px;background-color:#0a0a0a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:10px;color:#898989;letter-spacing:0.05em;">
                      Organized by <strong style="color:#acacac;font-weight:600;">Coding Club, SCTCE</strong>
                    </p>
                    <p style="margin:0;font-size:10px;color:#767676;letter-spacing:0.04em;">
                      Sree Chitra Thirunal College of Engineering &middot; Thiruvananthapuram, Kerala
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <a href="mailto:hello@sctcoding.club" style="font-size:10px;color:#9d9d9d;text-decoration:none;letter-spacing:0.04em;">
                      hello@sctcoding.club
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Why you got this -->
          <tr>
            <td bgcolor="#0a0a0a" style="padding:0 36px 24px;text-align:center;background-color:#0a0a0a;">
              <p style="margin:0;font-size:10px;color:#6c6c6c;letter-spacing:0.04em;">
                You are on a Startathon 2026 team that was shortlisted. This is the participation fee for that place.
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
