import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TransactionCreate } from "./endpoints/transactionCreate";
import { StudentCreate } from "./endpoints/studentCreate";
import { LinkTransaction } from "./endpoints/linkTransaction";
import { TicketVerify } from "./endpoints/ticketVerify";
import { VerifyStudent } from "./endpoints/verifyStudent";
import { EmailTest } from "./endpoints/emailTest";
import { InitializeSheets } from "./endpoints/initializeSheets";
import { handleScheduled } from "./scheduledWorker";
import { cors } from "hono/cors";
import { TransactionCheck } from "./endpoints/transactionCheck";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();
app.use(cors());

const openapi = fromHono(app, {  
  docs_url: null,
  openapi_url: null,
  redoc_url: null,
});

openapi.post("/api/transaction", TransactionCreate);
openapi.post("/api/transaction-check", TransactionCheck);

openapi.post("/api/student", StudentCreate);
openapi.post("/api/link", LinkTransaction);
openapi.get("/api/ticket/:id", TicketVerify);
openapi.post("/api/verify-student", VerifyStudent);
// openapi.post("/api/email-test", EmailTest);
// openapi.post("/api/initialize-sheets", InitializeSheets);

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
