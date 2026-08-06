import type { Announcement } from "./types";
import { timelineUpdateAnnouncement } from "./2026-07-31-timeline-update";
import { domainsOpenAnnouncement } from "./2026-08-06-domains-open";

export type { Announcement, AnnouncementRecipient } from "./types";

/**
 * Every announcement ever sent, newest last.
 *
 * Order matters only in that the notifier works through this list and sends the
 * first announcement that still has recipients, one per cron tick. Entries stay
 * here after they have drained -- their `active` flag is what keeps the
 * notifier's per-tick cost at a single no-op query once the list is done.
 */
export const ANNOUNCEMENTS: ReadonlyArray<Announcement> = [
  timelineUpdateAnnouncement,
  domainsOpenAnnouncement,
];
