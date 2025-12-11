import { fromHono } from "chanfana";
import { Hono } from "hono";
import { MentorshipProgramCreate } from "./mentorshipProgramCreate";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  docs_url: null,
  openapi_url: null,
  redoc_url: null,
});

openapi.post("/mentorship-program", MentorshipProgramCreate);

export default app;
