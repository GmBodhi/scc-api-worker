export interface AnnouncementRecipient {
  name: string;
  /**
   * True for a startathon_users row, false for a startathon_wl one.
   *
   * Templates branch on it because everything past "read this" differs: a
   * waitlister has no dashboard, no team and no submission form, so a CTA
   * aimed at an account holder would land them on a page that bounces them to
   * /login.
   */
  hasAccount: boolean;
}

/**
 * A one-off broadcast to Startathon account holders, and optionally to the
 * waitlist alongside them.
 *
 * Announcements are code, not data: the copy is a template module and the
 * registry in ./index.ts is the whole catalogue. The database stores only which
 * recipients have already received which announcement (see migrations 0025 and
 * 0028), so shipping a new one is a template file, a registry entry, and a
 * deploy.
 *
 * This type lives apart from the registry so announcement modules can import it
 * without importing the registry that imports them back.
 */
export interface Announcement {
  /**
   * Stable slug written into both delivery ledgers' announcement_id.
   *
   * Never reuse or rename one after it has gone out: the ledgers are keyed on
   * it, so a changed id makes every past recipient look unsent and the blast
   * goes out a second time.
   */
  id: string;
  subject: string;
  /**
   * The cron only picks up announcements with this set. Because the send drains
   * from a deploy, flipping this to true and deploying *is* the send trigger.
   * Leave it false until the copy is final.
   */
  active: boolean;
  /**
   * Whether the waitlist receives this too.
   *
   * Off by default in spirit: most announcements are about a team, a payment or
   * a submission, none of which a waitlister has. Turn it on only for news that
   * is genuinely for anyone who ever raised their hand. The notifier dedupes
   * both ways, so a waitlister who has since made an account is never mailed
   * twice.
   */
  includeWaitlist: boolean;
  render(recipient: AnnouncementRecipient): string;
}
