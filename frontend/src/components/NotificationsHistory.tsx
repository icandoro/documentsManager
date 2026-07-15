"use client";

import { AppNotification, markAllNotificationsRead, readNotifications } from "@/lib/notifications";
import { AlertCircle, Bell, CheckCircle2, Clock, Info, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function notificationIcon(tone: AppNotification["tone"]) {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning") return ShieldAlert;
  if (tone === "error") return AlertCircle;
  return Info;
}

export function NotificationsHistory() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

  useEffect(() => {
    setNotifications(readNotifications());
  }, []);

  function markAllRead() {
    setNotifications(markAllNotificationsRead());
  }

  return (
    <>
      <section className="page-head notifications-page-head">
        <div>
          <p className="eyebrow">Alerte</p>
          <h1>Istoric notificari</h1>
          <p className="muted">Urmareste mesajele primite despre pachete, documente, semnare si securitate.</p>
        </div>
        <button className="secondary-button" type="button" onClick={markAllRead} disabled={unreadCount === 0}>
          Marcheaza toate ca citite
        </button>
      </section>

      <section className="notifications-history panel">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={34} />
            <h2>Nu ai alerte</h2>
            <p>Cand apar evenimente importante in cont, le vei vedea aici.</p>
          </div>
        ) : notifications.map((notification) => {
          const Icon = notificationIcon(notification.tone);

          return (
            <article className={`notification-history-row ${notification.tone} ${notification.read ? "read" : "unread"}`} key={notification.id}>
              <span className="notification-row-icon"><Icon size={20} /></span>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.description}</p>
                <small><Clock size={14} /> {notification.createdAt}</small>
              </div>
              {notification.href && <Link className="secondary-button" href={notification.href}>Deschide</Link>}
            </article>
          );
        })}
      </section>
    </>
  );
}
