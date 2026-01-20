# Signup Welcome Email & Phone Number Update

## Changes Implemented

### 1. Database Updates

- ✅ Added `phone` column to `users` table (nullable)
- ✅ Created index on `phone` for faster lookups
- ✅ Migration applied: `0017_add_phone_to_users.sql`

### 2. Welcome Email

- ✅ Created email template: `src/templates/welcome-email.ts`
- ✅ Added `sendWelcomeEmail()` method to `EmailService`
- ✅ Integrated with templateLoader utility

**Email Features:**

- Welcoming message with user's name
- Overview of club benefits (events, mentorship, projects)
- Call-to-action button to dashboard
- Social media links
- Professional branding

### 3. Signup Flow Updates

**Endpoint**: `POST /api/v3/auth/signup/complete`

**Updated Request Body:**

```json
{
  "signup_token": "token-from-etlab-verify",
  "password": "password123",
  "phone": "1234567890", // ← NEW (optional)
  "profile_photo": "base64-or-url",
  "profile_photo_filename": "photo.jpg"
}
```

**What happens on signup:**

1. User completes signup with password & optional phone
2. Password is hashed and stored
3. Phone number is saved to database
4. Profile photo is uploaded (if provided)
5. **Welcome email is automatically sent**
6. JWT tokens are generated and returned

**Email sending is non-blocking** - signup won't fail if email delivery fails.

### 4. Profile Updates

**Endpoint**: `POST /api/v3/auth/profile`

**Updated Request Body:**

```json
{
  "name": "New Name",
  "email": "new@email.com",
  "phone": "9876543210", // ← NEW (optional)
  "profile_photo": "base64-or-url-or-null"
}
```

Users can now update their phone number after signup.

---

## API Reference

### Phone Number Validation

- **Minimum**: 10 digits
- **Optional**: Can be omitted during signup
- **Nullable**: Can be cleared in profile updates

### Welcome Email Details

- **Subject**: "🎉 Welcome to SCT Coding Club!"
- **Sent to**: User's email address
- **Sent when**: Immediately after successful signup
- **Provider**: Brevo (via EmailService)

---

## Files Modified

1. `migrations/general/0017_add_phone_to_users.sql` - Database migration
2. `src/templates/welcome-email.ts` - Email template
3. `src/utils/templateLoader.ts` - Template export
4. `src/services/emailService.ts` - Email sending method
5. `src/types.ts` - Added phone to SignupCompleteRequest & UpdateProfileRequest
6. `src/endpoints/v3/signupComplete.ts` - Phone support + welcome email
7. `src/endpoints/v3/updateProfile.ts` - Phone update support
