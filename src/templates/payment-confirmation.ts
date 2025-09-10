interface PaymentConfirmationVariables {
  studentName: string;
  studentId: string;
  transactionRef: string;
}

export const paymentConfirmationTemplate = (variables: PaymentConfirmationVariables): string => {
  const { studentName, studentId, transactionRef } = variables;
  
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmed - Coding Club</title>
    <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #ffffff;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      
      <!-- Header -->
      <div style="text-align: center; padding: 30px 0; border-bottom: 1px solid #f0f0f0;">
        <!-- Coding Club Logo -->
        <div style="margin-bottom: 15px;">
          <img src="https://sctcoding.club/lovable-uploads/64cbe490-b3f4-4d17-a932-fe078c51142f.png" alt="Coding Club Logo" style="width: 60px; height: 60px; display: block; margin: 0 auto; border-radius: 10%;">
        </div>
        
        <h1 style="color: #333; margin: 0 0 5px 0; font-size: 24px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Coding Club</h1>
        <p style="color: #28a745; margin: 0; font-size: 16px; font-weight: 500;">🎉 Payment Confirmed!</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #333; margin: 0 0 30px 0; font-size: 28px; font-weight: 600; text-align: center;">
          Welcome <span style="color: #EA4C4C;">${studentName}</span>!
        </h2>
        
        <p style="font-size: 16px; margin-bottom: 30px; color: #666; line-height: 1.6; text-align: center;">
          Great news! Your payment has been successfully verified and your registration is now confirmed.
        </p>
        
        <!-- Registration Details -->
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin: 30px 0;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 500;">Registration Details</h3>
          
          <div style="border-left: 3px solid #EA4C4C; padding-left: 15px;">
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Student ID:</strong>
              <span style="color: #666; margin-left: 10px;">${studentId}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Transaction Reference:</strong>
              <span style="color: #666; margin-left: 10px;">${transactionRef}</span>
            </div>
            <div>
              <strong style="color: #333;">Status:</strong>
              <span style="color: #28a745; margin-left: 10px; font-weight: 500;">✅ PAID & CONFIRMED</span>
            </div>
          </div>
        </div>

        <!-- QR Code Section -->
        <div style="background-color: #f9f9f9; border: 2px solid #EA4C4C; border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
          <h3 style="margin: 0 0 20px 0; color: #EA4C4C; font-size: 18px; font-weight: 500;">📱 Your Event Ticket</h3>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${studentId}" 
                 alt="QR Code for verification" 
                 style="display: block; margin: 0 auto; width: 200px; height: 200px; border: 1px solid #f0f0f0; border-radius: 4px;" />
            <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">Show this QR code at the venue for verification</p>
          </div>
          
          <p style="margin: 10px 0 0 0; font-weight: 500; color: #EA4C4C;">Student ID: ${studentId}</p>
        </div>
        
        <!-- Event Information -->
        <div style="border-left: 3px solid #EA4C4C; padding-left: 15px; margin: 30px 0;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 500;">Event Information</h3>
          
          <div style="color: #666; line-height: 1.8;">
            <div style="margin-bottom: 8px;"><strong style="color: #333;">Event Name:</strong> SCC Treasure Hunt 2025</div>
            <div style="margin-bottom: 8px;"><strong style="color: #333;">Date:</strong> 21 September 2025</div>
            <div style="margin-bottom: 8px;"><strong style="color: #333;">Time:</strong> 9:30 AM</div>
            <div style="margin-bottom: 8px;"><strong style="color: #333;">Venue:</strong> 112 Seminar Hall, SCT</div>
            <div><strong style="color: #333;">Registration Fee:</strong> <span style="color: #28a745; font-weight: 500;">Successfully Paid ✅</span></div>
          </div>
        </div>
        
        <!-- Important Instructions -->
        <div style="background-color: #fff8e1; border-radius: 8px; padding: 20px; margin: 30px 0;">
          <h3 style="margin: 0 0 15px 0; color: #EA4C4C; font-size: 18px; font-weight: 500;">📋 Important Instructions</h3>
          
          <div style="color: #666; line-height: 1.7;">
            <div style="margin-bottom: 8px;">• Save this email or take a screenshot of your QR code</div>
            <div style="margin-bottom: 8px;">• Arrive at the venue 15 minutes before the event starts</div>
            <div style="margin-bottom: 8px;">• Show your QR code to event staff for verification</div>
            <div>• Check your email regularly for any event updates</div>
          </div>
        </div>
        
        <p style="font-size: 16px; color: #666; line-height: 1.6; text-align: center; margin: 30px 0;">
          If you have any questions or need assistance, please contact our support team with your Student ID.
        </p>
        
        <!-- Footer -->
        <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 25px;">
          <p style="margin: 0; color: #333; font-size: 16px;">
            <strong>Best regards,</strong><br>
            <span style="color: #EA4C4C; font-weight: 500;">SCC Event Team</span><br>
            <span style="color: #999; font-size: 14px;">Registration & Support</span>
          </p>
        </div>
      </div>
      
      <!-- Bottom Footer -->
      <div style="background-color: #f9f9f9; padding: 20px; text-align: center; margin-top: 20px;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This is an automated confirmation. Please save this email for your records.
        </p>
      </div>
    </div>
  </body>
</html>`;
};
