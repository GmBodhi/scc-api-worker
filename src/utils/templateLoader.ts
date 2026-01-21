import { followUpEmailTemplate } from "../templates/followup-email";
import { paymentConfirmationTemplate } from "../templates/payment-confirmation";
import { mentorshipProgramConfirmationTemplate } from "../templates/mentorship-program-confirmation";
import { getPasswordResetEmail as passwordResetTemplate } from "../templates/password-reset";
import { getWelcomeEmail as welcomeEmailTemplate } from "../templates/welcome-email";
import { getHackerRankPaymentConfirmationEmail as hackerRankPaymentTemplate } from "../templates/hackerrank-payment-confirmation";
export function getFollowUpEmail(variables: {
  studentName: string;
  studentId: string;
}): string {
  return followUpEmailTemplate(variables);
}

export function getPaymentConfirmationEmail(variables: {
  studentName: string;
  studentId: string;
  transactionRef: string;
}): string {
  return paymentConfirmationTemplate(variables);
}

export function getMentorshipProgramConfirmationEmail(variables: {
  studentName: string;
  studentId: string;
  experienceLevel: string;
}): string {
  return mentorshipProgramConfirmationTemplate(variables);
}

export function getPasswordResetEmail(variables: {
  name: string;
  resetToken: string;
  expiresIn: string;
}): string {
  return passwordResetTemplate(variables);
}

export function getWelcomeEmail(variables: {
  name: string;
  email: string;
}): string {
  return welcomeEmailTemplate(variables);
}

export function getHackerRankPaymentConfirmationEmail(variables: {
  name: string;
  registrationId: string;
  transactionRef: string;
}): string {
  return hackerRankPaymentTemplate(variables);
}
