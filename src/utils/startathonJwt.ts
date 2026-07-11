/**
 * Startathon JWT — standalone token flavor for the startathon module.
 * Signed with the shared JWT_SECRET but carries aud: "startathon" so
 * main-site tokens and startathon tokens are not interchangeable.
 */

export interface StartathonJWTPayload {
  sub: string; // startathon_users.user_id
  email: string;
  name: string;
  aud: "startathon";
  iat: number;
  exp: number;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}

async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

export async function generateStartathonJWT(
  userId: string,
  email: string,
  name: string,
  secret: string,
  expiresIn: number = 7 * 24 * 60 * 60, // 7 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload: StartathonJWTPayload = {
    sub: userId,
    email,
    name,
    aud: "startathon",
    iat: now,
    exp: now + expiresIn,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;
  const signature = await createSignature(dataToSign, secret);

  return `${dataToSign}.${signature}`;
}

export async function verifyStartathonJWT(
  token: string,
  secret: string,
): Promise<StartathonJWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = await createSignature(
      `${headerEncoded}.${payloadEncoded}`,
      secret,
    );
    if (signature !== expectedSignature) {
      return null;
    }

    const payload: StartathonJWTPayload = JSON.parse(
      base64UrlDecode(payloadEncoded),
    );

    // Reject main-site tokens (no aud) and anything else
    if (payload.aud !== "startathon") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Startathon JWT verification error:", error);
    return null;
  }
}

/** SHA-256 hex — same convention as the rest of the codebase. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
