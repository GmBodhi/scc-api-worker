import { EmailService } from "./services/emailService";

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function handleScheduled(env: Env): Promise<void> {
  console.log("Running scheduled follow-up email check...");

  try {
    // Calculate the timestamp for 20 minutes ago
    const twentyMinutesAgo = new Date(
      Date.now() - 20 * 60 * 1000
    ).toISOString();

    // Find students who:
    // 1. Have status 'pending'
    // 2. Were created more than 10 minutes ago
    // 3. Haven't received a follow-up email yet
    const pendingStudents = await env.db
      .prepare(
        `
        SELECT s.id, s.name, s.email, s.createdAt 
        FROM students s
        LEFT JOIN followup_emails fe ON s.id = fe.student_id
        WHERE s.status = 'pending' 
        AND s.createdAt <= ?
        AND fe.id IS NULL
      `
      )
      .bind(twentyMinutesAgo)
      .all();

    if (!pendingStudents.results || pendingStudents.results.length === 0) {
      console.log("No students found requiring follow-up emails.");
      return;
    }

    console.log(
      `Found ${pendingStudents.results.length} students requiring follow-up emails.`
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
          `Sending follow-up email to ${student.name} (${student.email})`
        );

        // Send the follow-up email
        const emailSent = await emailService.sendFollowUpEmail(
          student.name,
          student.email,
          student.id
        );

        if (emailSent) {
          // Record that we sent the email
          const emailId = `EMAIL_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;

          await env.db
            .prepare(
              `
              INSERT INTO followup_emails (id, student_id, email_sent_at, email_type)
              VALUES (?, ?, ?, ?)
            `
            )
            .bind(
              emailId,
              student.id,
              new Date().toISOString(),
              "payment_reminder"
            )
            .run();

          console.log(
            `Follow-up email sent and recorded for student ${student.id}`
          );
        } else {
          console.error(
            `Failed to send follow-up email to student ${student.id}`
          );
        }

        // Add small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error sending follow-up email to student ${student.id}:`,
          error
        );
      }
    }

    console.log("Scheduled follow-up email check completed.");
  } catch (error) {
    console.error("Error in scheduled follow-up email handler:", error);
  }
}
