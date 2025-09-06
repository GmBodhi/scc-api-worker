interface FollowUpEmailVariables {
  studentName: string;
}

export const followUpEmailTemplate = (variables: FollowUpEmailVariables): string => {
  const { studentName } = variables;
  
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">Payment Reminder</h1>
        <p style="color: #e8e8e8; margin: 10px 0 0 0; font-size: 16px;">Complete Your Registration</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Hello ${studentName}! 👋</h2>
        
        <p style="font-size: 16px; margin-bottom: 25px; color: #555;">
          We noticed that your registration is still pending payment. Don't worry – completing your payment is quick and easy!
        </p>
        
        <!-- Action Box -->
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; color: #ffffff;">
          <h3 style="margin: 0 0 15px 0; font-size: 20px; font-weight: 500;">Ready to Complete Your Registration?</h3>
          <p style="margin: 0 0 25px 0; opacity: 0.9; font-size: 16px;">Click the button below to verify your payment and secure your spot</p>
          
          <!-- Button -->
          <a href="link" style="display: inline-block; background-color: #ffffff; color: #f5576c; padding: 15px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); transition: all 0.3s ease;">
            ✨ Verify Payment Now
          </a>
        </div>
        
        <!-- Alternative Link -->
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
            Button not working? Copy and paste this link into your browser:
          </p>
          <p style="margin: 0; word-break: break-all; font-family: 'Courier New', monospace; font-size: 14px; color: #007bff; background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e9ecef;">
            link
          </p>
        </div>
        
        <!-- Steps -->
        <div style="background-color: #fff8e1; border-radius: 8px; padding: 25px; margin: 30px 0;">
          <h4 style="margin: 0 0 15px 0; color: #f57f17; font-size: 18px;">📋 Simple Steps to Complete:</h4>
          <ol style="margin: 0; padding-left: 20px; color: #555;">
            <li style="margin-bottom: 8px;">Complete your payment (if not done already)</li>
            <li style="margin-bottom: 8px;">Enter your transaction ID</li>
            <li style="margin-bottom: 8px;">Submit for verification</li>
          </ol>
        </div>
        
        <p style="font-size: 16px; margin-top: 30px; color: #555;">
          Already completed your payment? Great! Please contact our support team with your transaction details, and we'll get you sorted right away.
        </p>
        
        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #f0f0f0;">
          <p style="margin: 0; color: #666; font-size: 16px;">
            <strong>Best regards,</strong><br>
            <span style="color: #667eea; font-weight: 500;">Registration Team</span>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
        <p style="margin: 0; color: #888; font-size: 12px;">
          This is an automated reminder. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
</html>`;
};
