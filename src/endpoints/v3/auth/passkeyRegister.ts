import { Env } from "../../../types";

/**
 * POST /api/v3/auth/passkey/register/start
 * Generate registration options for passkey creation
 */
export async function handlePasskeyRegisterStart(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      user_id: string;
      email: string;
      name: string;
    };

    const { user_id, email, name } = body;

    if (!user_id || !email || !name) {
      return Response.json(
        { success: false, error: "user_id, email, and name are required" },
        { status: 400 }
      );
    }

    // Get existing credentials for this user
    const existingCredentials = await env.GENERAL_DB.prepare(
      "SELECT credential_id FROM passkey_credentials WHERE user_id = ?"
    )
      .bind(user_id)
      .all();

    // Generate challenge
    const challenge = crypto.randomUUID();
    const challengeBytes = new TextEncoder().encode(challenge);
    const challengeBase64 = btoa(String.fromCharCode(...challengeBytes));

    // User ID to base64
    const userIdBytes = new TextEncoder().encode(user_id);
    const userIdBase64 = btoa(String.fromCharCode(...userIdBytes));

    // Store challenge in KV with 5 min expiry
    if (env.CHALLENGES) {
      await env.CHALLENGES.put(
        challenge,
        JSON.stringify({ user_id, type: "registration" }),
        { expirationTtl: 300 }
      );
    }

    const options = {
      challenge: challengeBase64,
      rp: {
        name: env.RP_NAME || "Coding Club",
        id: env.RP_ID || "localhost",
      },
      user: {
        id: userIdBase64,
        name: email,
        displayName: name,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existingCredentials.results.map((cred: any) => ({
        id: cred.credential_id,
        type: "public-key",
      })),
    };

    return Response.json({ success: true, options });
  } catch (error) {
    console.error("Passkey register start error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v3/auth/passkey/register/verify
 * Verify and store the passkey credential
 */
export async function handlePasskeyRegisterVerify(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      user_id: string;
      credential: any;
      device_name?: string;
    };

    const { user_id, credential, device_name } = body;

    if (!user_id || !credential) {
      return Response.json(
        { success: false, error: "user_id and credential are required" },
        { status: 400 }
      );
    }

    // Note: Full WebAuthn verification requires @simplewebauthn/server
    // For now, we'll store the credential with basic validation
    // In production, you should verify the attestation response

    // Store credential in database
    const credId = crypto.randomUUID();
    const credentialId = credential.id || credential.rawId;

    await env.GENERAL_DB.prepare(
      `
			INSERT INTO passkey_credentials (
				id, user_id, credential_id, public_key, counter, transports, device_name
			)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`
    )
      .bind(
        credId,
        user_id,
        credentialId,
        JSON.stringify(credential.response),
        0,
        JSON.stringify(credential.response?.transports || []),
        device_name || "Unknown Device"
      )
      .run();

    return Response.json({
      success: true,
      data: {
        credential_id: credId,
        message: "Passkey registered successfully",
      },
    });
  } catch (error) {
    console.error("Passkey register verify error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
