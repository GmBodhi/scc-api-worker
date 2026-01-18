# Database Split Setup Guide

## Database Structure

- **EVENTS_DB**: Existing database (scc_treasure_hunt_registrations) - stores event registrations
- **GENERAL_DB**: New database for authentication and general data

## Step 1: Create General Database

```bash
# Create General Database (for auth and general data)
npx wrangler d1 create scc-general-db
```

Save the database ID and update it in wrangler.jsonc.

## Step 2: Run Migrations

Migrations are organized into separate folders:

- `migrations/events/` - Event registration tables (for EVENTS_DB)
- `migrations/general/` - Auth and user tables (for GENERAL_DB)

### Events DB (Already has existing migrations)

The EVENTS_DB is your existing database and already contains:

- transactions, students, refunds, followup_emails, mentorships, mentorship_program

If you need to set up a fresh EVENTS_DB:

```bash
# Run events migrations in order
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0001_create_transactions_table.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0002_create_students_table.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0003_add_status_to_transactions.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0004_add_upiref_to_students.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0005_update_students_unique_constraints.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0006_create_followup_emails_table.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0007_create_refunds_table.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0008_create_mentorships_table.sql
npx wrangler d1 execute scc_treasure_hunt_registrations --local --file=./migrations/events/0009_create_mentorship_program_table.sql
```

### General DB Migrations:

```bash
# Run general migrations for auth tables in order
npx wrangler d1 execute scc-general-db --local --file=./migrations/general/0010_create_users_table.sql
npx wrangler d1 execute scc-general-db --local --file=./migrations/general/0011_create_passkey_credentials_table.sql
npx wrangler d1 execute scc-general-db --local --file=./migrations/general/0012_create_sessions_table.sql
npx wrangler d1 execute scc-general-db --local --file=./migrations/general/0013_create_challenges_table.sql
npx wrangler d1 execute scc-general-db --local --file=./migrations/general/0014_create_refresh_tokens_table.sql

# For production, remove --local flag
```

## Step 3: Code Updates

The code has been updated to use:

- `c.env.EVENTS_DB` for event-related tables (transactions, students, mentorships, etc.)
- `c.env.GENERAL_DB` for auth-related tables (users, sessions, passkeys, etc.)

All v1 and v2 endpoints use EVENTS_DB.
All v3 endpoints and middleware use GENERAL_DB.
