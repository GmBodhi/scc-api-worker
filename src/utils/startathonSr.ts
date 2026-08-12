import type { AppContext } from "../types";

/** How long an untouched claim is held before it returns to the pool. */
export const SR_CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a no-answer team rests before it can be dealt again.
 *
 * Without a cooldown a released team is instantly re-eligible and, because
 * claims deal oldest-first, lands straight back on the same caller's list.
 * Four hours puts it behind everything untried and roughly matches "try
 * again later in the day".
 */
export const SR_NO_ANSWER_RETRY_MS = 4 * 60 * 60 * 1000;

/** Default and ceiling for how many contacts one claim hands out. */
export const SR_CLAIM_DEFAULT_COUNT = 5;
export const SR_CLAIM_MAX_COUNT = 25;

export interface SrCaller {
  caller_id: string;
  name: string;
  email: string | null;
  active: number;
}

/**
 * Who's calling.
 *
 * `admin` is the organiser holding SR_TOKEN — it can manage callers and read
 * the whole campaign, but has no caller identity, so it cannot claim teams or
 * file calls. `caller` is a volunteer holding their own token.
 */
export type SrIdentity =
  | { kind: "admin"; caller: null }
  | { kind: "caller"; caller: SrCaller };

/** Freshly minted per-caller secret. Shown once, at creation or rotation. */
export function newCallerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `sr_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resolves the Authorization header to an identity.
 *
 * The token IS the identity — nothing is read from the request body — so one
 * volunteer cannot file calls under a colleague's name, and a lost phone is
 * revoked by rotating that one caller's token rather than the whole team's.
 *
 * Fails closed when SR_TOKEN is unset rather than falling back to TOKEN: the
 * separation exists precisely because this credential lives in browsers, and
 * an empty binding would otherwise match an empty header.
 *
 * Answers 404 rather than 401, matching transactionIngest — staff routes
 * shouldn't confirm their own existence to an unauthenticated caller.
 */
export async function srAuth(
  c: AppContext,
): Promise<{ identity: SrIdentity } | { response: Response }> {
  const deny = () =>
    ({
      response: c.json({ success: false, error: "Not found" }, 404),
    }) as const;

  const adminToken = c.env.SR_TOKEN;
  if (!adminToken) {
    console.error("SR_TOKEN is not configured — SR routes are disabled");
    return deny();
  }

  const presented = c.req.header("Authorization");
  if (!presented) return deny();

  if (presented === adminToken) {
    return { identity: { kind: "admin", caller: null } };
  }

  const row = await c.env.EVENTS_DB.prepare(
    `SELECT caller_id, name, email, active
       FROM startathon_sr_callers
      WHERE token = ? AND active = 1`,
  )
    .bind(presented)
    .first();

  if (!row) return deny();

  return {
    identity: { kind: "caller", caller: row as unknown as SrCaller },
  };
}

/**
 * Narrows an identity to a caller, or produces the error response.
 *
 * Claiming and filing are acts by a person; the admin key deliberately can't
 * do them, because a call filed by "the organiser token" would be a hole in
 * exactly the accountability this change adds.
 */
export function requireCaller(
  c: AppContext,
  identity: SrIdentity,
): { caller: SrCaller } | { response: Response } {
  if (identity.kind !== "caller") {
    return {
      response: c.json(
        {
          success: false,
          error:
            "This needs a personal caller token — the admin token can't make calls.",
        },
        403,
      ),
    };
  }
  return { caller: identity.caller };
}

export interface SrContactPerson {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  college: string | null;
  role: "leader" | "member";
}

export interface SrContact {
  team_id: string;
  team_name: string;
  status: string;
  transaction_ref: string | null;
  leader: SrContactPerson | null;
  members: SrContactPerson[];
  has_application: boolean;
  caller_id: string;
  caller_name: string;
  claimed_at: number;
  outcome: string | null;
  feedback: SrFeedbackEntry[] | null;
  called_at: number | null;
  updated_at: number | null;
  /** How many times this team has been rung. Survives re-claiming. */
  attempts: number;
}

export interface SrFeedbackEntry {
  question: string;
  answer: string;
}

/**
 * Call rows joined to the team, the assigned caller, and whether an
 * application exists — "have you submitted yet?" is asked on every call,
 * so it travels with the contact instead of costing a second request.
 *
 * Callers append their own WHERE clause and bindings after this.
 */
const CALL_ROWS_QUERY = `
  SELECT c.team_id, c.caller_id, c.claimed_at, c.outcome, c.feedback,
         c.called_at, c.updated_at, c.attempts,
         t.team_name, t.status, t.transaction_ref,
         r.name AS caller_name,
         (a.team_id IS NOT NULL) AS has_application
  FROM startathon_sr_calls c
  JOIN startathon_teams t ON t.team_id = c.team_id
  JOIN startathon_sr_callers r ON r.caller_id = c.caller_id
  LEFT JOIN startathon_applications a ON a.team_id = c.team_id
`;

const ROSTER_QUERY = `
  SELECT user_id, name, email, phone, college, role, team_id
  FROM startathon_users
  WHERE team_id IN (SELECT value FROM json_each(?))
  ORDER BY CASE role WHEN 'leader' THEN 0 ELSE 1 END, name
`;

/**
 * Loads call rows matching `where`, then attaches each team's full roster
 * in one extra query rather than one per team.
 *
 * The whole roster ships, not just the leader: a caller whose leader
 * doesn't pick up needs a number to fall back to without another round
 * trip.
 */
export async function loadContacts(
  db: D1Database,
  where: string,
  bindings: unknown[],
): Promise<SrContact[]> {
  const calls = await db
    .prepare(`${CALL_ROWS_QUERY} ${where}`)
    .bind(...bindings)
    .all();

  const rows = calls.results as unknown as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const teamIds = rows.map((r) => r.team_id as string);
  const roster = await db
    .prepare(ROSTER_QUERY)
    .bind(JSON.stringify(teamIds))
    .all();

  const byTeam = new Map<string, SrContactPerson[]>();
  for (const raw of roster.results as unknown as Record<string, unknown>[]) {
    const teamId = raw.team_id as string;
    const person: SrContactPerson = {
      user_id: raw.user_id as string,
      name: raw.name as string,
      email: raw.email as string,
      phone: (raw.phone as string | null) ?? null,
      college: (raw.college as string | null) ?? null,
      role: raw.role as "leader" | "member",
    };
    const list = byTeam.get(teamId);
    if (list) list.push(person);
    else byTeam.set(teamId, [person]);
  }

  return rows.map((row) => {
    const people = byTeam.get(row.team_id as string) ?? [];
    return {
      team_id: row.team_id as string,
      team_name: row.team_name as string,
      status: row.status as string,
      transaction_ref: (row.transaction_ref as string | null) ?? null,
      leader: people.find((p) => p.role === "leader") ?? null,
      members: people.filter((p) => p.role !== "leader"),
      has_application: Boolean(row.has_application),
      caller_id: row.caller_id as string,
      caller_name: row.caller_name as string,
      claimed_at: row.claimed_at as number,
      outcome: (row.outcome as string | null) ?? null,
      feedback: row.feedback ? JSON.parse(row.feedback as string) : null,
      called_at: (row.called_at as number | null) ?? null,
      updated_at: (row.updated_at as number | null) ?? null,
      attempts: (row.attempts as number | null) ?? 0,
    };
  });
}
