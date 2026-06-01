import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../../types";

export class EmailClick extends OpenAPIRoute {
  schema = {
    summary: "Email link click tracking",
    request: {
      query: z.object({
        id: z.string().min(1),
        url: z.string().url(),
      }),
    },
    responses: {
      "302": { description: "Redirect to destination" },
      "400": { description: "Missing or invalid URL" },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { id, url } = data.query;

    const eventId = `EV_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = Math.floor(Date.now() / 1000);

    c.executionCtx.waitUntil(
      c.env.EVENTS_DB.prepare(
        `INSERT INTO email_events (id, waitlist_id, event, url, ip, user_agent, occurred_at)
         VALUES (?, ?, 'click', ?, ?, ?, ?)`,
      )
        .bind(
          eventId,
          id,
          url,
          c.req.header("cf-connecting-ip") ?? null,
          c.req.header("user-agent") ?? null,
          now,
        )
        .run()
        .catch((e: Error) => console.error("Email click tracking error:", e)),
    );

    return Response.redirect(url, 302);
  }
}
