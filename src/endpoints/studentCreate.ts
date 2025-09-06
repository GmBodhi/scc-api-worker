import { OpenAPIRoute } from "chanfana";
import { type AppContext, StudentRegistration, StudentResponse } from "../types";
import { ca } from "zod/v4/locales";

export class StudentCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new student registration",
    request: {
      body: {
        content: {
          "application/json": {
            schema: StudentRegistration,
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Returns the created student registration",
        content: {
          "application/json": {
            schema: StudentResponse,
          },
        },
      },
      "400": {
        description: "Bad request - validation error",
        content: {},
      },
      "404": {
        description: "Unauthorized",
        content: {},
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();

    try {
      
      
      const studentData = data.body;
      
      // Generate a unique ID (using timestamp + random string for simplicity)
      const id = `STU_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const student = {
        id,
        ...studentData,
        status: studentData?.status || 'pending',
      };
      
      const res = await c.env.db
        .prepare(
          "INSERT INTO students(id, name, batch, email, phoneNumber, status, upiRef, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          student.id,
          student.name,
          student.batch,
          student.email,
          student.phoneNumber,
          student.status,
          student.upiRef || null,
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run().catch((e) => ({ error: true, details: e.message }));
      
      if ('error' in res) {
        console.error("Database error:", res.details);
        return c.json({ error: "The email or phone number is already in use" }, 400);
      }
      
      console.log("Student registration:", student, res);
      return c.json(student, 201);

    } catch (e) {
      console.error("Error creating student:", e);
      return c.json({ error: "Failed to create student" }, 500);
    }
  }
}
