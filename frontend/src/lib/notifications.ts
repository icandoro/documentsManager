export type NotificationTone = "success" | "info" | "warning" | "error";
export type NotificationCategory = "document" | "security" | "account" | "system";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: NotificationTone;
  read: boolean;
  category?: NotificationCategory;
  href?: string;
};

export const notificationsStorageKey = "docmanager_notifications";

const defaultNotifications: AppNotification[] = [];

export function readNotifications() {
  if (typeof window === "undefined") return defaultNotifications;

  const saved = window.localStorage.getItem(notificationsStorageKey);

  if (!saved) return defaultNotifications;

  try {
    const parsed = JSON.parse(saved) as AppNotification[];

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(notificationsStorageKey);
  }

  return defaultNotifications;
}

export function writeNotifications(notifications: AppNotification[]) {
  window.localStorage.setItem(notificationsStorageKey, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent("docmanager-notifications-change"));
}

export function markAllNotificationsRead() {
  const next = readNotifications().map((notification) => ({ ...notification, read: true }));

  writeNotifications(next);
  return next;
}

export function markNotificationRead(id: string) {
  const next = readNotifications().map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification,
  );

  writeNotifications(next);
  return next;
}

export function deleteNotification(id: string) {
  const next = readNotifications().filter((notification) => notification.id !== id);

  writeNotifications(next);
  return next;
}

export function unreadNotificationsCount(notifications: AppNotification[]) {
  return notifications.filter((notification) => !notification.read).length;
}
