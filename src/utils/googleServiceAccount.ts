/**
 * Mints a Google API access token for the project's service account.
 *
 * Same RS256 JWT-assertion flow as GoogleSheetsService.getAccessToken,
 * but with the scope as a parameter so callers other than Sheets can use
 * it. The Sheets service still carries its own copy — worth collapsing
 * into this one, but that code sits in the live registration path so it
 * isn't something to change as a side effect of an unrelated feature.
 */
export async function getGoogleAccessToken(opts: {
  serviceAccountEmail: string;
  privateKey: string;
  scope: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const base64url = (s: string) =>
    btoa(s).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" })[m] || "");

  const encodedHeader = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const encodedPayload = base64url(
    JSON.stringify({
      iss: opts.serviceAccountEmail,
      scope: opts.scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(opts.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );

  // Built byte by byte rather than String.fromCharCode(...spread) — a
  // spread over the signature array can blow the call stack.
  let binaryString = "";
  const signatureBytes = new Uint8Array(signature);
  for (let i = 0; i < signatureBytes.length; i++) {
    binaryString += String.fromCharCode(signatureBytes[i]);
  }

  const jwt = `${unsignedToken}.${base64url(binaryString)}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to get Google access token: ${await tokenResponse.text()}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const contents = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryString = atob(contents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
