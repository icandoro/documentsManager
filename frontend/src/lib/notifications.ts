export type NotificationTone = "success" | "info" | "warning" | "error";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: NotificationTone;
  read: boolean;
  href?: string;
};

export const notificationsStorageKey = "docmanager_notifications";

const defaultNotifications: AppNotification[] = [
  {
    id: "notif-received-package",
    title: "Pachet nou primit",
    description: "Ai primit un pachet pentru semnare: Dosar angajare.",
    createdAt: "azi, 10:24",
    tone: "info",
    read: false,
    href: "/documents/received",
  },
  {
    id: "notif-signed-document",
    title: "Document semnat",
    description: "Contract de munca a fost incarcat semnat de destinatar.",
    createdAt: "ieri, 16:10",
    tone: "success",
    read: false,
    href: "/documents/sent",
  },
  {
    id: "notif-security",
    title: "Recomandare security",
    description: "Activeaza autentificarea in doi pasi pentru protectie suplimentara.",
    createdAt: "12 iul. 2026",
    tone: "warning",
    read: true,
    href: "/profile#security",
  },
];

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

export function unreadNotificationsCount(notifications: AppNotification[]) {
  return notifications.filter((notification) => !notification.read).length;
}
