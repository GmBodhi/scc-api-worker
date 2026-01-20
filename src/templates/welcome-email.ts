interface WelcomeEmailData {
  name: string;
  email: string;
}

export function getWelcomeEmail(data: WelcomeEmailData): string {
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
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      margin-bottom: 20px;
    }
    .welcome-box {
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
    }
    .welcome-box h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .features {
      margin: 30px 0;
    }
    .feature {
      display: flex;
      align-items: start;
      margin: 20px 0;
    }
    .feature-icon {
      font-size: 24px;
      margin-right: 15px;
      flex-shrink: 0;
    }
    .feature-content h3 {
      margin: 0 0 5px 0;
      color: #1f2937;
      font-size: 16px;
    }
    .feature-content p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 500;
      margin: 20px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .social-links {
      margin: 20px 0;
      text-align: center;
    }
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      color: #2563eb;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀 SCT Coding Club</div>
    </div>
    
    <div class="welcome-box">
      <h2>🎉 Welcome to the Club!</h2>
      <p style="margin: 0; font-size: 16px;">Your journey to coding excellence starts here</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.name},</p>
      
      <p>Thank you for joining the <strong>SCT Coding Club</strong>! We're thrilled to have you as part of our vibrant community of developers, creators, and innovators.</p>
      
      <p>Your account has been successfully created with the email: <strong>${data.email}</strong></p>
      
      <div class="features">
        <h3 style="color: #1f2937; margin-bottom: 20px;">What's Next?</h3>
        
        <div class="feature">
          <div class="feature-icon">🎯</div>
          <div class="feature-content">
            <h3>Attend Events & Workshops</h3>
            <p>Join hackathons, coding competitions, and technical workshops</p>
          </div>
        </div>
        
        <div class="feature">
          <div class="feature-icon">👥</div>
          <div class="feature-content">
            <h3>Connect with Mentors</h3>
            <p>Get guidance from experienced developers and industry professionals</p>
          </div>
        </div>
        
        <div class="feature">
          <div class="feature-icon">💡</div>
          <div class="feature-content">
            <h3>Build Projects</h3>
            <p>Collaborate on real-world projects and expand your portfolio</p>
          </div>
        </div>
        
        <div class="feature">
          <div class="feature-icon">🏆</div>
          <div class="feature-content">
            <h3>Grow Your Skills</h3>
            <p>Access resources, tutorials, and learning paths curated for you</p>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://sctcoding.club" class="button">Visit Dashboard</a>
      </div>
      
      <p style="margin-top: 30px;"><strong>Need Help?</strong></p>
      <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:hello@sctcoding.club" style="color: #2563eb;">hello@sctcoding.club</a></p>
    </div>
    
    <div class="social-links">
      <a href="https://github.com/sctcoding">GitHub</a> •
      <a href="https://instagram.com/sctcoding">Instagram</a> •
      <a href="https://linkedin.com/company/sctcoding">LinkedIn</a>
    </div>
    
    <div class="footer">
      <p><strong>Happy Coding! 💻</strong></p>
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} SCT Coding Club. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
