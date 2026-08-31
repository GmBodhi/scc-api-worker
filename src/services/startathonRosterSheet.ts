import { GoogleSheetsService } from "./googleSheetsService";
import { STARTATHON_TEAM_FEE, STARTATHON_TEAM_REFERRAL_FEE } from "../types";

/**
 * The two Startathon exports into Google Sheets.
 *
 * `syncStartathonRosterSheet` is the shortlisted roster: who is on which team,
 * whether their ₹250 selection fee is in, and what they said about food and
 * travel. `syncStartathonTeamsSheet` is the registration ledger: every
 * confirmed team and the ₹100 (or ₹90 with a referral) transfer that confirmed
 * it. Different grain, different audience, different tab — see
 * STARTATHON_TEAMS_TAB in googleSheetsService for why they are not one sheet.
 *
 * Only the roster runs on a schedule. The ledger was a one-off export and is
 * now uncalled by design; see its own comment below.
 *
 * Both are written as whole-table snapshots rather than incremental row edits.
 * Most of what changes here never passes through a request that could carry a
 * row update — a payment confirms from the bank-SMS webhook or from the
 * five-minute sweep, long after the participant's own call finished. A
 * snapshot is right whichever path moved the data.
 */

interface RosterRow {
  user_id: string;
  name: string | null;
  email: string;
  phone: string | null;
  college: string | null;
  team_id: string;
  team_name: string;
  role: string;
  leader_id: string;
  payment_status: string | null;
  payment_amount: number | null;
  payment_heads: number | null;
  payment_ref: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  confirmed_at: number | null;
  food_preference: string | null;
  dietary_notes: string | null;
  travel_mode: string | null;
  arrival_at: number | null;
  arrival_note: string | null;
  needs_travel_guidance: number | null;
  guidance_note: string | null;
  logistics_updated_by_name: string | null;
  logistics_updated_at: number | null;
}

/**
 * Every member of every shortlisted team, whether or not they have paid or
 * answered anything.
 *
 * Both joins are LEFT joins out from the roster: the rows worth chasing are
 * precisely the ones with nothing on the right-hand side, and an inner join
 * would hide them. Ordered by team so the sheet reads as teams, not as a
 * scatter of names.
 */
const ROSTER_QUERY = `
  SELECT u.user_id, u.name, u.email, u.phone, u.college,
         t.team_id, t.team_name, u.role, t.leader_id,
         p.status AS payment_status,
         p.amount AS payment_amount,
         (SELECT COUNT(*) FROM startathon_selection_payment_covers c2
           WHERE c2.payment_id = p.payment_id) AS payment_heads,
         p.transaction_ref AS payment_ref,
         p.payer_user_id,
         payer.name AS payer_name,
         p.confirmed_at,
         l.food_preference, l.dietary_notes, l.travel_mode,
         l.arrival_at, l.arrival_note, l.needs_travel_guidance,
         l.guidance_note,
         filler.name AS logistics_updated_by_name,
         l.updated_at AS logistics_updated_at
  FROM startathon_users u
  JOIN startathon_teams t ON t.team_id = u.team_id
  LEFT JOIN startathon_selection_payment_covers cv ON cv.user_id = u.user_id
  LEFT JOIN startathon_selection_payments p ON p.payment_id = cv.payment_id
  LEFT JOIN startathon_users payer ON payer.user_id = p.payer_user_id
  LEFT JOIN startathon_participant_logistics l ON l.user_id = u.user_id
  LEFT JOIN startathon_users filler ON filler.user_id = l.updated_by
  WHERE t.shortlist_status = 'shortlisted'
  ORDER BY t.team_name, CASE u.role WHEN 'leader' THEN 0 ELSE 1 END, u.name
`;

function isoOrBlank(seconds: number | null): string {
  return seconds ? new Date(seconds * 1000).toISOString() : "";
}

/**
 * Pushes the current roster to the sheet. Returns false when the Google
 * credentials are unset, which is the state of any environment not wired to a
 * spreadsheet — not an error worth throwing over.
 */
