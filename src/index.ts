import { Hono } from "hono";
import { handleScheduled } from "./scheduledWorker";
import { cors } from "hono/cors";
import v1 from "./endpoints/v1";
import v2 from "./endpoints/v2";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();
app.use(cors({
  origin: '*'
}));

app.route("/api/v1", v1);
app.route("/api/v2", v2);

// Export the Worker with both HTTP and scheduled handlers
export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ) => {
    ctx.waitUntil(handleScheduled(env));
  },
};
