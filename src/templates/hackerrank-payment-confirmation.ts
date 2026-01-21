interface HackerRankPaymentConfirmationData {
  name: string;
  registrationId: string;
  transactionRef: string;
}

export function getHackerRankPaymentConfirmationEmail(
  data: HackerRankPaymentConfirmationData,
): string {
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
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .success-banner {
      background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      margin: 30px 0;
    }
    .success-banner h2 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .details-box {
      background-color: #f8f9fa;
      border-left: 4px solid #00c853;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .details-box h3 {
      margin-top: 0;
      color: #1f2937;
    }
    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-item:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 500;
      color: #6b7280;
    }
    .detail-value {
      font-weight: 600;
      color: #1f2937;
    }
    .info-section {
      margin: 30px 0;
    }
    .info-section h3 {
      color: #1f2937;
      margin-bottom: 15px;
    }
    .info-item {
      margin: 15px 0;
      padding-left: 30px;
      position: relative;
    }
    .info-item::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #00c853;
      font-weight: bold;
      font-size: 18px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">💻</div>
      <div class="title">SCT Coding Club</div>
    </div>
    
    <div class="success-banner">
      <h2>🎉 Payment Confirmed!</h2>
      <p style="margin: 0; font-size: 16px;">Your HackerRank event registration is complete</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.name},</p>
      
      <p>Great news! Your payment has been verified and your registration for the <strong>HackerRank Event</strong> is now confirmed.</p>
      
      <div class="details-box">
        <h3>Registration Details</h3>
        <div class="detail-item">
          <span class="detail-label">Registration ID</span>
          <span class="detail-value">${data.registrationId}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Transaction Ref</span>
          <span class="detail-value">${data.transactionRef}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Event</span>
          <span class="detail-value">HackerRank Coding Competition</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status</span>
          <span class="detail-value" style="color: #00c853;">✓ Confirmed</span>
        </div>
      </div>
      
      <div class="info-section">
        <h3>What's Next?</h3>
        
        <div class="info-item">
          <strong>Event Details</strong><br>
          <span style="color: #6b7280;">Check your dashboard for event date, time, and location</span>
        </div>
        
        <div class="info-item">
          <strong>Prepare Well</strong><br>
          <span style="color: #6b7280;">Practice coding problems and brush up on algorithms</span>
        </div>
        
        <div class="info-item">
          <strong>Stay Updated</strong><br>
          <span style="color: #6b7280;">Watch for event updates and announcements</span>
        </div>
        
        <div class="info-item">
          <strong>Join Community</strong><br>
          <span style="color: #6b7280;">Connect with other participants on our social channels</span>
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://sctcoding.club/events/hackerrank-contest-2026" class="button">View Event Details</a>
      </div>
      
      <p style="margin-top: 30px;"><strong>Questions?</strong></p>
      <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:hello@sctcoding.club" style="color: #2563eb;">hello@sctcoding.club</a></p>
    </div>
    
    <div class="footer">
      <p><strong>See you at the event! 🚀</strong></p>
      <p style="margin-top: 10px;">© ${new Date().getFullYear()} SCT Coding Club. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
