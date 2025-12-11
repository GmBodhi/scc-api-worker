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

export class GoogleSheetsService {
  private config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Create JWT token
    const encodedHeader = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => ({'+': '-', '/': '_', '=': ''}[m] || ''));
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+/=]/g, (m) => ({'+': '-', '/': '_', '=': ''}[m] || ''));
    
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    
    // Sign with private key
    const privateKeyBuffer = this.pemToArrayBuffer(this.config.privateKey);
    const key = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(unsignedToken)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/[+/=]/g, (m) => ({'+': '-', '/': '_', '=': ''}[m] || ''));

    const jwt = `${unsignedToken}.${encodedSignature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    return tokenData.access_token;
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = pem.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async addStudentRegistration(student: StudentRegistrationRow): Promise<boolean> {
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
        student.upiRef || '',
        student.createdAt,
        student.updatedAt,
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to add student to Google Sheets:', await response.text());
        return false;
      }

      console.log(`Student ${student.id} added to Google Sheets`);
      return true;
    } catch (error) {
      console.error('Error adding student to Google Sheets:', error);
      return false;
    }
  }

  async updateStudentStatus(studentId: string, status: string, upiRef?: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      // First, find the row containing the student ID
      const searchResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!A:A`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        console.error('Failed to search Google Sheets:', await searchResponse.text());
        return false;
      }

      const searchData = await searchResponse.json() as { values?: string[][] };
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
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: updates,
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('Failed to update student in Google Sheets:', await updateResponse.text());
        return false;
      }

      console.log(`Student ${studentId} updated in Google Sheets - Status: ${status}${upiRef ? `, UPI Ref: ${upiRef}` : ''}`);
      return true;
    } catch (error) {
      console.error('Error updating student in Google Sheets:', error);
      return false;
    }
  }

  async initializeSheet(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Add headers to the first row if they don't exist
      const headers = [
        'ID',
        'Name',
        'Batch',
        'Email',
        'Phone Number',
        'Status',
        'UPI Ref',
        'Created At',
        'Updated At',
      ];

      // Check if headers already exist
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!1:1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { values?: string[][] };
        if (data.values && data.values[0] && data.values[0].length > 0) {
          // Headers already exist
          return true;
        }
      }

      // Add headers
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Sheet1!1:1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [headers],
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('Failed to initialize Google Sheets headers:', await updateResponse.text());
        return false;
      }

      console.log('Google Sheets initialized with headers');
      return true;
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      return false;
    }
  }

  async addMentorshipRegistration(mentorship: MentorshipRegistrationRow): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Convert mentorship data to row format
      const rowData = [
        mentorship.id,
        mentorship.name,
        mentorship.batch,
        mentorship.email,
        mentorship.phone,
        mentorship.technologies.join(', '),
        mentorship.createdAt,
        mentorship.updatedAt,
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to add mentorship to Google Sheets:', await response.text());
        return false;
      }

      console.log(`Mentorship ${mentorship.id} added to Google Sheets`);
      return true;
    } catch (error) {
      console.error('Error adding mentorship to Google Sheets:', error);
      return false;
    }
  }

  async initializeMentorshipSheet(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Add headers to the first row if they don't exist
      const headers = [
        'ID',
        'Name',
        'Batch',
        'Email',
        'Phone Number',
        'Technologies',
        'Created At',
        'Updated At',
      ];

      // Check if headers already exist
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships!1:1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as { values?: string[][] };
        if (data.values && data.values[0] && data.values[0].length > 0) {
          // Headers already exist
          return true;
        }
      }

      // Add headers
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/Mentorships!1:1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [headers],
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('Failed to initialize Mentorships Google Sheets headers:', await updateResponse.text());
        return false;
      }

      console.log('Mentorships Google Sheets initialized with headers');
      return true;
    } catch (error) {
      console.error('Error initializing Mentorships Google Sheets:', error);
      return false;
    }
  }
}
