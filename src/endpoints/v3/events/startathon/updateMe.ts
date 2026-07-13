import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonUpdateMeRequest,
  StartathonMeResponse,
  ErrorResponse,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";

/**
 * PATCH /api/v3/events/startathon/me
 * Update the caller's own name/phone/college. Email is not editable here.
 */
export class StartathonUpdateMe extends OpenAPIRoute {
  schema = {
    summary: "Update my Startathon account",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonUpdateMeRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Updated user",
        content: {
          "application/json": {
            schema: StartathonMeResponse,
          },
        },
      },
      "400": {
        description: "No valid fields to update",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      const authResult = await requireStartathonAuth(c);
      if (!authResult.success || !authResult.user) {
        return c.json(
          { success: false, error: authResult.error || "Unauthorized" },
          401,
        );
      }
      const user = authResult.user;

      const data = await this.getValidatedData<typeof this.schema>();
      const { name, phone, college } = data.body;

      const updates: string[] = [];
      const bindings: unknown[] = [];

      if (name !== undefined) {
        updates.push("name = ?");
        bindings.push(name);
      }
      if (phone !== undefined) {
        updates.push("phone = ?");
        bindings.push(phone);
      }
      if (college !== undefined) {
        updates.push("college = ?");
        bindings.push(college);
      }

      if (updates.length === 0) {
        return c.json(
          { success: false, error: "No valid fields to update" },
          400,
        );
      }

      bindings.push(user.user_id);

      await c.env.EVENTS_DB.prepare(
        `UPDATE startathon_users SET ${updates.join(", ")} WHERE user_id = ?`,
      )
        .bind(...bindings)
        .run();

      return c.json({
        success: true,
        data: {
          user_id: user.user_id,
          team_id: user.team_id,
          role: user.role,
          name: name ?? user.name,
          email: user.email,
          phone: phone ?? user.phone,
          college: college ?? user.college,
        },
      });
    } catch (error) {
      console.error("Startathon update me error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
