import { fromHono } from "chanfana";
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  docs_url: null,
  openapi_url: null,
  redoc_url: null,
});



export default app;
