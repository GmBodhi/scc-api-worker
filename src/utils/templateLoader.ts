import { followUpEmailTemplate } from '../templates/followup-email';
import { paymentConfirmationTemplate } from '../templates/payment-confirmation';

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

