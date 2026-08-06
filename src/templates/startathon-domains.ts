const CLIENT_URL = "https://startathon.sctcoding.club";

/**
 * UTM tags on every link, matching the scheme the client already reads off the
 * query string (see startathon-registration-open.ts).
 */
const UTM =
  "utm_source=email&utm_medium=email&utm_campaign=domains-submissions-open";

const DOMAINS_URL = `${CLIENT_URL}/domains?${UTM}`;
const EXPECTATIONS_URL = `${CLIENT_URL}/domains?${UTM}#expectations`;
const FORMAT_URL = `${CLIENT_URL}/format?${UTM}`;
const SUBMISSION_URL = `${CLIENT_URL}/submission?${UTM}`;
const SIGNUP_URL = `${CLIENT_URL}/signup?${UTM}`;
const DASHBOARD_URL = `${CLIENT_URL}/?${UTM}`;

/**
 * Same group the timeline-update announcement pointed people at, so the two
 * emails don't split the audience across two chats.
 */
const WHATSAPP_URL = "https://chat.whatsapp.com/Cve43TFFjy0BQ9i5kgoWuA";

function domainUrl(slug: string): string {
  return `${CLIENT_URL}/domains/${slug}?${UTM}`;
}

/**
 * The four published domains. `title` and `outcome` are copied verbatim from
 * the client's src/lib/domains.js, which is the single source the picker, the
 * briefs and the in-form recap all render from.
 *
 * `outcome` rather than the longer intro copy on purpose: it is the bare
 * phrase the site itself uses wherever the four are listed side by side (see
 * BriefRecap.jsx, "outcome-first: because that is how a team picks one"). A
 * paraphrase here would drift from the pages the links land on.
 */
const DOMAINS: ReadonlyArray<{
  num: string;
  slug: string;
  title: string;
  outcome: string;
}> = [
  {
    num: "01",
    slug: "preventive-health",
    title: "Preventive health &amp; everyday care",
    outcome:
      "Improving health behaviour or care outside a healthcare facility.",
  },
  {
    num: "02",
    slug: "intelligent-operations",
    title: "Intelligent operations &amp; case work",
    outcome:
      "Reducing delay, error and manual effort in complex case-based work.",
  },
  {
    num: "03",
    slug: "inclusive-access",
    title: "Inclusive access to essential services",
    outcome: "Helping people understand and successfully use an essential service.",
  },
  {
    num: "04",
    slug: "digital-trust",
    title: "Digital trust &amp; scam resilience",
    outcome: "Helping people resist and recover from digital deception.",
  },
];

/**
 * Upcoming milestones only. "Idea submissions open" is deliberately absent --
 * that date has passed, and this email's whole point is that it has.
 */
const TIMELINE: ReadonlyArray<{
  date: string;
  label: string;
  emphasis?: boolean;
}> = [
  { date: "AUG 12", label: "Submissions close and payment due" },
  { date: "AUG 15", label: "Shortlisted teams announced" },
  { date: "SEP 5&ndash;6", label: "Startathon.", emphasis: true },
];

interface StartathonDomainsData {
  name: string;
  /**
   * False for waitlist recipients, who have no account, no team and no
   * submission form to open yet. Everything downstream of registering differs
   * for them, so the CTA, the checklist and the footer all branch on this
   * rather than sending them at a page that would bounce them to /login.
   */
  hasAccount: boolean;
}

/**
 * Names are raw user input on both sides (startathon_users.name is bound
 * unmodified at signup; startathon_wl.name comes straight off the waitlist
 * form), so it is escaped before landing in the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDomainRows(): string {
  return DOMAINS.map(({ num, slug, title, outcome }, index) => {
    const isLast = index === DOMAINS.length - 1;

    return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="34" style="vertical-align:top;padding-top:3px;">
                    <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:rgba(200,255,0,0.55);">${num}</span>
                  </td>
                  <td>
                    <a href="${domainUrl(slug)}" style="text-decoration:none;">
                      <span style="display:block;font-size:16px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1.25;">${title}</span>
                    </a>
                    <p style="margin:7px 0 0;font-size:12px;color:rgba(255,255,255,0.38);line-height:1.75;">
                      ${outcome}
                    </p>
                  </td>
                </tr>
              </table>${
                isLast
                  ? ""
                  : `
              <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
              <div style="height:1px;background:rgba(255,255,255,0.06);line-height:1px;font-size:0;">&nbsp;</div>
              <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`
              }`;
  }).join("");
}

function renderTimelineRows(): string {
  return TIMELINE.map(({ date, label, emphasis }, index) => {
    const isLast = index === TIMELINE.length - 1;

    return `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:${emphasis ? "17px" : "13px"};font-weight:800;color:${emphasis ? "#C8FF00" : "#ffffff"};letter-spacing:0.02em;white-space:nowrap;">${date}</td>
                  <td align="right" style="font-size:${emphasis ? "14px" : "12px"};font-weight:${emphasis ? "700" : "400"};color:${emphasis ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)"};padding-left:12px;">${label}</td>
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

/**
 * What the submission form actually asks for, in the order the steps run.
 * Kept short deliberately -- the form itself carries the full guidance, and
 * anything restated here is a second copy that can go stale.
 */
const SUBMISSION_ASKS: ReadonlyArray<string> = [
  "A title, and a few sentences on what you&rsquo;re building and who it&rsquo;s for",
  "Evidence the problem is real.",
  "A link to a pitch deck",
  "A sixty-second video with everyone on your team in it, saying why you care",
  "Anything you&rsquo;ve already built on this idea, declared",
];

