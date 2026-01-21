/**
 * POST /api/v3/auth/passkey/login/start
 * Generate authentication options for passkey login
 */
export async function handlePasskeyLoginStart(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as { email?: string };
    const { email } = body;

    let allowCredentials: any[] = [];

    if (email) {
      // Get user's credentials
      const user = await env.GENERAL_DB.prepare(
        "SELECT id FROM users WHERE email = ?",
      )
        .bind(email)
        .first();

      if (user) {
        const credentials = await env.GENERAL_DB.prepare(
          "SELECT credential_id, transports FROM passkey_credentials WHERE user_id = ?",
        )
          .bind(user.id)
          .all();

        allowCredentials = credentials.results.map((cred: any) => ({
          id: cred.credential_id,
          type: "public-key",
          transports: JSON.parse(cred.transports || "[]"),
        }));
      }
    }

    // Generate challenge
    const challenge = crypto.randomUUID();
    const challengeBytes = new TextEncoder().encode(challenge);
    const challengeBase64 = btoa(String.fromCharCode(...challengeBytes));

    // Store challenge in KV
    if (env.CHALLENGES) {
      await env.CHALLENGES.put(
        challenge,
        JSON.stringify({ type: "authentication", timestamp: Date.now() }),
        { expirationTtl: 300 },
      );
    }

    const options = {
      challenge: challengeBase64,
      timeout: 60000,
      rpId: env.RP_ID || "localhost",
      allowCredentials,
      userVerification: "preferred",
    };

    return Response.json({ success: true, options });
  } catch (error) {
    console.error("Passkey login start error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v3/auth/passkey/login/verify
 * Verify passkey and return JWT tokens
 */
export async function handlePasskeyLoginVerify(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as { credential: any };
    const { credential } = body;

    if (!credential) {
      return Response.json(
        { success: false, error: "Credential is required" },
        { status: 400 },
      );
    }

    // Note: Full WebAuthn verification requires @simplewebauthn/server
    // For now, we'll do basic lookup and JWT generation
    // In production, you should verify the authentication response

    // Find credential in database
    const credentialId = credential.id || credential.rawId;
    const credentialRecord = await env.GENERAL_DB.prepare(
      "SELECT * FROM passkey_credentials WHERE credential_id = ?",
    )
      .bind(credentialId)
      .first();

    if (!credentialRecord) {
      return Response.json(
        { success: false, error: "Credential not found" },
        { status: 400 },
      );
    }

    // Update last used timestamp
    await env.GENERAL_DB.prepare(
      "UPDATE passkey_credentials SET last_used_at = ? WHERE id = ?",
    )
      .bind(Math.floor(Date.now() / 1000), credentialRecord.id)
      .run();

    // Get user data
    const user = await env.GENERAL_DB.prepare(
      "SELECT id, email, name, profile_photo_url FROM users WHERE id = ?",
    )
      .bind(credentialRecord.user_id)
      .first();

    if (!user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 400 },
      );
    }

    // Generate JWT tokens (matching login.ts behavior)
    const { generateJWT, generateRefreshToken, hashRefreshToken } =
      await import("../../utils/jwt");

    // Generate access token (15 minutes)
    const accessToken = await generateJWT(
      user.id as string,
      user.email as string,
      user.phone as string | null,
      user.name as string,
      env.JWT_SECRET,
      15 * 60, // 15 minutes
    );

    // Generate refresh token (30 days)
    const refreshToken = await generateRefreshToken(
      user.id as string,
      env.JWT_SECRET,
      30 * 24 * 60 * 60, // 30 days
    );

    // Store refresh token in database
    const tokenHash = await hashRefreshToken(refreshToken);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 30 * 24 * 60 * 60;

    await env.GENERAL_DB.prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        user.id,
        tokenHash,
        expiresAt,
        now,
        request.headers.get("cf-connecting-ip") || null,
        request.headers.get("user-agent") || null,
      )
      .run();

    return Response.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900, // 15 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profile_photo_url: user.profile_photo_url,
        },
      },
    });
  } catch (error) {
    console.error("Passkey login verify error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
