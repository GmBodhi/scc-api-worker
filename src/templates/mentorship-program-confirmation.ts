interface MentorshipProgramConfirmationVariables {
  studentName: string;
  studentId: string;
  experienceLevel: string;
}

export const mentorshipProgramConfirmationTemplate = (
  variables: MentorshipProgramConfirmationVariables
): string => {
  const { studentName, studentId, experienceLevel } = variables;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mentorship Program - Registration Confirmed</title>
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
        <p style="color: #28a745; margin: 0; font-size: 16px; font-weight: 500;">🎉 Registration Confirmed!</p>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #333; margin: 0 0 30px 0; font-size: 28px; font-weight: 600; text-align: center;">
          Welcome <span style="color: #EA4C4C;">${studentName}</span>!
        </h2>

        <p style="font-size: 16px; margin-bottom: 30px; color: #666; line-height: 1.6; text-align: center;">
          Great news! Your registration for the Mentorship Program has been confirmed. We're excited to have you join us!
        </p>

        <!-- Registration Details -->
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin: 30px 0;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 500;">Registration Details</h3>

          <div style="border-left: 3px solid #EA4C4C; padding-left: 15px;">
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Registration ID:</strong>
              <span style="color: #666; margin-left: 10px;">${studentId}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Name:</strong>
              <span style="color: #666; margin-left: 10px;">${studentName}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Experience Level:</strong>
              <span style="color: #666; margin-left: 10px;">${experienceLevel}</span>
            </div>
            <div>
              <strong style="color: #333;">Status:</strong>
              <span style="color: #28a745; margin-left: 10px; font-weight: 500;">✅ CONFIRMED</span>
            </div>
          </div>
        </div>

        <!-- Workshop Information -->
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin: 30px 0;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 500;">Workshop Information</h3>

          <div style="border-left: 3px solid #EA4C4C; padding-left: 15px;">
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Program:</strong>
              <span style="color: #666; margin-left: 10px;">Mentorship Program 2025</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">Type:</strong>
              <span style="color: #666; margin-left: 10px;">Free Workshop/Training</span>
            </div>
            <div>
              <strong style="color: #333;">Registration Fee:</strong>
              <span style="color: #28a745; margin-left: 10px; font-weight: 500;">FREE ✅</span>
            </div>
          </div>
        </div>

        <!-- Next Steps -->
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin: 30px 0;">
          <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 500;">Next Steps</h3>
          
          <div style="border-left: 3px solid #EA4C4C; padding-left: 15px;">
            <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 15px 0;">
              Please watch your email for further instructions. We will send you:
            </p>
            
            <div style="color: #666; line-height: 1.8;">
              <div style="margin-bottom: 8px;">• Program schedule and session timings</div>
              <div style="margin-bottom: 8px;">• Mentor assignment details</div>
              <div style="margin-bottom: 8px;">• Meeting links and access information</div>
              <div style="margin-bottom: 8px;">• Preparation materials and guidelines</div>
            </div>

            <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 15px 0 0 0;">
              <strong style="color: #333;">Note:</strong> Check your email regularly, including spam/junk folders.
            </p>
          </div>
        </div>
       
        <p style="font-size: 16px; color: #666; line-height: 1.6; text-align: center; margin: 30px 0;">
          If you have any questions or need assistance, please contact our support team with your Registration ID.
        </p>

        <!-- Footer -->
        <div style="margin-top: 50px; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 25px;">
          <p style="margin: 0; color: #333; font-size: 16px;">
            <strong>Best regards,</strong><br>
            <span style="color: #EA4C4C; font-weight: 500;">SCC Mentorship Team</span><br>
            <span style="color: #999; font-size: 14px;">Workshop & Training Support</span>
          </p>
        </div>
      </div>

      <!-- Bottom Footer -->
      <div style="background-color: #f9f9f9; padding: 20px; text-align: center; margin-top: 20px;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This is an automated confirmation. Please reply to this email if you have any questions.
        </p>
      </div>
    </div>
  </body>
</html>`;
};
