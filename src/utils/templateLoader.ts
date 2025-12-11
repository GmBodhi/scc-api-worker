import { followUpEmailTemplate } from '../templates/followup-email';
import { paymentConfirmationTemplate } from '../templates/payment-confirmation';
import { mentorshipProgramConfirmationTemplate } from '../templates/mentorship-program-confirmation';

export function getFollowUpEmail(variables: { studentName: string; studentId: string }): string {
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

