/**
 * Shared shape of the logistics roster, used by the read endpoint and by the
 * write endpoint's response so the two can never drift.
 */
export interface StartathonLogisticsMemberView {
  user_id: string;
  name: string;
  email: string;
  role: "leader" | "member";
  food_preference: "veg" | "non-veg" | null;
  dietary_notes: string | null;
  travel_mode: "train" | "bus" | "car" | "flight" | "own" | "other" | null;
  arrival_at: number | null;
  arrival_note: string | null;
  needs_travel_guidance: boolean;
  guidance_note: string | null;
  updated_by: string | null;
  updated_at: number | null;
}

/**
 * Every teammate, with their logistics row if they have written one.
 *
 * A LEFT JOIN out from startathon_users rather than a select over the
 * logistics table: the people who have answered nothing are exactly the ones
 * worth seeing, and a join in the other direction would hide them.
 */
export const LOGISTICS_ROSTER_QUERY = `
  SELECT u.user_id, u.name, u.email, u.role,
         l.food_preference, l.dietary_notes, l.travel_mode,
         l.arrival_at, l.arrival_note, l.needs_travel_guidance,
         l.guidance_note, l.updated_by, l.updated_at
  FROM startathon_users u
  LEFT JOIN startathon_participant_logistics l ON l.user_id = u.user_id
  WHERE u.team_id = ?
  ORDER BY CASE u.role WHEN 'leader' THEN 0 ELSE 1 END, u.name
`;

export function mapLogisticsRow(
  row: Record<string, unknown>,
): StartathonLogisticsMemberView {
  return {
    user_id: row.user_id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as "leader" | "member",
    food_preference: (row.food_preference as "veg" | "non-veg" | null) ?? null,
    dietary_notes: (row.dietary_notes as string | null) ?? null,
    travel_mode:
      (row.travel_mode as StartathonLogisticsMemberView["travel_mode"]) ?? null,
    arrival_at: (row.arrival_at as number | null) ?? null,
    arrival_note: (row.arrival_note as string | null) ?? null,
    // Stored as an integer; a member with no row at all reads as false, which
    // is the right default — nobody has asked for guidance until they say so.
    needs_travel_guidance: Boolean(row.needs_travel_guidance),
    guidance_note: (row.guidance_note as string | null) ?? null,
    updated_by: (row.updated_by as string | null) ?? null,
    updated_at: (row.updated_at as number | null) ?? null,
  };
}