export async function syncStartathonRosterSheet(env: Env): Promise<boolean> {
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    return false;
  }

  const roster = await env.EVENTS_DB.prepare(ROSTER_QUERY).all<RosterRow>();
  const rows = roster.results ?? [];

  const sheets = new GoogleSheetsService({
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
  });

  return sheets.syncStartathonRoster(
    rows.map((row) => ({
      userId: row.user_id,
      name: row.name ?? "",
      email: row.email,
      phone: row.phone ?? "",
      college: row.college ?? "",
      teamId: row.team_id,
      teamName: row.team_name,
      role: row.role,
      // "unpaid" rather than blank: a person reading a column of blanks cannot
      // tell "owes money" from "column not filled in yet".
      paymentStatus: row.payment_status ?? "unpaid",
      // This person's share, not the transfer it came in. A ₹750 payment
      // covering three people used to print 750 on all three rows, so summing
      // the column counted the money three times. The transfer itself is kept
      // in its own column, where it reads as context rather than as a total.
      paymentAmount:
        row.payment_amount && row.payment_heads
          ? String(row.payment_amount / row.payment_heads)
          : "",
      transferTotal:
        row.payment_amount && row.payment_heads
          ? row.payment_heads > 1
            ? `${row.payment_amount} (${row.payment_heads} people)`
            : String(row.payment_amount)
          : "",
      paymentRef: row.payment_ref ?? "",
      // Whether they paid their own or a teammate covered them, which is the
      // difference between chasing them and chasing their leader.
      paidBy: row.payer_user_id
        ? row.payer_user_id === row.user_id
          ? "self"
          : (row.payer_name ?? row.payer_user_id)
        : "",
      paidAt: isoOrBlank(row.confirmed_at),
      foodPreference: row.food_preference ?? "",
      dietaryNotes: row.dietary_notes ?? "",
      travelMode: row.travel_mode ?? "",
      arrival: isoOrBlank(row.arrival_at),
      arrivalNote: row.arrival_note ?? "",
      needsGuidance:
        row.logistics_updated_at === null
          ? ""
          : row.needs_travel_guidance
            ? "yes"
            : "no",
      guidanceNote: row.guidance_note ?? "",
      logisticsFilledBy: row.logistics_updated_by_name ?? "",
      logisticsUpdatedAt: isoOrBlank(row.logistics_updated_at),
    })),
  );
}

interface TeamRow {
  team_id: string;
  team_name: string;
  status: string;
  shortlist_status: string | null;
  transaction_ref: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referred_by_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: number | null;
  updated_at: number | null;
  leader_name: string | null;
  leader_email: string | null;
  leader_phone: string | null;
  leader_college: string | null;
  member_count: number;
  member_list: string | null;
  referrals_made: number;
  paid_amount: number | null;
  paid_date: string | null;
  payer_vpa: string | null;
}

/**
 * Every confirmed team with the registration transfer that confirmed it.
 *
 * `status = 'confirmed'` is the whole filter: a payment-pending team has no
 * money to reconcile, and shortlisting is a second axis reported as its own
 * column rather than narrowing the set — finance wants all the ₹100s, not the
 * twenty that advanced.
 *
 * The transaction join is LEFT for the same reason the roster's is: a
 * confirmed team whose `transaction_ref` finds no row is exactly the anomaly
 * worth seeing, and an inner join would hide it. Same for the leader join,
 * which cannot miss in practice but must not be able to drop a team from a
 * financial export if it ever does.
 *
 * `referred_by` is stored as a team_id, which nobody recognises, so it is
 * resolved to the referring team's name here rather than in the sheet.
 */
