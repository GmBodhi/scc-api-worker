import { getFollowUpEmail, getPaymentConfirmationEmail } from "../utils/templateLoader";

interface EmailOptions {
  to: string;
  toName: string;
  subject: string;
  html: string;
}

export class EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendFollowUpEmail(studentName: string, studentEmail: string): Promise<boolean> {
    const html = getFollowUpEmail({ studentName });

    return this.sendEmail({
      to: studentEmail,
      toName: studentName,
      subject: "Payment Reminder - Complete Your Registration",
      html
    });
  }

  async sendPaymentConfirmationEmail(studentName: string, studentEmail: string, studentId: string, transactionRef: string): Promise<boolean> {
    const html = getPaymentConfirmationEmail({
      studentName,
      studentId,
      transactionRef
    });

    return this.sendEmail({
      to: studentEmail,
      toName: studentName,
      subject: "🎉 Payment Confirmed - SCC Treasure Hunt Registration Complete!",
      html
    });
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "SCT Coding Club",
            email: "hello@sctcoding.club"
          },
          to: [
            {
              email: options.to,
              name: options.toName
            }
          ],
          subject: options.subject,
          htmlContent: options.html,
        }),
      });

      if (!response.ok) {
        console.error("Email send failed:", await response.text());
        return false;
      }

      console.log("Follow-up email sent to:", options.to);
      return true;
    } catch (error) {
      console.error("Email service error:", error);
      return false;
    }
  }
}
