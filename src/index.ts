import { fromHono } from "chanfana";
import { Hono } from "hono";
import { handleScheduled } from "./scheduledWorker";
import { cors } from "hono/cors";
import v1 from "./endpoints/v1";
import v2 from "./endpoints/v2";
import v3 from "./endpoints/v3";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();
app.use(
  cors({
    origin: "*",
  }),
);

// Create OpenAPI documentation at root
const openapi = fromHono(app, {
  docs_url: "/",
  openapi_url: "/openapi.json",
  redoc_url: "/redoc",
  schema: {
    info: {
      title: "SCC API Worker",
      version: "1.0.0",
      description:
        "API for SCC payment processing, student management, and authentication",
    },
  },
});

// Mount versioned API routes
openapi.route("/api/v1", v1);
openapi.route("/api/v2", v2);
openapi.route("/api/v3", v3);

// Export the Worker with both HTTP and scheduled handlers
export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(handleScheduled(env));
  },
};
