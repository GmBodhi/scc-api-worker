import { getStartathonDomainsEmail } from "../templates/startathon-domains";
import type { Announcement } from "./types";

/**
 * Announces the four published problem domains, now that idea submissions are
 * open. There are no fixed problem statements this year, so the domains are the
 * only framing teams get -- this email is what points them at the pages that
 * carry it, and at the form itself before the Aug 12 deadline.
 *
 * Goes to the waitlist as well: registration is still open, so someone who
 * never converted can still act on this, and the domains are the strongest
 * reason left to.
 */
export const domainsOpenAnnouncement: Announcement = {
  id: "2026-08-06-domains-open",
  subject: "Startathon 2026: submissions are open, and here are the domains",
  active: true,
  includeWaitlist: true,
  render: ({ name, hasAccount }) =>
    getStartathonDomainsEmail({ name, hasAccount }),
};
