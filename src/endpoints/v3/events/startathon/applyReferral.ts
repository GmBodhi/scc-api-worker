import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  StartathonReferralRequest,
  StartathonReferralResponse,
  ErrorResponse,
  STARTATHON_TEAM_REFERRAL_FEE,
} from "../../../../types";
import { requireStartathonAuth } from "../../../../middleware/startathonAuth";
import { handleEndpointError } from "../../../../utils/errorResponse";

/**
 * PUT /api/v3/events/startathon/team/referral
 * Leader applies (or changes) another team's referral code before
 * paying. Locked once the team's payment is confirmed.
 */
export class StartathonApplyReferral extends OpenAPIRoute {
  schema = {
    summary: "Apply a referral code to my team",
    description:
      "Leader submits another team's referral_code for 10% off the team fee (₹90 instead of ₹100). Callable repeatedly while payment-pending; locked once confirmed.",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: StartathonReferralRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Referral applied",
        content: {
          "application/json": {
            schema: StartathonReferralResponse,
          },
        },
      },
      "400": {
        description: "Invalid/self referral code, or team already paid",
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
      "403": {
        description: "Only the team leader can apply a referral code",
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

      if (user.role !== "leader") {
        return c.json(
          { success: false, error: "Only the team leader can apply a referral code" },
          403,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { referral_code } = data.body;

      const team = await c.env.EVENTS_DB.prepare(
        "SELECT * FROM startathon_teams WHERE team_id = ?",
      )
        .bind(user.team_id)
        .first();

      if (!team) {
        return c.json({ success: false, error: "Team not found" }, 500);
      }

      if (team.status !== "payment-pending") {
        return c.json(
          { success: false, error: "Team payment is already completed" },
          400,
        );
      }

      const referrer = await c.env.EVENTS_DB.prepare(
        "SELECT team_id FROM startathon_teams WHERE referral_code = ?",
      )
        .bind(referral_code)
        .first();

      if (!referrer) {
        return c.json({ success: false, error: "Invalid referral code" }, 400);
      }

      if (referrer.team_id === user.team_id) {
        return c.json(
          { success: false, error: "You can't refer your own team" },
          400,
        );
      }

      await c.env.EVENTS_DB.prepare(
        "UPDATE startathon_teams SET referred_by = ? WHERE team_id = ?",
      )
        .bind(referrer.team_id as string, user.team_id)
        .run();

      console.log("Startathon referral applied:", {
        team_id: user.team_id,
        referred_by: referrer.team_id,
      });

      return c.json({
        success: true,
        data: {
          referred_by: referrer.team_id as string,
          expected_fee: STARTATHON_TEAM_REFERRAL_FEE,
        },
      });
    } catch (error) {
      return handleEndpointError(c, error, "Startathon apply referral error:");
    }
  }
}
