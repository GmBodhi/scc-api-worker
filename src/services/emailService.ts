import {
  getFollowUpEmail,
  getPaymentConfirmationEmail,
  getMentorshipProgramConfirmationEmail,
  getPasswordResetEmail,
  getWelcomeEmail,
  getHackerRankPaymentConfirmationEmail,
  getMcpWorkshopConfirmationEmail,
  getStartathonWaitlistConfirmationEmail,
} from "../utils/templateLoader";
import { getStartathonAccountSetupInviteEmail } from "../templates/startathon-account-setup";
import { getStartathonInviteReceivedEmail } from "../templates/startathon-invite-received";
import { getStartathonPasswordResetEmail } from "../templates/startathon-password-reset";
import { getStartathonPaymentConfirmationEmail } from "../templates/startathon-payment-confirmation";

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

  async sendFollowUpEmail(
    studentName: string,
    studentEmail: string,
    studentId: string,
  ): Promise<boolean> {
    const html = getFollowUpEmail({ studentName, studentId });

    return this.sendEmail({
      to: studentEmail,
      toName: studentName,
      subject: "Payment Reminder - Complete Your Registration",
      html,
    });
  }

  async sendPaymentConfirmationEmail(
    studentName: string,
    studentEmail: string,
    studentId: string,
    transactionRef: string,
  ): Promise<boolean> {
    const html = getPaymentConfirmationEmail({
      studentName,
      studentId,
      transactionRef,
    });

    return this.sendEmail({
      to: studentEmail,
      toName: studentName,
      subject:
        "🎉 Payment Confirmed - SCC Treasure Hunt Registration Complete!",
      html,
    });
  }

  async sendMentorshipProgramConfirmationEmail(
    studentName: string,
    studentEmail: string,
    studentId: string,
    experienceLevel: string,
  ): Promise<boolean> {
    const html = getMentorshipProgramConfirmationEmail({
      studentName,
      studentId,
      experienceLevel,
    });

    return this.sendEmail({
      to: studentEmail,
      toName: studentName,
      subject: "🎉 Registration Confirmed - Mentorship Program 2025",
      html,
    });
  }

  async sendPasswordResetEmail(
    name: string,
    email: string,
    resetToken: string,
    expiresIn: string = "15 minutes",
    isFirstTimeSetup: boolean = false,
  ): Promise<boolean> {
    const html = getPasswordResetEmail({
      name,
      resetToken,
      expiresIn,
      isFirstTimeSetup,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: isFirstTimeSetup
        ? "🔐 Complete Your Account Setup - SCT Coding Club"
        : "🔐 Password Reset Request - SCT Coding Club",
      html,
    });
  }
  async sendWelcomeEmail(name: string, email: string): Promise<boolean> {
    const html = getWelcomeEmail({
      name,
      email,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🎉 Welcome to SCT Coding Club!",
      html,
    });
  }

  async sendHackerRankPaymentConfirmationEmail(
    name: string,
    email: string,
    registrationId: string,
    transactionRef: string,
  ): Promise<boolean> {
    const html = getHackerRankPaymentConfirmationEmail({
      name,
      registrationId,
      transactionRef,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🎉 Payment Confirmed - HackerRank Event Registration",
      html,
    });
  }

  async sendMcpWorkshopConfirmationEmail(
    name: string,
    email: string,
    registrationId: string,
  ): Promise<boolean> {
    const html = getMcpWorkshopConfirmationEmail({ name, registrationId });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🎉 Registration Confirmed — MCP Workshop, March 14",
      html,
    });
  }

  async sendStartathonWaitlistEmail(
    name: string,
    email: string,
    waitlistId: string,
  ): Promise<boolean> {
    const html = getStartathonWaitlistConfirmationEmail({ name, waitlistId });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "You're on the list. — Startathon 2026",
      html,
    });
  }

  async sendStartathonAccountSetupInviteEmail(
    name: string,
    email: string,
    teamName: string,
    invitedByName: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = getStartathonAccountSetupInviteEmail({
      name,
      teamName,
      invitedByName,
      resetToken,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `🚀 You're invited to join "${teamName}" on Startathon`,
      html,
    });
  }

  async sendStartathonInviteReceivedEmail(
    name: string,
    email: string,
    teamName: string,
    invitedByName: string,
  ): Promise<boolean> {
    const html = getStartathonInviteReceivedEmail({
      name,
      teamName,
      invitedByName,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `🚀 You're invited to join "${teamName}" on Startathon`,
      html,
    });
  }

  async sendStartathonPasswordResetEmail(
    name: string,
    email: string,
    resetToken: string,
  ): Promise<boolean> {
    const html = getStartathonPasswordResetEmail({ name, resetToken });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🔐 Reset your Startathon password",
      html,
    });
  }

  async sendStartathonPaymentConfirmationEmail(
    name: string,
    email: string,
    teamName: string,
    teamId: string,
    transactionRef: string,
  ): Promise<boolean> {
    const html = getStartathonPaymentConfirmationEmail({
      name,
      teamName,
      teamId,
      transactionRef,
    });

    return this.sendEmail({
      to: email,
      toName: name,
      subject: "🎉 Startathon payment confirmed!",
      html,
    });
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "SCT Coding Club",
            email: "hello@sctcoding.club",
          },
          to: [
            {
              email: options.to,
              name: options.toName,
            },
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
