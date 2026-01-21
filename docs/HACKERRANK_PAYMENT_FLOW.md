# HackerRank Event Payment Flow

## Implementation Summary

Successfully created a two-step payment flow for HackerRank event registrations, similar to the existing treasure hunt flow.

---

## Flow Overview

### Step 1: Registration (Payment Pending)

1. User registers for HackerRank event (authenticated)
2. Registration created with `status: "payment-pending"`
3. Returns registration ID (format: `HR1_<timestamp>_<random>`)

### Step 2: Payment Verification

1. Admin/system links UPI transaction to registration
2. Transaction status updated: `unused` → `used`
3. Registration status updated: `payment-pending` → `confirmed`
4. Confirmation email sent automatically

---

## Files Created

### 1. Payment Confirmation Email Template

**File**: `src/templates/hackerrank-payment-confirmation.ts`

Features:

- Professional email design with gradient branding
- Registration details (ID, transaction ref)
- Event information and next steps
- Call-to-action button
- Social media links

### 2. Payment Linking Endpoint

**File**: `src/endpoints/v3/linkHackerRankPayment.ts`

**Route**: `POST /api/v3/events/hackerrank_1/payment`

Functionality:

- Validates transaction exists and is unused
- Validates registration exists and is payment-pending
- Links transaction to registration
- Updates both statuses
- Sends confirmation email (non-blocking)

---

## Files Modified

### 1. Event Signup Endpoint

**File**: `src/endpoints/v3/eventSignup.ts`

Changes:

- Initial status: `"confirmed"` → `"payment-pending"`
- Message: Updated to indicate payment required

### 2. Email Service

**File**: `src/services/emailService.ts`

Added:

- `sendHackerRankPaymentConfirmationEmail()` method
- Subject: "🎉 Payment Confirmed - HackerRank Event Registration"

### 3. Template Loader

**File**: `src/utils/templateLoader.ts`

Added:

- Import and export for HackerRank payment template

### 4. Routes Registration

**File**: `src/endpoints/v3/index.ts`

Added:

- `POST /events/hackerrank_1/payment` route

### 5. Documentation

**File**: `docs/HACKERRANK_EVENT_API.md`

Updated:

- Two-step process overview
- Payment linking endpoint documentation
- Complete flow example
- Updated response statuses

---

## API Endpoints

### Registration

```
POST /api/v3/events/hackerrank_1
Authorization: Bearer <token>

Body: { name, email, phone, batch }
Response: { registration_id, status: "payment-pending" }
```

### Payment Linking

```
POST /api/v3/events/hackerrank_1/payment

Body: { refId, studentId: registration_id }
Response: { success: true, message: "..." }
```

---

## Database Schema

Uses existing tables:

- `hackerrank_registrations` - Status field updated
- `transactions` - Reuses existing transaction table

Registration statuses:

- `payment-pending` - Initial registration, awaiting payment
- `confirmed` - Payment verified, registration complete

---

## Email Flow

1. **Registration**: No email sent (payment pending)
2. **Payment Linked**: Confirmation email sent with:
   - Registration ID
   - Transaction reference
   - Event details
   - Next steps
   - Dashboard link

---

## Error Handling

### Registration Endpoint

- Duplicate registration check
- Email/phone uniqueness validation
- Authentication requirement

### Payment Endpoint

- Transaction not found or already used
- Registration not found or already paid
- Non-blocking email failures

---

## Usage Example

```typescript
// Step 1: Register
const registration = await registerForEvent({
  name: "John Doe",
  email: "john@example.com",
  phone: "1234567890",
  batch: "2024",
});
// registration.data.status === "payment-pending"
// registration.data.registration_id === "HR1_..."

// Step 2: User makes payment via UPI

// Step 3: Link payment (admin/automated)
await linkPayment({
  refId: "UPI123456789",
  studentId: registration.data.registration_id,
});
// Email sent, status updated to "confirmed"
```

---

## Key Features

✅ **Two-Step Process** - Register then pay  
✅ **Payment Verification** - Prevents duplicate payments  
✅ **Automated Emails** - Confirmation sent after payment  
✅ **Status Tracking** - Clear payment-pending vs confirmed states  
✅ **Transaction Reuse Prevention** - Each transaction used once  
✅ **Non-Blocking Email** - Payment succeeds even if email fails  
✅ **Comprehensive Documentation** - API docs with examples

---

## Testing

1. Register for event → Get registration ID with payment-pending status
2. Create/verify UPI transaction exists in database
3. Link payment using registration ID and transaction ref
4. Verify status updated to confirmed
5. Check email delivery
6. Test error cases (invalid refs, already used, etc.)
