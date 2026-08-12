export interface TeamStatusBlock {
  status: 409 | 500;
  error: string;
}

/**
 * Gates application writes on the team having paid. Returns null when
 * the team is confirmed, or the error response to send.
 *
 * Teams start at 'payment-pending' (createTeam) and move to 'confirmed'
 * once the leader links a UPI reference (linkPayment). Reads are not
 * gated — only writes.
 *
 * 409 rather than 403 to match how the module reports actions blocked by
 * team status (see leaveTeam): the caller is permitted, the team is just
 * in the wrong state.
 */
export async function unconfirmedTeamBlock(
  db: D1Database,
  teamId: string,
): Promise<TeamStatusBlock | null> {
  const team = await db
    .prepare("SELECT status FROM startathon_teams WHERE team_id = ?")
    .bind(teamId)
    .first();

  if (!team) {
    return { status: 500, error: "Team not found" };
  }

  if (team.status !== "confirmed") {
    return {
      status: 409,
      error:
        "Your team isn't confirmed yet. Complete the team payment before submitting.",
    };
  }

  return null;
}

export interface StartathonApplicationMemberView {
  user_id: string;
  name: string;
  role: "leader" | "member";
  about: string | null;
  resume_url: string | null;
  github: string | null;
  linkedin: string | null;
  project_links: string[] | null;
  updated_at: number | null;
}

/**
 * Maps a joined startathon_users x startathon_application_members row.
 *
 * The join is a LEFT JOIN from the user side, so every teammate appears
 * whether or not they filled anything in — a row of nulls with
 * updated_at === null is a member who wrote nothing, which is a valid
 * (and visible) state rather than an absence.
 */
export function mapApplicationMemberRow(
  row: Record<string, unknown>,
): StartathonApplicationMemberView {
  return {
    user_id: row.user_id as string,
    name: row.name as string,
    role: row.role as "leader" | "member",
    about: (row.about as string | null) ?? null,
    resume_url: (row.resume_url as string | null) ?? null,
    github: (row.github as string | null) ?? null,
    linkedin: (row.linkedin as string | null) ?? null,
    project_links: row.project_links
      ? JSON.parse(row.project_links as string)
      : null,
    updated_at: (row.updated_at as number | null) ?? null,
  };
}

/** Full team roster with each member's application entry, if any. */
export const APPLICATION_MEMBERS_QUERY = `
  SELECT u.user_id, u.name, u.role,
         m.about, m.resume_url, m.github, m.linkedin, m.project_links,
         m.updated_at
  FROM startathon_users u
  LEFT JOIN startathon_application_members m
    ON m.user_id = u.user_id AND m.team_id = u.team_id
  WHERE u.team_id = ?
  ORDER BY CASE u.role WHEN 'leader' THEN 0 ELSE 1 END, u.name
`;