const TEAMS_QUERY = `
  SELECT t.team_id, t.team_name, t.status, t.shortlist_status,
         t.transaction_ref, t.referral_code, t.referred_by,
         ref.team_name AS referred_by_name,
         t.utm_source, t.utm_medium, t.utm_campaign,
         t.created_at, t.updated_at,
         lead.name AS leader_name, lead.email AS leader_email,
         lead.phone AS leader_phone, lead.college AS leader_college,
         (SELECT COUNT(*) FROM startathon_users m
           WHERE m.team_id = t.team_id) AS member_count,
         (SELECT group_concat(
                   COALESCE(m2.name, '(no name)') || ' <' || m2.email || '>',
                   '; ')
            FROM startathon_users m2
           WHERE m2.team_id = t.team_id
             AND m2.user_id != t.leader_id) AS member_list,
         (SELECT COUNT(*) FROM startathon_teams r
           WHERE r.referred_by = t.team_id
             AND r.status = 'confirmed') AS referrals_made,
         x.amount AS paid_amount,
         x.date AS paid_date,
         x.vpa AS payer_vpa
  FROM startathon_teams t
  LEFT JOIN startathon_users lead ON lead.user_id = t.leader_id
  LEFT JOIN startathon_teams ref ON ref.team_id = t.referred_by
  LEFT JOIN startathon_transactions x ON x.ref = t.transaction_ref
  WHERE t.status = 'confirmed'
  ORDER BY t.team_name
`;

/**
 * Pushes every confirmed team to the registration-fee tab. Returns false on
 * unset Google credentials, same as the roster sync — an environment with no
 * spreadsheet is a configuration state, not a failure.
 *
 * Deliberately uncalled. The registration ledger was a one-off export, so it
 * is off the half-hourly cron and the StartathonTeams tab is frozen at
 * whatever it last held — anyone editing that tab by hand will not be
 * overwritten. Kept rather than deleted so the export can be re-run if the
 * numbers are ever wanted again; wire it back into scheduledWorker, or call it
 * once, to do that.
 */
export async function syncStartathonTeamsSheet(env: Env): Promise<boolean> {
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    return false;
  }

  const teams = await env.EVENTS_DB.prepare(TEAMS_QUERY).all<TeamRow>();
  const rows = teams.results ?? [];

  const sheets = new GoogleSheetsService({
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
  });

  return sheets.syncStartathonTeams(
    rows.map((row) => {
      // What the team owed, from the same rule linkPayment enforced: a
      // referral applied before payment buys 10% off, and applyReferral locks
      // referred_by once the team confirms, so this still reads the value that
      // was in force at the moment the transfer was checked.
      const expectedFee = row.referred_by
        ? STARTATHON_TEAM_REFERRAL_FEE
        : STARTATHON_TEAM_FEE;

      return {
        teamId: row.team_id,
        teamName: row.team_name,
        status: row.status,
        // Blank, not "none": a team that was never shortlisted and a team
        // still awaiting the decision are the same absence in the data, and
        // writing a word here would claim a distinction the column cannot make.
        shortlist: row.shortlist_status ?? "",
        leaderName: row.leader_name ?? "",
        leaderEmail: row.leader_email ?? "",
        leaderPhone: row.leader_phone ?? "",
        leaderCollege: row.leader_college ?? "",
        memberCount: String(row.member_count),
        members: row.member_list ?? "",
        expectedFee: String(expectedFee),
        paidAmount: row.paid_amount === null ? "" : String(row.paid_amount),
        // The reason this tab exists as a reconciliation view rather than a
        // dump: a confirmed team whose transfer is missing or off the expected
        // amount is one filter away, instead of a column of numbers to compare
        // by eye. Blank when there is no transaction to judge — "no" would
        // read as an amount mismatch rather than a missing row.
        amountMatches:
          row.paid_amount === null
            ? ""
            : row.paid_amount === expectedFee
              ? "yes"
              : "no",
        upiRef: row.transaction_ref ?? "",
        // Straight from the bank SMS, whose own format is what the parser
        // stored. Reformatting it here would misrepresent what the bank said.
        paidDate: row.paid_date ?? "",
        payerVpa: row.payer_vpa ?? "",
        referralCode: row.referral_code ?? "",
        // The referring team's name; blank when nobody referred them.
        referredByTeam: row.referred_by_name ?? "",
        // Confirmed referrals only, matching what getTeam shows the leader —
        // so a leader querying the API and an organiser reading the sheet
        // never see two different numbers for the same team.
        referralsMade: String(row.referrals_made),
        utmSource: row.utm_source ?? "",
        utmMedium: row.utm_medium ?? "",
        utmCampaign: row.utm_campaign ?? "",
        createdAt: isoOrBlank(row.created_at),
        updatedAt: isoOrBlank(row.updated_at),
      };
    }),
  );
}
