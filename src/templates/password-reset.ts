interface PasswordResetEmailData {
  name: string;
  resetToken: string;
  expiresIn: string; // e.g., "15 minutes"
  isFirstTimeSetup?: boolean; // For users who verified EtLab but never set password
}

export function getPasswordResetEmail(data: PasswordResetEmailData): string {
  const resetUrl = `https://sctcoding.club/reset-password?token=${data.resetToken}`;
  const isFirstTimeSetup = data.isFirstTimeSetup || false;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 500;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning p {
      margin: 0;
      color: #92400e;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .code-box {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      text-align: center;
      letter-spacing: 2px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔐 SCT Coding Club</div>
    </div>
    
    <h1>${isFirstTimeSetup ? "Complete Your Account Setup" : "Reset Your Password"}</h1>
    
    <div class="content">
      <p>Hi ${data.name},</p>
      
      ${
        isFirstTimeSetup
          ? `<p>We see you verified your EtLab account but haven't set up a password yet. Click the button below to complete your account setup and create a password:</p>`
          : `<p>We received a request to reset your password for your SCT Coding Club account. Click the button below to create a new password:</p>`
      }
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">${isFirstTimeSetup ? "Set Up Password" : "Reset Password"}</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <div class="code-box">${resetUrl}</div>
      
      <div class="warning">
        <p><strong>⏰ This link will expire in ${data.expiresIn}</strong></p>
      </div>
      
      <p><strong>Security Tips:</strong></p>
      <ul>
        <li>Never share your password with anyone</li>
        <li>Use a strong, unique password</li>
        ${
          isFirstTimeSetup
            ? "<li>After setting your password, you can log in anytime</li>"
            : "<li>If you didn't request this reset, ignore this email</li>"
        }
        ${!isFirstTimeSetup ? "<li>Your password will remain unchanged until you create a new one</li>" : ""}
      </ul>
    </div>
    
    <div class="footer">
      ${
        isFirstTimeSetup
          ? "<p>If you didn't create an account with us, you can safely ignore this email.</p>"
          : "<p>If you didn't request a password reset, you can safely ignore this email.</p>"
      }
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} SCT Coding Club. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