function renderChecklist(items: ReadonlyArray<string>): string {
  return items
    .map(
      (item) => `
                <tr>
                  <td width="16" style="vertical-align:top;padding-top:7px;">
                    <div style="width:4px;height:4px;border-radius:50%;background:rgba(200,255,0,0.55);line-height:4px;font-size:0;">&nbsp;</div>
                  </td>
                  <td style="padding-bottom:9px;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.7;">
                    ${item}
                  </td>
                </tr>`,
    )
    .join("");
}

/**
 * The gate between reading this email and having a submission in. Account
 * holders are somewhere inside it already; waitlisters start at step one.
 */
const ACCOUNT_STEPS: ReadonlyArray<string> = [
  "Three or four of you, all with accounts",
  "The &#8377;100 team fee paid and confirmed (&#8377;90 with a referral code)",
  "Your leader hits submit. You can keep editing until the deadline.",
];

const WAITLIST_STEPS: ReadonlyArray<string> = [
  "Create your account, then start a team or join one. Three or four of you.",
  "Pay the &#8377;100 team fee (&#8377;90 with a referral code) and get it confirmed",
  "Your leader hits submit. You can keep editing until the deadline.",
];

export function getStartathonDomainsEmail(data: StartathonDomainsData): string {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || "there");
  const { hasAccount } = data;

  const ctaUrl = hasAccount ? SUBMISSION_URL : SIGNUP_URL;
  const ctaLabel = hasAccount ? "Open the submission form" : "Create your account";
  const ctaHeading = hasAccount
    ? "Submissions are open."
    : "Registration is open, and so are submissions.";
  const steps = hasAccount ? ACCOUNT_STEPS : WAITLIST_STEPS;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Startathon problem domains</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#000000;">
    Submissions are open. Four domains, no fixed problem statements, and you have until Aug 12.
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
                Submissions open &middot; close Aug 12
              </p>
              <h1 style="margin:0 0 16px;font-size:38px;font-weight:900;color:#ffffff;line-height:0.92;letter-spacing:-0.03em;">
                Four domains.<br />Bring the problem.
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.8;">
                ${firstName}, submissions are open. Startathon doesn&rsquo;t hand you a problem<br />
                statement. The four domains below are places to look. Pick the one your<br />
                problem sits in, then show us you understand the people it affects.<br />
                You don&rsquo;t have to use AI. Let the problem decide the technology,<br />
                not the other way around.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- Domains -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 24px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                Opportunity areas &middot; not problem statements
              </p>
              ${renderDomainRows()}
            </td>
          </tr>

          <!-- Read the briefs -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
                <tr>
                  <td style="padding:24px 26px;">
                    <h2 style="margin:0 0 10px;font-size:17px;font-weight:900;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;">
                      Read the brief before you write.
                    </h2>
                    <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.38);line-height:1.75;">
                      Each of the four answers the same five questions in the same order.
                      The outcome it improves, who has the problem, which problems fit,
                      how success is measured, and which ideas won&rsquo;t survive judging.
                      Six expectations sit above all four and apply to everything you send us.
                    </p>
                    <a href="${DOMAINS_URL}" style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#C8FF00;text-decoration:none;">
                      Open the domains &rarr;
                    </a>
                    <span style="display:inline-block;width:18px;">&nbsp;</span>
                    <a href="${EXPECTATIONS_URL}" style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-decoration:none;">
                      The six expectations &rarr;
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

          <!-- Primary CTA: the submission itself -->
          <tr>
            <td style="padding:32px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(200,255,0,0.20);overflow:hidden;">
                <tr>
                  <td style="padding:0;line-height:0;font-size:0;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(200,255,0,0.40),transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 24px;">
                    <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;text-align:center;">
                      ${ctaHeading}
                    </h2>
                    <p style="margin:0 0 22px;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;text-align:center;">
                      Twenty teams get shortlisted from the applications.<br />
                      Your score here only decides the shortlist. Once the twenty<br />
                      are in, everyone starts the main event on zero.
                    </p>

                    <p style="margin:0 0 12px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                      What the form asks for
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${renderChecklist(SUBMISSION_ASKS)}
                    </table>

                    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>

                    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>

                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td style="background-color:#C8FF00;border-radius:8px;">
                          <a href="${ctaUrl}" style="display:inline-block;text-decoration:none;padding:14px 30px;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000000;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.28);line-height:1.7;text-align:center;">
                      Nobody is asking for detailed architecture, feature lists, polished<br />
                      UI or financial projections. None of it is scored.
                      <a href="${FORMAT_URL}" style="color:rgba(255,255,255,0.45);text-decoration:underline;">How judging works</a>.
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

          <!-- What happens next -->
          <tr>
            <td style="padding:32px 36px 28px;">
              <p style="margin:0 0 22px;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.22);font-weight:500;">
                What happens next
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

          <!-- WhatsApp -->
          <tr>
            <td style="padding:28px 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:22px 26px;">
                    <p style="margin:0 0 8px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(37,211,102,0.8);font-weight:500;">
                      Faster than email
                    </p>
                    <h2 style="margin:0 0 8px;font-size:16px;font-weight:900;color:#ffffff;line-height:1.25;letter-spacing:-0.02em;">
                      Join the official WhatsApp group.
                    </h2>
                    <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.38);line-height:1.75;">
                      Deadline reminders and schedule changes go there first, along with
                      answers to whatever everyone else is asking. We only email you when
                      something actually changes, so the group is the faster way to keep up.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.35);border-radius:6px;">
                          <a href="${WHATSAPP_URL}" style="display:inline-block;text-decoration:none;padding:11px 22px;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#25D366;">
                            Join the group
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
                startathon.sctcoding.club
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
                ${
                  hasAccount
                    ? "You have a Startathon 2026 account. We only email you when something about the event actually changes."
                    : "You joined the Startathon 2026 waitlist. We only email you when something about the event actually changes."
                }
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
