# EtLab Verification Refactoring Summary

## Overview

Refactored the authentication flow to make EtLab verification optional. Users can now create accounts without EtLab verification and verify their accounts later.

## Changes Made

### 1. Database Migration

**File:** `migrations/general/0019_add_is_verified_to_users.sql`

- Added `is_verified` column to users table (INTEGER, default 0)
- Existing users with `etlab_username` are automatically marked as verified (set to 1)
- Added index on `is_verified` for faster lookups

### 2. New Signup Endpoint

**File:** `src/endpoints/v3/signup.ts`

- **Route:** `POST /api/v3/auth/signup`
- **Purpose:** Create accounts without EtLab verification
- **Required fields:** `email`, `name`
- **Behavior:**
  - Creates a new user with `is_verified = 0`
  - Generates a signup token (valid for 10 minutes)
  - Returns user_id and signup_token for completing setup
- **Response includes:** `user_id`, `signup_token`, `email`, `name`, `is_verified`

### 3. Refactored EtLab Verification

**File:** `src/endpoints/v3/etlabVerify.ts`

- **Route:** `POST /api/v3/auth/etlab/verify`
- **Purpose:** Link EtLab account to existing user
- **Changes:**
  - Now requires authentication (Bearer token)
  - Updates existing user instead of creating new one
  - Sets `is_verified = 1` upon successful verification
  - Checks if user is already verified
  - Prevents duplicate EtLab username usage
  - No longer generates signup token
- **Response includes:** user data with `is_verified: true`

### 4. Updated Middleware

**File:** `src/middleware/auth.ts`

- Added `is_verified` to `AuthUser` interface
- Updated database query to include `is_verified` field
- Returns `is_verified` as boolean in authentication result

### 5. Updated Type Definitions

**File:** `src/types.ts`

Added new schemas:

- `SignupRequest`: `{ email, name }`
- `SignupResponse`: includes `is_verified` field

Updated existing schemas:

- `EtlabVerifyResponse`: removed `signup_token`, added `is_verified` and `message`
- `GetCurrentUserResponse`: added `is_verified`
- `UpdateProfileResponse`: added `is_verified`

### 6. Updated Endpoints

**Files Modified:**

- `src/endpoints/v3/getCurrentUser.ts` - Returns `is_verified` in response
- `src/endpoints/v3/updateProfile.ts` - Includes `is_verified` in query and response
- `src/endpoints/v3/signupComplete.ts` - Updated to query specific fields including `is_verified`

### 7. Route Registration

**File:** `src/endpoints/v3/index.ts`

- Imported and registered new `Signup` endpoint
- Route order: `/auth/signup` → `/auth/etlab/verify` → `/auth/signup/complete` → `/auth/login`

## New Authentication Flow

### Flow 1: Regular Signup (No EtLab)

1. `POST /api/v3/auth/signup` with `{ email, name }`
   - Creates user with `is_verified = false`
   - Returns `signup_token`
2. `POST /api/v3/auth/signup/complete` with `{ signup_token, password, phone?, profile_photo? }`
   - Sets password and completes account setup
   - Returns access and refresh tokens
3. User is logged in (but `is_verified = false`)

### Flow 2: Later EtLab Verification

1. User logs in with email/password
2. `POST /api/v3/auth/etlab/verify` with `{ username, password }` (requires auth)
   - Verifies EtLab credentials
   - Updates user with `etlab_username` and `is_verified = true`
   - Updates profile photo if available from EtLab

## Migration Considerations

### Existing Data Handling

✅ **Automatically handled in migration:**

- All existing users with `etlab_username` are marked as `is_verified = 1`
- Preserves verification status of existing users
- No manual data migration required

### Breaking Changes

⚠️ **API Changes:**

- `EtlabVerify` endpoint now requires authentication (Bearer token)
- `EtlabVerify` response no longer includes `signup_token`
- All user-related responses now include `is_verified` field

### Frontend Integration

Frontend needs to update for:

1. **New signup flow:** Call `/auth/signup` instead of `/auth/etlab/verify` first
2. **EtLab verification:** Move to profile settings, requires authentication
3. **User interface:** Display verification status (`is_verified` field)
4. **Profile updates:** Handle new `is_verified` field in responses

## Benefits

1. **Flexibility:** Users can sign up without EtLab credentials
2. **Progressive Enhancement:** Users can verify later when ready
3. **Backward Compatibility:** Existing verified users remain verified
4. **Security:** EtLab verification now requires authentication
5. **Better UX:** Simpler initial signup process

## Testing Checklist

- [ ] Run migration on development database
- [ ] Test regular signup flow (without EtLab)
- [ ] Test signup completion with password
- [ ] Test login with email/password
- [ ] Test EtLab verification for existing logged-in user
- [ ] Verify `is_verified` field appears in all relevant endpoints
- [ ] Test that EtLab verification requires authentication
- [ ] Test duplicate EtLab username prevention
- [ ] Verify existing users maintain their verification status

## Deployment Steps

1. **Run migration:** Apply `0019_add_is_verified_to_users.sql`
2. **Deploy code:** Deploy updated endpoints and types
3. **Update frontend:** Implement new signup flow
4. **Monitor logs:** Check for any authentication issues
5. **Verify data:** Confirm existing users have correct `is_verified` status
