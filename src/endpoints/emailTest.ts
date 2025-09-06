import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { EmailService } from "../services/emailService";

const TestEmailSchema = z.object({
  templateType: z.enum(["followup", "confirmation"]),
  studentName: z.string(),
  studentEmail: z.string(),
  studentId: z.string().optional(),
  transactionRef: z.string().optional(),
});

export class EmailTest extends OpenAPIRoute {
  schema = {
    tags: ["Email"],
    summary: "Test email templates by sending test emails",
    request: {
    },
    responses: {
      200: {
        description: "Email sent successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
      400: {
        description: "Bad request - validation failed",
      },
      401: {
        description: "Unauthorized - invalid token",
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {

    const data = await this.getValidatedData<typeof this.schema>();
    const emailService = new EmailService(c.env.BREVO_API_KEY);

    

    
    try {

      const email = 'haharshannair@gmail.com',
        name = 'Harshan';
      
      await emailService.sendFollowUpEmail(name, email);
      await emailService.sendPaymentConfirmationEmail(name, email, "STU_TEST123", "TXN_TEST123");

     return c.json({
       success: true,
       message: "Test emails sent successfully"
     });
    } catch (error) {
      console.error("Email test error:", error);
      return c.json({
        success: false,
        message: "Error sending email: " + (error as Error).message
      }, 500);
    }
  }
}
