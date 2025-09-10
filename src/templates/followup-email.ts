interface FollowUpEmailVariables {
  studentName: string;
  studentId: string;
}

export const followUpEmailTemplate = (variables: FollowUpEmailVariables): string => {
  const { studentName, studentId } = variables;
  const link =
    "https://sctcoding.club/forms/treasurehunt/verify-payment?id=" + studentId; // Replace with actual link
  
  return `<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder - Coding Club</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #ffffff;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      
      <div style="text-align: center; padding: 30px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="margin-bottom: 15px;">
          <img src="logo.png" alt="Coding Club Logo" style="width: 60px; height: 60px; display: block; margin: 0 auto;" />
        </div>
        
        <h1 style="color: #333; margin: 0 0 5px 0; font-size: 24px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Coding Club</h1>
        <p style="color: #999; margin: 0; font-size: 14px; font-weight: 400;">Payment Reminder</p>
      </div>
      
      <div style="padding: 40px 30px;">
        <h2 style="color: #333; margin: 0 0 30px 0; font-size: 28px; font-weight: 600; text-align: center;">
          Hello <span style="color: #EA4C4C;">${studentName}</span>!
        </h2>
        
        <p style="font-size: 16px; margin-bottom: 30px; color: #666; line-height: 1.6; text-align: center;">
          We noticed that your registration is still pending payment. Complete your registration to join the best club of SCTCE!
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 500; color: #333;">Complete Your Registration</h3>
          
          <a href="${link}" style="display: inline-block; background-color: #EA4C4C; color: #ffffff; padding: 15px 35px; text-decoration: none; border-radius: 25px; font-weight: 500; font-size: 16px; margin: 10px 0;">
            Verify Payment Now
          </a>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
            Button not working? Copy this link:
          </p>
          <p style="margin: 0; word-break: break-all; font-family: monospace; font-size: 13px; color: #EA4C4C;">
            ${link}
          </p>
        </div>
        
        <div style="margin: 40px 0; text-align: center;">
          <h4 style="margin: 0 0 25px 0; color: #333; font-size: 18px; font-weight: 500;">Simple Steps</h4>
          
          <div style="display: flex; justify-content: space-between; max-width: 400px; margin: 0 auto; flex-wrap: wrap; gap: 20px;">
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="background-color: #EA4C4C; color: white; width: 30px; height: 30px; border-radius: 50%; margin: 0 auto 10px; font-size: 14px; font-weight: 600; line-height: 30px; text-align: center;">1</div>
              <p style="margin: 0; font-size: 13px; color: #666;">Complete Payment</p>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="background-color: #EA4C4C; color: white; width: 30px; height: 30px; border-radius: 50%; margin: 0 auto 10px; font-size: 14px; font-weight: 600; line-height: 30px; text-align: center;">2</div>
              <p style="margin: 0; font-size: 13px; color: #666;">Enter Transaction ID</p>
            </div>
            <div style="flex: 1; min-width: 100px; text-align: center;">
              <div style="background-color: #EA4C4C; color: white; width: 30px; height: 30px; border-radius: 50%; margin: 0 auto 10px; font-size: 14px; font-weight: 600; line-height: 30px; text-align: center;">3</div>
              <p style="margin: 0; font-size: 13px; color: #666;">Submit & Verify</p>
            </div>
          </div>
        </div>
        
        <!-- Support Note -->
        <div style="border-left: 3px solid #EA4C4C; padding-left: 15px; margin: 30px 0;">
          <p style="margin: 0; font-size: 15px; color: #666; line-height: 1.5;">
            <strong style="color: #333;">Already paid?</strong> Contact our support team with your transaction details for immediate verification.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 25px;">
          <p style="margin: 0; color: #333; font-size: 16px;">
            <strong>Best regards,</strong><br>
            <span style="color: #EA4C4C; font-weight: 500;">The Coding Club Team</span>
          </p>
        </div>
      </div>
      
      <!-- Bottom Footer -->
      <div style="background-color: #f9f9f9; padding: 20px; text-align: center; margin-top: 20px;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This is an automated reminder. Please reply to this email if you have any questions.
        </p>
      </div>
    </div>
  </body>
</html>`;
};
