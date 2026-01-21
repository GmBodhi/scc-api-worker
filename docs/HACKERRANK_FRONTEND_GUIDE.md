# HackerRank Event - Frontend Integration

## Flow Overview

**Two-Step Process:**

1. User registers (authenticated) → Status: `payment-pending`
2. Admin links payment → Status: `confirmed` → Email sent

---

## 1. Event Registration

### Endpoint

```
POST /api/v3/events/hackerrank_1
```

### Request

```typescript
// Headers
Authorization: Bearer <user-jwt-token>
Content-Type: application/json

// Body
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "batch": "2024"
}
```

### Response (201)

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

**⚠️ Important**: Save `registration_id` - needed for payment

### Errors

| Code | Error                             | Meaning                    |
| ---- | --------------------------------- | -------------------------- |
| 400  | Already registered for this event | User already signed up     |
| 401  | Invalid or expired token          | Re-authentication required |
| 400  | Email/phone already in use        | Duplicate contact info     |

---

## 2. Payment Linking (Admin Only)

### Endpoint

```
POST /api/v3/events/hackerrank_1/payment
```

### Request

```typescript
// No auth required
// Body
{
  "refId": "UPI123456789",              // UPI transaction reference
  "studentId": "HR1_1737379200_A1B2C3"  // Registration ID from step 1
}
```

### Response (200)

```json
{
  "success": true,
  "message": "Payment linked successfully. Registration confirmed. Confirmation email sent."
}
```

### Errors

| Code | Error                                               | Meaning                              |
| ---- | --------------------------------------------------- | ------------------------------------ |
| 400  | Transaction not found or already used               | Invalid or duplicate transaction     |
| 400  | Registration not found or payment already completed | Invalid registration or already paid |

---

## TypeScript Integration

### API Client

```typescript
interface HackerRankRegistration {
  registration_id: string;
  event_id: string;
  name: string;
  email: string;
  phone: string;
  batch: string;
  registered_at: number;
  status: "payment-pending" | "confirmed";
}

class HackerRankAPI {
  private baseUrl = "https://api.sctcoding.club/api/v3";

  // Step 1: Register for event
  async register(
    token: string,
    data: {
      name: string;
      email: string;
      phone: string;
      batch: string;
    },
  ): Promise<HackerRankRegistration> {
    const response = await fetch(`${this.baseUrl}/events/hackerrank_1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  }

  // Step 2: Link payment (admin only)
  async linkPayment(
    registrationId: string,
    transactionRef: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/events/hackerrank_1/payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: registrationId,
          refId: transactionRef,
        }),
      },
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }
  }
}

export const hackerRankAPI = new HackerRankAPI();
```

---

## React Components

### Registration Form

```typescript
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hackerRankAPI } from '@/api/hackerrank';

export function HackerRankRegistration() {
  const { token, user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    batch: ''
  });
  const [loading, setLoading] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await hackerRankAPI.register(token, formData);
      setRegistration(result);
      // Show payment instructions
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (registration) {
    return (
      <div className="success-state">
        <h2>Registration Successful!</h2>
        <div className="registration-details">
          <p><strong>Registration ID:</strong> {registration.registration_id}</p>
          <p><strong>Status:</strong> {registration.status}</p>
        </div>
        <div className="payment-instructions">
          <h3>Next Steps:</h3>
          <ol>
            <li>Make payment via UPI</li>
            <li>Note your transaction reference</li>
            <li>Share registration ID with admin: <code>{registration.registration_id}</code></li>
            <li>Admin will link payment and you'll receive confirmation email</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <h2>HackerRank Event Registration</h2>

      <input
        type="text"
        placeholder="Full Name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        required
      />

      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />

      <input
        type="tel"
        placeholder="Phone (10 digits)"
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
        required
        minLength={10}
      />

      <input
        type="text"
        placeholder="Batch (e.g., 2024)"
        value={formData.batch}
        onChange={(e) => setFormData({...formData, batch: e.target.value})}
        required
      />

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register Now'}
      </button>
    </form>
  );
}
```

### Payment Linking (Admin)

```typescript
import { useState } from 'react';
import { hackerRankAPI } from '@/api/hackerrank';

export function LinkPaymentForm() {
  const [registrationId, setRegistrationId] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await hackerRankAPI.linkPayment(registrationId, transactionRef);
      setSuccess(true);
      setRegistrationId('');
      setTransactionRef('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h3>Link Payment to Registration</h3>

      <input
        type="text"
        placeholder="Registration ID (HR1_...)"
        value={registrationId}
        onChange={(e) => setRegistrationId(e.target.value)}
        required
      />

      <input
        type="text"
        placeholder="UPI Transaction Reference"
        value={transactionRef}
        onChange={(e) => setTransactionRef(e.target.value)}
        required
      />

      {error && <div className="error">{error}</div>}
      {success && <div className="success">Payment linked successfully!</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Linking...' : 'Link Payment'}
      </button>
    </form>
  );
}
```

---

## Status Display

```typescript
type RegistrationStatus = 'payment-pending' | 'confirmed';

function StatusBadge({ status }: { status: RegistrationStatus }) {
  const config = {
    'payment-pending': {
      color: 'orange',
      icon: '⏳',
      text: 'Payment Pending'
    },
    'confirmed': {
      color: 'green',
      icon: '✓',
      text: 'Confirmed'
    }
  };

  const { color, icon, text } = config[status];

  return (
    <span className={`badge badge-${color}`}>
      {icon} {text}
    </span>
  );
}
```

---

## Error Handling

```typescript
async function registerWithErrorHandling(token: string, data: any) {
  try {
    const registration = await hackerRankAPI.register(token, data);
    return { success: true, data: registration };
  } catch (error) {
    if (error.message === "Already registered for this event") {
      return {
        success: false,
        error: "You have already registered for this event",
      };
    }

    if (error.message === "Invalid or expired token") {
      // Redirect to login
      window.location.href = "/login";
      return { success: false, error: "Please login again" };
    }

    return {
      success: false,
      error: "Registration failed. Please try again.",
    };
  }
}
```

---

## Key Points

✅ **Registration requires authentication** - User must be logged in  
✅ **Save registration ID** - Needed for payment linking  
✅ **Two statuses**: `payment-pending` → `confirmed`  
✅ **Payment linking** - Separate endpoint (admin operation)  
✅ **Email sent automatically** - When payment is confirmed  
✅ **One registration per user** - Duplicate prevention built-in

---

## Validation Rules

| Field | Rule                                 |
| ----- | ------------------------------------ |
| name  | Min 1 character                      |
| email | Valid email format                   |
| phone | Min 10 digits                        |
| batch | Min 1 character (e.g., "2024", "S6") |
