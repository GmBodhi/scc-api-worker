import { getStartathonTimelineUpdateEmail } from "../templates/startathon-timeline-update";
import type { Announcement } from "./types";

/**
 * Announces the revised Startathon schedule (event moved to Sep 5-6) and the
 * new official WhatsApp group, which becomes the first channel for schedule
 * and logistics updates from here on.
 */
export const timelineUpdateAnnouncement: Announcement = {
  id: "2026-07-31-timeline-update",
  subject: "Startathon 2026: New Schedule & Official WhatsApp Group",
  active: false,
  // Accounts only: the copy assumes a dashboard and a registered team.
  includeWaitlist: false,
  render: ({ name }) => getStartathonTimelineUpdateEmail({ name }),
};
