# HackerRank Event Registration API

## Overview

**Two-step registration process:**

1. **Register** - Create registration with payment-pending status
2. **Complete Payment** - Link transaction to confirm registration

---

## 1. Register for Event

## Endpoint

```
POST /api/v3/events/hackerrank_1
```

**Authentication Required**: Yes (Bearer token)

---

## Request

### Headers

```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "batch": "2024"
}
```

### Fields

| Field   | Type   | Required | Validation                           |
| ------- | ------ | -------- | ------------------------------------ |
| `name`  | string | ✅       | Min 1 character                      |
| `email` | string | ✅       | Valid email format                   |
| `phone` | string | ✅       | Min 10 digits                        |
| `batch` | string | ✅       | Min 1 character (e.g., "2024", "S6") |

---

## Responses

### ✅ Success (201 Created)

```json
{
  "success": true,
  "data": {
    "registration_id": "HR1_1737379200_A1B2C3",
    "event_id": "hackerrank_1",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "batch": "2024",
    "registered_at": 1737379200,
    "status": "payment-pending"
  },
  "message": "Registration successful. Please complete payment to confirm."
}
```

**Response Fields:**

- `registration_id`: Unique ID with `HR1_` prefix - **Save this for payment**
- `event_id`: Always `"hackerrank_1"`
- `registered_at`: Unix timestamp
- `status`: `"payment-pending"` - Registration awaiting payment

---

### ❌ Error Responses

#### Already Registered (400)

```json
{
  "success": false,
  "error": "Already registered for this event"
}
```

#### Invalid Data (400)

```json
{
  "success": false,
  "error": "Name is required"
}
```

Possible validation errors:

- `"Name is required"`
- `"Valid email is required"`
- `"Phone number must be at least 10 digits"`
- `"Batch is required"`
- `"The email or phone number is already in use for this event"`

#### Unauthorized (401)

```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

#### Server Error (500)

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Usage Example

### JavaScript/TypeScript

```typescript
const response = await fetch(
  "https://api.sctcoding.club/api/v3/events/hackerrank_1",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      batch: "2024",
    }),
  },
);

const data = await response.json();

if (data.success) {
  console.log("Registered:", data.data.registration_id);
} else {
  console.error("Error:", data.error);
}
```

### cURL

```bash
curl -X POST https://api.sctcoding.club/api/v3/events/hackerrank_1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "batch": "2024"
  }'
```

---

## 2. Complete Payment

### Endpoint

```
POST /api/v3/events/hackerrank_1/payment
```

**Authentication Required**: No

### Request Body

```json
{
  "refId": "UPI123456789",
  "studentId": "HR1_1737379200_A1B2C3"
}
```

**Fields:**

- `refId` (string): UPI transaction reference ID
- `studentId` (string): Registration ID from step 1

### Success Response (200)

```json
{
  "success": true,
  "message": "Payment linked successfully. Registration confirmed. Confirmation email sent."
}
```

### Error Responses

**Transaction Not Found (400)**

```json
{
  "success": false,
  "message": "Transaction not found or already used"
}
```

**Registration Not Found (400)**

```json
{
  "success": false,
  "message": "Registration not found or payment already completed"
}
```

---

## Complete Flow Example

### Step 1: Register

```typescript
// User registers for event
const registerResponse = await fetch("/api/v3/events/hackerrank_1", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    batch: "2024",
  }),
});

const registration = await registerResponse.json();
const registrationId = registration.data.registration_id; // Save this!
// Status: "payment-pending"
```

### Step 2: Complete Payment

```typescript
// After user makes UPI payment, link it to registration
const paymentResponse = await fetch("/api/v3/events/hackerrank_1/payment", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    refId: "UPI123456789", // From transaction
    studentId: registrationId, // From step 1
  }),
});

const paymentResult = await paymentResponse.json();
// User receives confirmation email
// Status updated to: "confirmed"
```

---

## Notes

- **Two-Step Process**: Register first, then link payment
- **Payment-Pending**: Initial registration status until payment is verified
- **Email Confirmation**: Sent automatically when payment is linked
- **Duplicate Prevention**: Users can only register once per event
- **Transaction Validation**: Each transaction can only be used once
- **User Linking**: Registration automatically linked to authenticated user
- **ID Format**: Registration IDs use format `HR1_<timestamp>_<random>`
