/**
 * Notification utilities for creating system notifications
 */

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "event";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  db: D1Database;
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  userId,
  title,
  message,
  type = "info",
  link,
  db,
}: CreateNotificationParams): Promise<string> {
  const notificationId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, link, created_at, read, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    )
    .bind(notificationId, userId, title, message, type, link || null, now)
    .run();

  return notificationId;
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(
  notificationId: string,
  db: D1Database,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("UPDATE notifications SET read = 1, read_at = ? WHERE id = ?")
    .bind(now, notificationId)
    .run();
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(
  userId: string,
  db: D1Database,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "UPDATE notifications SET read = 1, read_at = ? WHERE user_id = ? AND read = 0",
    )
    .bind(now, userId)
    .run();
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  db: D1Database,
): Promise<void> {
  await db
    .prepare("DELETE FROM notifications WHERE id = ?")
    .bind(notificationId)
    .run();
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
  userId: string,
  db: D1Database,
): Promise<number> {
  const result = await db
    .prepare(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0",
    )
    .bind(userId)
    .first<{ count: number }>();

  return result?.count || 0;
}
