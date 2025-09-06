interface PaymentConfirmationVariables {
  studentName: string;
  studentId: string;
  transactionRef: string;
}

export const paymentConfirmationTemplate = (variables: PaymentConfirmationVariables): string => {
  const { studentName, studentId, transactionRef } = variables;
  
  return `<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #28a745; margin: 0;">🎉 Payment Confirmed!</h2>
        <p style="color: #666; margin: 5px 0 0 0;">Your registration is now complete</p>
      </div>
      
      <p>Dear ${studentName},</p>
      
      <p>Great news! Your payment has been successfully verified and your registration is now confirmed.</p>
      
      <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h4 style="margin: 0 0 15px 0; color: #155724;">Registration Details</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; font-weight: bold;">Student ID:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;">${studentId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb; font-weight: bold;">Transaction Reference:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #c3e6cb;">${transactionRef}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Status:</td>
            <td style="padding: 8px 0; color: #28a745; font-weight: bold;">✅ PAID & CONFIRMED</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <h4 style="margin: 0 0 15px 0; color: #007bff;">📱 Your Event Ticket</h4>
        <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 10px 0;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${studentId}" 
               alt="QR Code for verification" 
               style="display: block; margin: 0 auto; width: 200px; height: 200px;" />
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Show this QR code at the venue for verification</p>
        </div>
        <p style="margin: 10px 0 0 0; font-weight: bold; color: #007bff;">Student ID: ${studentId}</p>
      </div>
      
      <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0;">
        <h4 style="margin: 0 0 15px 0; color: #007bff;">Event Information</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>Event Name:</strong> SCC Treasure Hunt 2025</li>
          <li><strong>Date:</strong> 21 September 2025</li>
          <li><strong>Time:</strong> 9:30 AM</li>
          <li><strong>Venue:</strong> 112 Seminar Hall, SCT</li>
          <li><strong>Registration Fee:</strong> Successfully Paid ✅</li>
        </ul>
      </div>
      
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #856404;">📋 Important Instructions</h4>
        <ul style="margin: 0; padding-left: 20px; color: #856404;">
          <li>Save this email or take a screenshot of your QR code</li>
          <li>Arrive at the venue 15 minutes before the event starts</li>
          <li>Show your QR code to event staff for verification</li>
          <li>Bring a valid ID for additional verification if needed</li>
          <li>Keep your Student ID handy: <strong>${studentId}</strong></li>
          <li>Check your email regularly for any event updates</li>
        </ul>
      </div>
      
      <p>If you have any questions or need assistance, please contact our support team with your Student ID.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>SCC Event Team</strong><br>
        Registration & Support
      </p>
    </div>
  </body>
</html>`;
};
