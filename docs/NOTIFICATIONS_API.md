# Notifications API Documentation

## Overview

The notifications system provides real-time user notifications for events, system messages, and user actions. All notification endpoints require authentication.

## Base URL

```
/api/v3/notifications
```

## Authentication

All endpoints require a Bearer token:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## Notification Types

- `info` - General information
- `success` - Success messages
- `warning` - Warning messages
- `error` - Error messages
- `event` - Event-related notifications

---

## Endpoints

### 1. Get Notifications

Retrieve all notifications for the authenticated user.

**Endpoint:** `GET /api/v3/notifications`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| unread_only | boolean | No | If true, returns only unread notifications |
| limit | number | No | Maximum number of notifications to return (default: 50) |

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "user-123",
        "title": "Payment Confirmed",
        "message": "Your payment for HackerRank event has been confirmed",
        "type": "success",
        "link": "/events/hackerrank_1",
        "read": 0,
        "created_at": 1704067200,
        "read_at": null
      }
    ],
    "unread_count": 5
  }
}
```

**Example Usage:**

```javascript
// Get all notifications
const response = await fetch("/api/v3/notifications", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
const { data } = await response.json();

// Get only unread notifications
const unreadResponse = await fetch("/api/v3/notifications?unread_only=true", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// Get limited notifications
const limitedResponse = await fetch("/api/v3/notifications?limit=10", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

### 2. Create Notification (System Use)

Create a new notification for a user. This endpoint is typically used by system processes, not end users.

**Endpoint:** `POST /api/v3/notifications`

**Request Body:**

```json
{
  "user_id": "user-123",
  "title": "Event Registration",
  "message": "You have successfully registered for HackerRank event",
  "type": "event",
  "link": "/events/hackerrank_1"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | string | Yes | ID of the user to notify |
| title | string | Yes | Notification title |
| message | string | Yes | Notification message |
| type | string | No | Notification type (default: "info") |
| link | string | No | Optional link for the notification |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-123",
    "title": "Event Registration",
    "message": "You have successfully registered for HackerRank event",
    "type": "event",
    "link": "/events/hackerrank_1",
    "read": 0,
    "created_at": 1704067200,
    "read_at": null
  },
  "message": "Notification created successfully"
}
```

**Example Usage:**

```javascript
const response = await fetch("/api/v3/notifications", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    user_id: "user-123",
    title: "Welcome!",
    message: "Welcome to our platform",
    type: "info",
  }),
});
```

---

### 3. Mark Notification as Read

Mark a single notification as read.

**Endpoint:** `PUT /api/v3/notifications/:id/read`

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Notification ID |

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Error Response (Not Found):**

```json
{
  "success": false,
  "error": "Notification not found or unauthorized"
}
```

**Example Usage:**

```javascript
const notificationId = "550e8400-e29b-41d4-a716-446655440000";
const response = await fetch(`/api/v3/notifications/${notificationId}/read`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

### 4. Mark All Notifications as Read

Mark all unread notifications as read for the authenticated user.

**Endpoint:** `PUT /api/v3/notifications/read-all`

**Response:**

```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

**Example Usage:**

```javascript
const response = await fetch("/api/v3/notifications/read-all", {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

### 5. Delete Notification

Delete a specific notification.

**Endpoint:** `DELETE /api/v3/notifications/:id`

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Notification ID |

**Response:**

```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Error Response (Not Found):**

```json
{
  "success": false,
  "error": "Notification not found or unauthorized"
}
```

**Example Usage:**

```javascript
const notificationId = "550e8400-e29b-41d4-a716-446655440000";
const response = await fetch(`/api/v3/notifications/${notificationId}`, {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

## Frontend Integration Examples

### React Component Example

```typescript
import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'event';
  link?: string;
  read: number;
  created_at: number;
  read_at?: number;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/v3/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const { data } = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/v3/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: 1, read_at: Math.floor(Date.now() / 1000) }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/v3/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      // Update local state
      const now = Math.floor(Date.now() / 1000);
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: 1, read_at: n.read_at || now }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/v3/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  if (loading) return <div>Loading notifications...</div>;

  return (
    <div className="notification-center">
      <div className="notification-header">
        <h2>Notifications</h2>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
        {unreadCount > 0 && (
          <button onClick={markAllAsRead}>Mark all as read</button>
        )}
      </div>

      <div className="notification-list">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification ${notification.read ? 'read' : 'unread'} ${notification.type}`}
          >
            <div className="notification-content">
              <h3>{notification.title}</h3>
              <p>{notification.message}</p>
              <span className="timestamp">
                {new Date(notification.created_at * 1000).toLocaleString()}
              </span>
            </div>
            <div className="notification-actions">
              {!notification.read && (
                <button onClick={() => markAsRead(notification.id)}>
                  Mark as read
                </button>
              )}
              <button onClick={() => deleteNotification(notification.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Vue Component Example

```vue
<template>
  <div class="notification-center">
    <div class="notification-header">
      <h2>Notifications</h2>
      <span v-if="unreadCount > 0" class="unread-badge">
        {{ unreadCount }}
      </span>
      <button v-if="unreadCount > 0" @click="markAllAsRead">
        Mark all as read
      </button>
    </div>

    <div class="notification-list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'notification',
          notification.read ? 'read' : 'unread',
          notification.type,
        ]"
      >
        <div class="notification-content">
          <h3>{{ notification.title }}</h3>
          <p>{{ notification.message }}</p>
          <span class="timestamp">
            {{ formatDate(notification.created_at) }}
          </span>
        </div>
        <div class="notification-actions">
          <button
            v-if="!notification.read"
            @click="markAsRead(notification.id)"
          >
            Mark as read
          </button>
          <button @click="deleteNotification(notification.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "event";
  link?: string;
  read: number;
  created_at: number;
  read_at?: number;
}

