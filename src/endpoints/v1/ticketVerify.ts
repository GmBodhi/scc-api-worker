import { OpenAPIRoute } from "chanfana";
import { type AppContext, TicketVerificationResponse } from "../../types";
import z from "zod";

export class TicketVerify extends OpenAPIRoute {
  schema = {
    summary: "Verify student ticket by ID",
    request: {
      params: z.object({ id: z.string().min(1, "Student ID is required") }),
    },
    responses: {
      "200": {
        description: "Ticket verification result",
        content: {
          "application/json": {
            schema: TicketVerificationResponse,
          },
        },
      },
      "404": {
        description: "Student not found or not paid",
        content: {
          "application/json": {
            schema: TicketVerificationResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const studentId = c.req.param("id");

    if (!studentId) {
      return c.json(
        {
          success: false,
          message: "Student ID is required",
        },
        400,
      );
    }

    try {
      // Check if student exists and has paid status
      const studentResult = await c.env.EVENTS_DB.prepare(
        "SELECT name, status FROM students WHERE id = ?",
      )
        .bind(studentId)
        .first();

      if (!studentResult) {
        return c.json(
          {
            success: false,
            message: "Student not found",
          },
          404,
        );
      }

      if (studentResult.status !== "paid") {
        return c.json(
          {
            success: false,
            message: "Student has not paid",
          },
          402,
        );
      }

      return c.json(
        {
          success: true,
          name: studentResult.name,
          message: "Ticket valid",
        },
        200,
      );
    } catch (error) {
      console.error("Error verifying ticket:", error);
      return c.json(
        {
          success: false,
          message: "Internal server error",
        },
        500,
      );
    }
  }
}
