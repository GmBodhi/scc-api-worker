import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  EtlabVerifyRequest,
  EtlabVerifyResponse,
} from "../../types";

interface EtLabProfileData {
  admno: string | null;
  name: string | null;
  email: string | null;
  batch: string | null;
  reg_no: string | null;
  phone: string | null;
  image: string | null;
}

interface EtLabResponse {
  status: number;
  data?: EtLabProfileData;
}

const STATUS_CODES = {
  SUCCESS: 0,
  NETWORK_ERROR: 1,
  INVALID_CREDENTIALS: 2,
  API_ERROR: 3,
  ERROR_FETCHING_DATA: 4,
  TIMEOUT_ERROR: 5,
};

const DEFAULT_TIMEOUT = 10000;
const ETLAB_BASE_URL = "https://sctce.etlab.in";

/**
 * Make a request to EtLab API with timeout
 */
async function makeEtLabRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
}

/**
 * Get student data from EtLab API
 */
async function getEtLabData(
  username: string,
  password: string
): Promise<EtLabResponse> {
  try {
    // Step 1: Login
    const loginResponse = await makeEtLabRequest(
      `${ETLAB_BASE_URL}/androidapp/app/login`,
      {
        method: "POST",
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      }
    );

    if (!loginResponse.ok) {
      return { status: STATUS_CODES.NETWORK_ERROR };
    }

    const loginData = await loginResponse.json();

    if (!loginData.login) {
      return { status: STATUS_CODES.INVALID_CREDENTIALS };
    }

    // Step 2: Get student details
    const detailsResponse = await makeEtLabRequest(
      `${ETLAB_BASE_URL}/androidapp/app/getstudentdetails`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${loginData.access_token}`,
        },
      }
    );

    if (!detailsResponse.ok) {
      return { status: STATUS_CODES.API_ERROR };
    }

    const detailsData = await detailsResponse.json();

    if (!detailsData.login) {
      return { status: STATUS_CODES.ERROR_FETCHING_DATA };
    }

    // Build profile data
    const profileData: EtLabProfileData = {
      admno: detailsData.admission_no || loginData.uname || null,
      name: detailsData.name || loginData.profile_name || null,
      email: detailsData.email || null,
      batch:
        loginData.course ??
        loginData.academic_year ??
        `${loginData.end_year}` ??
        null,
      reg_no: detailsData.register_no || null,
      phone:
        detailsData.phone_home ||
        detailsData.phone_father ||
        detailsData.phone_mother ||
        null,
      image: loginData.url || null,
    };

    return { data: profileData, status: STATUS_CODES.SUCCESS };
  } catch (error) {
    console.error("EtLab API request error:", error);
    if (error instanceof Error && error.message === "Request timeout") {
      return { status: STATUS_CODES.TIMEOUT_ERROR };
    }
    return { status: STATUS_CODES.NETWORK_ERROR };
  }
}

/**
 * POST /api/v3/auth/etlab/verify
 * Verify Etlab credentials and retrieve user info
 */
export class EtlabVerify extends OpenAPIRoute {
  schema = {
    summary: "Verify Etlab credentials and retrieve user info",
    request: {
      body: {
        content: {
          "application/json": {
            schema: EtlabVerifyRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns EtLab user information",
        content: {
          "application/json": {
            schema: EtlabVerifyResponse,
          },
        },
      },
      "400": {
        description: "Bad request - missing credentials",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid credentials",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "502": {
        description: "Bad Gateway - EtLab API error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "503": {
        description: "Service Unavailable - network error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "504": {
        description: "Gateway Timeout",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { username, password } = data.body;

    try {
      // Call EtLab API
      const result = await getEtLabData(username, password);

      // Handle different status codes
      switch (result.status) {
        case STATUS_CODES.SUCCESS:
          if (!result.data) {
            return c.json(
              { success: false, error: "No data returned from EtLab" },
              500
            );
          }

          // Check if user already exists
          const existingUser = await c.env.GENERAL_DB.prepare(
            "SELECT id FROM users WHERE etlab_username = ? OR email = ?"
          )
            .bind(username, result.data.email)
            .first();

          let userId: string;

          if (existingUser) {
            // User already exists
            userId = existingUser.id as string;
          } else {
            // Create new user with EtLab data
            userId = crypto.randomUUID();
            await c.env.GENERAL_DB.prepare(
              `INSERT INTO users (id, email, name, etlab_username, profile_photo_url, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                userId,
                result.data.email || `${username}@temp.etlab.sctce.ac.in`,
                result.data.name || username,
                username,
                result.data.image || null,
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000)
              )
              .run();
          }

          // Generate signup token (valid for 10 minutes)
          const signupToken = crypto.randomUUID();
          const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes

          // Store token in KV or database
          if (c.env.CHALLENGES) {
            await c.env.CHALLENGES.put(
              `signup:${signupToken}`,
              JSON.stringify({ user_id: userId }),
              { expirationTtl: 600 }
            );
          } else {
            // Fallback to database if KV not available
            await c.env.GENERAL_DB.prepare(
              `INSERT OR REPLACE INTO challenges (challenge, user_id, type, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?)`
            )
              .bind(
                signupToken,
                userId,
                "signup",
                Math.floor(Date.now() / 1000),
                expiresAt
              )
              .run();
          }

          return c.json({
            success: true,
            data: {
              user_id: userId,
              signup_token: signupToken,
              name: result.data.name,
              email: result.data.email,
              etlab_username: username,
              admission_no: result.data.admno,
              batch: result.data.batch,
              phone: result.data.phone,
              register_no: result.data.reg_no,
              profile_photo_url: result.data.image,
            },
          });

        case STATUS_CODES.INVALID_CREDENTIALS:
          return c.json(
            { success: false, error: "Invalid EtLab credentials" },
            401
          );

        case STATUS_CODES.TIMEOUT_ERROR:
          return c.json(
            { success: false, error: "EtLab API request timeout" },
            504
          );

        case STATUS_CODES.NETWORK_ERROR:
          return c.json(
            { success: false, error: "Network error connecting to EtLab" },
            503
          );

        case STATUS_CODES.API_ERROR:
        case STATUS_CODES.ERROR_FETCHING_DATA:
        default:
          return c.json(
            { success: false, error: "Error fetching data from EtLab" },
            502
          );
      }
    } catch (error) {
      console.error("Etlab verify error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
