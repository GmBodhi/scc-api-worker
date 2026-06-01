import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../../types";

const TRANSPARENT_GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export class EmailOpen extends OpenAPIRoute {
  schema = {
    summary: "Email open tracking pixel",
    request: {
      query: z.object({
        id: z.string().min(1),
      }),
    },
    responses: {
      "200": { description: "1x1 tracking pixel" },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.query;

    const eventId = `EV_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = Math.floor(Date.now() / 1000);

    c.executionCtx.waitUntil(
      c.env.EVENTS_DB.prepare(
        `INSERT INTO email_events (id, waitlist_id, event, url, ip, user_agent, occurred_at)
         VALUES (?, ?, 'open', NULL, ?, ?, ?)`,
      )
        .bind(
          eventId,
          id,
          c.req.header("cf-connecting-ip") ?? null,
          c.req.header("user-agent") ?? null,
          now,
        )
        .run()
        .catch((e: Error) => console.error("Email open tracking error:", e)),
    );

    return new Response(TRANSPARENT_GIF, {
      headers: {
        "content-type": "image/gif",
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
      },
    });
  }
}
