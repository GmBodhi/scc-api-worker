import { EmailService } from "./services/emailService";
import { notifyStartathonAnnouncements } from "./services/startathonAnnouncementNotifier";
import { notifyStartathonResults } from "./services/startathonResultNotifier";
import { notifyStartathonSelectionFee } from "./services/startathonSelectionFeeNotifier";
import { sweepStartathonSelectionPayments } from "./services/startathonSelectionPayments";
import { syncStartathonRosterSheet } from "./services/startathonRosterSheet";
import { notifyStartathonWaitlist } from "./services/startathonWaitlistNotifier";

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** The fast schedule, which runs the selection sweep and nothing else. */
export const SELECTION_SWEEP_CRON = "*/5 * * * *";

export async function handleScheduled(env: Env, cron?: string): Promise<void> {
  // Runs on both schedules: on the fast one it is the only job, on the slow
  // one it is a second chance for anything the five-minute pass missed.
  try {
    await sweepStartathonSelectionPayments(env);
  } catch (error) {
    console.error("Error in Startathon selection payment sweep:", error);
  }

  // Everything below is half-hourly work. The fast schedule stops here: these
  // jobs draw on a shared daily email budget that is sized for 48 ticks a day,
  // not 288.
  if (cron === SELECTION_SWEEP_CRON) {
    return;
  }

  // Each job is isolated: the follow-up check returns early in several places
  // and either job throwing must not stop the other from running.
  await handleFollowUpEmails(env);

  // Ahead of the other blast jobs because they share one daily email budget and
  // this one is the only one that is time-critical: a shortlisting result that
  // arrives days late is worse than a waitlist or announcement mail that does.
  try {
    await notifyStartathonResults(env);
  } catch (error) {
    console.error("Error in Startathon results notifier:", error);
  }

  // The organisers' sheet, refreshed wholesale. This is the only path that
  // catches a payment confirmed by the bank webhook or by the sweep, since
  // neither runs inside a request that could have pushed the change itself.
  try {
    await syncStartathonRosterSheet(env);
  } catch (error) {
    console.error("Error syncing Startathon roster sheet:", error);
  }

  // Ahead of the waitlist and announcement jobs for the same reason the results
  // blast is: it carries a deadline, and a bill that arrives after the date it
  // names is worse than a late announcement.
  try {
    await notifyStartathonSelectionFee(env);
  } catch (error) {
    console.error("Error in Startathon selection fee notifier:", error);
  }

  try {
    await notifyStartathonWaitlist(env);
  } catch (error) {
    console.error("Error in Startathon waitlist notifier:", error);
  }

  try {
    await notifyStartathonAnnouncements(env);
  } catch (error) {
    console.error("Error in Startathon announcement notifier:", error);
  }
}

async function handleFollowUpEmails(env: Env): Promise<void> {
  console.log("Running scheduled follow-up email check...");

  try {
    // Calculate the timestamp for 20 minutes ago
    const twentyMinutesAgo = new Date(
      Date.now() - 20 * 60 * 1000,
    ).toISOString();

    // Find students who:
    // 1. Have status 'pending'
    // 2. Were created more than 10 minutes ago
    // 3. Haven't received a follow-up email yet
    const pendingStudents = await env.EVENTS_DB.prepare(
      `
        SELECT s.id, s.name, s.email, s.createdAt 
        FROM students s
        LEFT JOIN followup_emails fe ON s.id = fe.student_id
        WHERE s.status = 'pending' 
        AND s.createdAt <= ?
        AND fe.id IS NULL
      `,
    )
      .bind(twentyMinutesAgo)
      .all();

    if (!pendingStudents.results || pendingStudents.results.length === 0) {
      console.log("No students found requiring follow-up emails.");
      return;
    }

    console.log(
      `Found ${pendingStudents.results.length} students requiring follow-up emails.`,
    );

    const emailService = new EmailService(env.BREVO_API_KEY);

    for (const studentRecord of pendingStudents.results) {
      const student: Student = {
        id: studentRecord.id as string,
        name: studentRecord.name as string,
        email: studentRecord.email as string,
        createdAt: studentRecord.createdAt as string,
      };
      try {
        console.log(
          `Sending follow-up email to ${student.name} (${student.email})`,
        );

        // Send the follow-up email
        const emailSent = await emailService.sendFollowUpEmail(
          student.name,
          student.email,
          student.id,
        );

        if (emailSent) {
          // Record that we sent the email
          const emailId = `EMAIL_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

          await env.EVENTS_DB.prepare(
            `
              INSERT INTO followup_emails (id, student_id, email_sent_at, email_type)
              VALUES (?, ?, ?, ?)
            `,
          )
            .bind(
              emailId,
              student.id,
              new Date().toISOString(),
              "payment_reminder",
            )
            .run();

          console.log(
            `Follow-up email sent and recorded for student ${student.id}`,
          );
        } else {
          console.error(
            `Failed to send follow-up email to student ${student.id}`,
          );
        }

        // Add small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error sending follow-up email to student ${student.id}:`,
          error,
        );
      }
    }

    console.log("Scheduled follow-up email check completed.");
  } catch (error) {
    console.error("Error in scheduled follow-up email handler:", error);
  }
}
