# HackerRank Event Registration API

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
    "status": "confirmed"
  },
  "message": "Successfully registered for HackerRank event"
}
```

**Response Fields:**

- `registration_id`: Unique ID with `HR1_` prefix
- `event_id`: Always `"hackerrank_1"`
- `registered_at`: Unix timestamp
- `status`: Always `"confirmed"`

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

## Notes

- **Event-specific**: This endpoint is dedicated to the HackerRank event only
- **Duplicate Prevention**: Users can only register once per event
- **Auto-confirmation**: Registration status is automatically set to "confirmed"
- **User Linking**: Registration is automatically linked to the authenticated user's account
- **ID Format**: Registration IDs use the format `HR1_<timestamp>_<random>` for easy identification