const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);

onMounted(() => {
  fetchNotifications();
});

const fetchNotifications = async () => {
  try {
    const response = await fetch("/api/v3/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });
    const { data } = await response.json();
    notifications.value = data.notifications;
    unreadCount.value = data.unread_count;
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
  }
};

const markAsRead = async (notificationId: string) => {
  try {
    await fetch(`/api/v3/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });

    const notification = notifications.value.find(
      (n) => n.id === notificationId,
    );
    if (notification) {
      notification.read = 1;
      notification.read_at = Math.floor(Date.now() / 1000);
    }
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch (error) {
    console.error("Failed to mark as read:", error);
  }
};

const markAllAsRead = async () => {
  try {
    await fetch("/api/v3/notifications/read-all", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });

    const now = Math.floor(Date.now() / 1000);
    notifications.value.forEach((n) => {
      n.read = 1;
      n.read_at = n.read_at || now;
    });
    unreadCount.value = 0;
  } catch (error) {
    console.error("Failed to mark all as read:", error);
  }
};

const deleteNotification = async (notificationId: string) => {
  try {
    await fetch(`/api/v3/notifications/${notificationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });

    notifications.value = notifications.value.filter(
      (n) => n.id !== notificationId,
    );
  } catch (error) {
    console.error("Failed to delete notification:", error);
  }
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString();
};
</script>
```

---

## Utility Helper Usage

For creating notifications programmatically in your backend code:

```typescript
import { createNotification } from "../utils/notifications";

// Create a notification
await createNotification({
  userId: user.id,
  title: "Payment Confirmed",
  message: "Your payment has been successfully processed",
  type: "success",
  link: "/payments/history",
  db: c.env.GENERAL_DB,
});

// Example: In event signup
await createNotification({
  userId: user.id,
  title: "Event Registration Successful",
  message: "You have successfully registered for the HackerRank event",
  type: "event",
  link: "/events/hackerrank_1",
  db: c.env.GENERAL_DB,
});

// Example: In password reset
await createNotification({
  userId: user.id,
  title: "Password Reset Successful",
  message: "Your password has been changed successfully",
  type: "success",
  db: c.env.GENERAL_DB,
});
```

---

## Real-time Updates

For real-time notification updates, you can poll the API or use WebSockets (if implemented):

### Polling Example

```typescript
// Poll every 30 seconds
setInterval(async () => {
  const response = await fetch("/api/v3/notifications?unread_only=true", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const { data } = await response.json();
  updateNotificationBadge(data.unread_count);
}, 30000);
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not found
- `500` - Internal server error

---

## Best Practices

1. **Pagination**: Use the `limit` parameter for large notification lists
2. **Filtering**: Use `unread_only=true` for notification badges
3. **Optimistic Updates**: Update UI immediately, rollback on error
4. **Error Handling**: Always handle network errors gracefully
5. **Refresh Strategy**: Poll every 30-60 seconds or on user action
6. **Notification Types**: Use appropriate types for better UI/UX
7. **Links**: Provide navigation links in notifications when applicable
