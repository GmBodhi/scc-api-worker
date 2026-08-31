interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

interface StudentRegistrationRow {
  id: string;
  name: string;
  batch: string;
  email: string;
  phoneNumber: string;
  status: string;
  upiRef?: string;
  createdAt: string;
  updatedAt: string;
}

interface MentorshipRegistrationRow {
  id: string;
  name: string;
  batch: string;
  email: string;
  phone: string;
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

interface MentorshipProgramRegistrationRow {
  id: string;
  name: string;
  batch: string;
  email: string;
  phone: string;
  experienceLevel: string;
  projectIdea: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface StartathonRosterSheetRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  college: string;
  teamId: string;
  teamName: string;
  role: string;
  paymentStatus: string;
  paymentAmount: string;
  transferTotal: string;
  paymentRef: string;
  paidBy: string;
  paidAt: string;
  foodPreference: string;
  dietaryNotes: string;
  travelMode: string;
  arrival: string;
  arrivalNote: string;
  needsGuidance: string;
  guidanceNote: string;
  logisticsFilledBy: string;
  logisticsUpdatedAt: string;
}

/**
 * One confirmed team on the registration-fee tab. Every field is already a
 * string: the sheet is a report, so the formatting decisions (blank vs zero,
 * "yes" vs "no") are made once, where the data is understood, rather than
 * again in the writer.
 */
interface StartathonTeamsSheetRow {
  teamId: string;
  teamName: string;
  status: string;
  shortlist: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  leaderCollege: string;
  memberCount: string;
  members: string;
  expectedFee: string;
  paidAmount: string;
  amountMatches: string;
  upiRef: string;
  paidDate: string;
  payerVpa: string;
  referralCode: string;
  referredByTeam: string;
  referralsMade: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  createdAt: string;
  updatedAt: string;
}

export class GoogleSheetsService {
  private config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    // Create JWT token
    const encodedHeader = btoa(JSON.stringify(header)).replace(
      /[+/=]/g,
      (m) => ({ "+": "-", "/": "_", "=": "" })[m] || "",
    );
    const encodedPayload = btoa(JSON.stringify(payload)).replace(
      /[+/=]/g,
      (m) => ({ "+": "-", "/": "_", "=": "" })[m] || "",
    );

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Sign with private key
    const privateKeyBuffer = this.pemToArrayBuffer(this.config.privateKey);
    const key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedToken),
    );

    // Convert signature to base64url safely (avoid spread operator on large arrays)
    let binaryString = "";
    const signatureBytes = new Uint8Array(signature);
    for (let i = 0; i < signatureBytes.length; i++) {
      binaryString += String.fromCharCode(signatureBytes[i]);
    }
    const encodedSignature = btoa(binaryString).replace(
      /[+/=]/g,
      (m) => ({ "+": "-", "/": "_", "=": "" })[m] || "",
    );

    const jwt = `${unsignedToken}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Failed to get access token: ${await tokenResponse.text()}`,
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    return tokenData.access_token;
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pem
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async addStudentRegistration(
    student: StudentRegistrationRow,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Convert student data to row format
      const rowData = [
        student.id,
        student.name,
        student.batch,
        student.email,
        student.phoneNumber,
        student.status,
        student.upiRef || "",
        student.createdAt,
        student.updatedAt,
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Failed to add student to Google Sheets:",
          await response.text(),
        );
        return false;
      }

      console.log(`Student ${student.id} added to Google Sheets`);
      return true;
    } catch (error) {
      console.error("Error adding student to Google Sheets:", error);
      return false;
    }
  }

  async updateStudentStatus(
    studentId: string,
    status: string,
    upiRef?: string,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // First, find the row containing the student ID
      const searchResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!A:A`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!searchResponse.ok) {
        console.error(
          "Failed to search Google Sheets:",
          await searchResponse.text(),
        );
        return false;
      }

      const searchData = (await searchResponse.json()) as {
        values?: string[][];
      };
      const values = searchData.values || [];

      // Find the row index (1-based) where the student ID matches
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === studentId) {
          rowIndex = i + 1; // Convert to 1-based index
          break;
        }
      }

      if (rowIndex === -1) {
        console.error(`Student ${studentId} not found in Google Sheets`);
        return false;
      }

      // Update the status column (column F, index 5) and upiRef column (column G, index 6)
      const updates = [];

      // Update status
      updates.push({
        range: `Sheet1!F${rowIndex}`,
        values: [[status]],
      });

      // Update upiRef if provided
      if (upiRef) {
        updates.push({
          range: `Sheet1!G${rowIndex}`,
          values: [[upiRef]],
        });
      }

      // Update updatedAt column (column I, index 8)
      updates.push({
        range: `Sheet1!I${rowIndex}`,
        values: [[new Date().toISOString()]],
      });

      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: updates,
          }),
        },
      );

      if (!updateResponse.ok) {
        console.error(
          "Failed to update student in Google Sheets:",
          await updateResponse.text(),
        );
        return false;
      }

      console.log(
        `Student ${studentId} updated in Google Sheets - Status: ${status}${upiRef ? `, UPI Ref: ${upiRef}` : ""}`,
      );
      return true;
    } catch (error) {
      console.error("Error updating student in Google Sheets:", error);
      return false;
    }
  }

  async initializeSheet(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Add headers to the first row if they don't exist
      const headers = [
        "ID",
        "Name",
        "Batch",
        "Email",
        "Phone Number",
        "Status",
        "UPI Ref",
        "Created At",
        "Updated At",
      ];

      // Check if headers already exist
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!1:1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { values?: string[][] };
        if (data.values && data.values[0] && data.values[0].length > 0) {
          // Headers already exist
          return true;
        }
      }

      // Add headers
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!1:1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        },
      );

      if (!updateResponse.ok) {
        console.error(
          "Failed to initialize Google Sheets headers:",
          await updateResponse.text(),
        );
        return false;
      }

      console.log("Google Sheets initialized with headers");
      return true;
    } catch (error) {
      console.error("Error initializing Google Sheets:", error);
      return false;
    }
  }

  async addMentorshipRegistration(
    mentorship: MentorshipRegistrationRow,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Convert mentorship data to row format
      const rowData = [
        mentorship.id,
        mentorship.name,
        mentorship.batch,
        mentorship.email,
        mentorship.phone,
        mentorship.technologies.join(", "),
        mentorship.createdAt,
        mentorship.updatedAt,
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Failed to add mentorship to Google Sheets:",
          await response.text(),
        );
        return false;
      }

      console.log(`Mentorship ${mentorship.id} added to Google Sheets`);
      return true;
    } catch (error) {
      console.error("Error adding mentorship to Google Sheets:", error);
      return false;
    }
  }

  async initializeMentorshipSheet(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Add headers to the first row if they don't exist
      const headers = [
        "ID",
        "Name",
        "Batch",
        "Email",
        "Phone Number",
        "Technologies",
        "Created At",
        "Updated At",
      ];

      // Check if headers already exist
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships!1:1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { values?: string[][] };
        if (data.values && data.values[0] && data.values[0].length > 0) {
          // Headers already exist
          return true;
        }
      }

      // Add headers
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships!1:1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        },
      );

      if (!updateResponse.ok) {
        console.error(
          "Failed to initialize Mentorships Google Sheets headers:",
          await updateResponse.text(),
        );
        return false;
      }

      console.log("Mentorships Google Sheets initialized with headers");
      return true;
    } catch (error) {
      console.error("Error initializing Mentorships Google Sheets:", error);
      return false;
    }
  }

  async addMentorshipProgramRegistration(
    registration: MentorshipProgramRegistrationRow,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Convert registration data to row format
      const rowData = [
        registration.id,
        registration.name,
        registration.batch,
        registration.email,
        registration.phone,
        registration.experienceLevel,
        registration.projectIdea,
        registration.status,
        registration.createdAt,
        registration.updatedAt,
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/MentorshipProgram:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Failed to add mentorship program registration to Google Sheets:",
          await response.text(),
        );
        return false;
      }

      console.log(
        `Mentorship program registration ${registration.id} added to Google Sheets`,
      );
      return true;
    } catch (error) {
      console.error(
        "Error adding mentorship program registration to Google Sheets:",
        error,
      );
      return false;
    }
  }

  async initializeMentorshipProgramSheet(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      // Add headers to the first row if they don't exist
      const headers = [
        "ID",
        "Name",
        "Batch",
        "Email",
        "Phone Number",
        "Experience Level",
        "Project Idea",
        "Status",
        "Created At",
        "Updated At",
      ];

      // Check if headers already exist
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/MentorshipProgram!1:1`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { values?: string[][] };
        if (data.values && data.values[0] && data.values[0].length > 0) {
          // Headers already exist
          return true;
        }
      }

      // Add headers
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/MentorshipProgram!1:1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        },
      );

      if (!updateResponse.ok) {
        console.error(
          "Failed to initialize MentorshipProgram Google Sheets headers:",
          await updateResponse.text(),
        );
        return false;
      }

      console.log("MentorshipProgram Google Sheets initialized with headers");
      return true;
    } catch (error) {
      console.error(
        "Error initializing MentorshipProgram Google Sheets:",
        error,
      );
      return false;
    }
  }

  /**
   * Tab the whole shortlisted roster is mirrored into.
   *
   * One tab, one row per participant, carrying both the money and the travel
   * answers. Splitting them would mean catering and finance reconciling two
   * sheets by hand, and the questions they actually ask — "who is coming, has
   * she paid, and what does she eat" — are answered on one line here.
   */
  private static readonly STARTATHON_ROSTER_TAB = "StartathonRoster";

  private static readonly STARTATHON_ROSTER_HEADERS = [
    "User ID",
    "Name",
    "Email",
    "Phone",
    "College",
    "Team ID",
    "Team Name",
    "Role",
    "Payment",
    "Amount",
    "Transfer Total",
    "UPI Ref",
    "Paid By",
    "Paid At",
    "Food",
    "Dietary Notes",
    "Travel Mode",
    "Expected Arrival",
    "Arrival Note",
    "Needs Travel Guidance",
    "Guidance Note",
    "Logistics Filled By",
    "Logistics Updated At",
  ];

  private static rosterRowValues(row: StartathonRosterSheetRow): string[] {
    return [
      row.userId,
      row.name,
      row.email,
      row.phone,
      row.college,
      row.teamId,
      row.teamName,
      row.role,
      row.paymentStatus,
      row.paymentAmount,
      row.transferTotal,
      row.paymentRef,
      row.paidBy,
      row.paidAt,
      row.foodPreference,
      row.dietaryNotes,
      row.travelMode,
      row.arrival,
      row.arrivalNote,
      row.needsGuidance,
      row.guidanceNote,
      row.logisticsFilledBy,
      row.logisticsUpdatedAt,
    ];
  }

  /**
   * Creates a tab if the spreadsheet does not have it yet. Every values call
   * below addresses its tab by name, and Sheets answers 400 for a range naming
   * a tab that does not exist — so without this the first write fails instead
   * of self-healing.
   */
  private async ensureTab(
    accessToken: string,
    title: string,
  ): Promise<boolean> {
    const meta = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!meta.ok) {
      console.error("Failed to read spreadsheet metadata:", await meta.text());
      return false;
    }

    const body = (await meta.json()) as {
      sheets?: Array<{ properties?: { title?: string } }>;
    };

    if (
      (body.sheets ?? []).some((sheet) => sheet.properties?.title === title)
    ) {
      return true;
    }

    const created = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title } } }],
        }),
      },
    );

    if (!created.ok) {
      console.error(`Failed to create ${title} tab:`, await created.text());
      return false;
    }

    console.log(`Created ${title} tab`);
    return true;
  }

  /**
   * Clears a tab and writes headers plus rows back into it, in that order.
   *
   * Shared by both Startathon tabs because both are whole-table snapshots for
   * the same reason: what changes in them mostly arrives outside any request
   * that could have edited a single row — a payment confirms from the bank-SMS
   * webhook or from the sweep. The clear is what handles shrinkage; without it
   * a member who leaves a team keeps a row nothing ever rewrites.
   *
   * `lastColumn` must match the header count, or a shrinking export leaves
   * stale columns to the right of the new ones.
   */
  private async replaceTab(
    accessToken: string,
    title: string,
    lastColumn: string,
    values: string[][],
  ): Promise<boolean> {
    const cleared = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${title}!A:${lastColumn}:clear`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!cleared.ok) {
      console.error(`Failed to clear ${title} tab:`, await cleared.text());
      return false;
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${title}!A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      },
    );

    if (!response.ok) {
      console.error(`Failed to write ${title} rows:`, await response.text());
      return false;
    }

    return true;
  }

  /**
   * Rewrites the roster tab from scratch: headers, then one row per
   * participant.
   *
   * A whole-snapshot write rather than per-row upserts, because most of what
   * lands here never passes through a request that could update one row —
   * payments confirm from the bank webhook and from the five-minute sweep. A
   * snapshot is correct no matter which path changed the data, and it is one
   * API call instead of a read-then-write per person.
   *
   * The clear before the write is what handles shrinkage: a member who leaves
   * a team would otherwise keep a row nothing ever rewrites.
   */
  async syncStartathonRoster(
    rows: StartathonRosterSheetRow[],
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const tab = GoogleSheetsService.STARTATHON_ROSTER_TAB;

      if (!(await this.ensureTab(accessToken, tab))) {
        return false;
      }

      const written = await this.replaceTab(accessToken, tab, "W", [
        GoogleSheetsService.STARTATHON_ROSTER_HEADERS,
        ...rows.map((row) => GoogleSheetsService.rosterRowValues(row)),
      ]);

      if (!written) {
        return false;
      }

      console.log(`StartathonRoster synced: ${rows.length} participant(s)`);
      return true;
    } catch (error) {
      console.error("Error syncing StartathonRoster:", error);
      return false;
    }
  }

  /**
   * Tab holding every confirmed team and the ₹100/₹90 registration transfer
   * that confirmed it.
   *
   * Separate from the roster tab rather than more columns on it, because the
   * two answer different questions for different people at different times:
   * this one is finance reconciling registration money across every confirmed
   * team, the roster is catering and travel for the twenty shortlisted ones.
   * One row per team here, one row per person there — merging them would
   * repeat each team's single transfer down four member rows, the same
   * triple-counting the roster's Amount column already had to be fixed for.
   */
  private static readonly STARTATHON_TEAMS_TAB = "StartathonTeams";

  private static readonly STARTATHON_TEAMS_HEADERS = [
    "Team ID",
    "Team Name",
    "Status",
    "Shortlist",
    "Leader",
    "Leader Email",
    "Leader Phone",
    "Leader College",
    "Team Size",
    "Other Members",
    "Expected Fee",
    "Paid Amount",
    "Amount Matches",
    "UPI Ref",
    "Paid On",
    "Payer VPA",
    "Referral Code",
    "Referred By",
    "Referrals Confirmed",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "Created At",
    "Updated At",
  ];

  private static teamsRowValues(row: StartathonTeamsSheetRow): string[] {
    return [
      row.teamId,
      row.teamName,
      row.status,
      row.shortlist,
      row.leaderName,
      row.leaderEmail,
      row.leaderPhone,
      row.leaderCollege,
      row.memberCount,
      row.members,
      row.expectedFee,
      row.paidAmount,
      row.amountMatches,
      row.upiRef,
      row.paidDate,
      row.payerVpa,
      row.referralCode,
      row.referredByTeam,
      row.referralsMade,
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.createdAt,
      row.updatedAt,
    ];
  }

  /**
   * Rewrites the confirmed-teams tab from scratch: headers, then one row per
   * team. 24 headers, so the clear runs to column X.
   */
  async syncStartathonTeams(rows: StartathonTeamsSheetRow[]): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const tab = GoogleSheetsService.STARTATHON_TEAMS_TAB;

      if (!(await this.ensureTab(accessToken, tab))) {
        return false;
      }

      const written = await this.replaceTab(accessToken, tab, "X", [
        GoogleSheetsService.STARTATHON_TEAMS_HEADERS,
        ...rows.map((row) => GoogleSheetsService.teamsRowValues(row)),
      ]);

      if (!written) {
        return false;
      }

      console.log(`StartathonTeams synced: ${rows.length} team(s)`);
      return true;
    } catch (error) {
      console.error("Error syncing StartathonTeams:", error);
      return false;
    }
  }
}
