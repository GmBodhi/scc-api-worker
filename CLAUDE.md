# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker project that provides an OpenAPI 3.1 compliant REST API for transaction processing. The worker parses UPI transaction messages and extracts structured data from them. Built using Hono framework with chanfana for automatic OpenAPI schema generation.

## Architecture

- **Framework**: Hono web framework with chanfana for OpenAPI integration
- **Runtime**: Cloudflare Workers 
- **Database**: D1 database binding (`db`) connected to `scc_treasure_hunt_registrations`
- **Language**: TypeScript with ES2022 target
- **Validation**: Zod schemas for request/response validation

### Key Components

- `src/index.ts` - Main application entry point, defines routes and initializes Hono app
- `src/endpoints/` - OpenAPI route handlers (currently `transactionCreate.ts`)
- `src/services/` - Business logic (currently `transaction.ts` for parsing UPI messages)
- `src/types.ts` - Shared TypeScript types and Zod schemas
- `wrangler.jsonc` - Cloudflare Workers configuration with D1 database and environment variables

### Request Flow

1. Requests come to `/api/transaction` endpoint
2. Authorization validated against `TOKEN` environment variable
3. Raw transaction data parsed using regex to extract amount, date, VPA, and UPI reference
4. Structured data returned as JSON response

## Development Commands

```bash
# Start local development server with hot reload
wrangler dev

# Deploy to Cloudflare Workers
wrangler deploy

# Generate TypeScript types from Wrangler configuration  
wrangler types
```

## Database

The application uses Cloudflare D1 database with binding name `db`. Database ID and configuration are defined in `wrangler.jsonc`.

## Authentication

API endpoints require Bearer token authentication using the `TOKEN` environment variable defined in wrangler.jsonc. Requests without valid token return 404 status.

## Local Development

- Run `wrangler dev` to start local server on `http://localhost:8787/`
- Swagger UI available at root URL for testing endpoints
- Hot reload enabled for `src/` changes