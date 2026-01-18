import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TransactionCreate } from "./transactionCreate";
import { StudentCreate } from "./studentCreate";
import { MentorshipCreate } from "./mentorshipCreate";
import { LinkTransaction } from "./linkTransaction";
import { TicketVerify } from "./ticketVerify";
import { VerifyStudent } from "./verifyStudent";
import { EmailTest } from "./emailTest";
import { InitializeSheets } from "./initializeSheets";
import { TransactionCheck } from "./transactionCheck";
import { StudentRefund } from "./studentRefund";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  docs_url: "/docs",
  openapi_url: "/openapi.json",
  redoc_url: "/redoc",
  schema: {
    info: {
      title: "SCC API v1",
      version: "1.0.0",
      description: "Transaction, student, and mentorship management endpoints",
    },
  },
});

openapi.post("/transaction", TransactionCreate);
openapi.post("/transaction-check", TransactionCheck);

openapi.post("/student", StudentCreate);
openapi.post("/mentorship", MentorshipCreate);
openapi.post("/link", LinkTransaction);
openapi.get("/ticket/:id", TicketVerify);
openapi.post("/verify-student", VerifyStudent);
// openapi.post("/refund", StudentRefund);
// openapi.post("/email-test", EmailTest);
openapi.post("/initialize-sheets", InitializeSheets);

export default openapi;
