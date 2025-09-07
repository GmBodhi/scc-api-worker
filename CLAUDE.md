# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker project that provides an OpenAPI 3.1 compliant REST API for the SCC Treasure Hunt event management system. The API handles student registrations, UPI transaction processing, payment verification, and automated follow-up emails. Built using Hono framework with chanfana for automatic OpenAPI schema generation.

## Architecture

- **Framework**: Hono web framework with chanfana for OpenAPI integration
- **Runtime**: Cloudflare Workers with scheduled events (cron triggers every 30 minutes)
- **Database**: D1 database binding (`db`) connected to `scc_treasure_hunt_registrations`
- **Email Service**: Brevo (formerly Sendinblue) API integration for transactional emails
- **Language**: TypeScript with ES2022 target
- **Validation**: Zod schemas for request/response validation

### Key Components

- `src/index.ts` - Main application entry point with HTTP routes and scheduled event handler
- `src/endpoints/` - OpenAPI route handlers for all API endpoints
- `src/services/` - Business logic including transaction parsing and email service
- `src/templates/` - Email HTML templates (payment confirmation, follow-up reminders)
- `src/scheduledWorker.ts` - Cron job handler for automated follow-up emails
- `src/types.ts` - Shared TypeScript types and Zod schemas
- `wrangler.jsonc` - Cloudflare Workers configuration with D1 database, cron triggers, and custom domain

### API Endpoints

- `POST /api/student` - Create new student registration (also updates Google Sheets)
- `POST /api/transaction` - Process UPI transaction data
- `POST /api/link` - Link transaction to student registration (also updates Google Sheets)
- `GET /api/ticket/:id` - Verify student ticket/registration
- `POST /api/verify-student` - Verify student by email/phone
- `POST /api/email-test` - Test email functionality
- `POST /api/initialize-sheets` - Initialize Google Sheets with headers

### Scheduled Jobs

- **Cron Schedule**: Every 30 minutes (`*/30 * * * *`)
- **Purpose**: Send follow-up payment reminders to students with pending status after 20 minutes
- **Database Tracking**: Prevents duplicate emails via `followup_emails` table

### Database Schema

Key tables include:
- `students` - Student registrations with status tracking
- `followup_emails` - Email delivery tracking to prevent duplicates

## Development Commands

```bash
# Start local development server with hot reload
wrangler dev

# Deploy to Cloudflare Workers  
wrangler deploy

# Generate TypeScript types from Wrangler configuration
wrangler types
```

## Environment Variables

The application requires these secrets (managed via `wrangler secret put`):
- `BREVO_API_KEY` - API key for email service integration
- `GOOGLE_SHEETS_ID` - The Google Sheets spreadsheet ID (from the URL)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email for Google Sheets API
- `GOOGLE_PRIVATE_KEY` - Private key for Google service account (in PEM format)

## Google Sheets Integration

The application automatically syncs student registration data to a Google Sheets spreadsheet. This provides a real-time dashboard for monitoring registrations and payment status.

### Setup Instructions

1. **Create Google Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Sheets API
   - Go to "Credentials" → "Create Credentials" → "Service Account"
   - Download the JSON key file

2. **Create Google Sheets**:
   - Create a new Google Sheets document
   - Share it with your service account email (with Editor permissions)
   - Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

3. **Set Environment Variables**:
   ```bash
   # Set the spreadsheet ID
   wrangler secret put GOOGLE_SHEETS_ID
   
   # Set the service account email (from JSON key file)
   wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
   
   # Set the private key (from JSON key file, keep the \n characters)
   wrangler secret put GOOGLE_PRIVATE_KEY
   ```

4. **Initialize the Sheet**:
   - Deploy the worker: `wrangler deploy`
   - Call the initialization endpoint: `POST /api/initialize-sheets`
   - This will set up column headers in your spreadsheet

### Data Flow

- **Student Registration** (`POST /api/student`): Adds a new row to the spreadsheet
- **Payment Linking** (`POST /api/link`): Updates the student's status to "paid" and adds UPI reference
- **Sheet Structure**:
  - Column A: Student ID
  - Column B: Name  
  - Column C: Batch
  - Column D: Email
  - Column E: Phone Number
  - Column F: Status (pending/paid)
  - Column G: UPI Reference
  - Column H: Created At
  - Column I: Updated At

### Error Handling

Google Sheets integration failures do not affect the main API functionality. If Sheets updates fail:
- The registration/payment linking will still succeed in the database
- Error details are logged for debugging
- Users receive normal success responses

## Local Development

- Run `wrangler dev` to start local server on `http://localhost:8787/`
- Swagger UI available at root URL for interactive API testing
- Hot reload enabled for `src/` changes
- Custom domain: `api.sctcoding.club` (production)