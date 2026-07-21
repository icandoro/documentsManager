"use client";

import {
  AppNotification,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  readNotifications,
  unreadNotificationsCount,
} from "@/lib/notifications";
import { readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import { packageDocumentTitle, readReceivedPackages, readSentPackages } from "@/lib/packages";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  FileInput,
  FileOutput,
  Filter,
  Info,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ActivityRow = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  direction: "intrare" | "iesire";
  status: string;
  tone: AppNotification["tone"];
  href: string;
};

type HistoryMode = "alerts" | "activity";
type NotificationFilter = "all" | "unread" | "document" | "security" | "account" | "system";

function notificationIcon(tone: AppNotification["tone"]) {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning") return ShieldAlert;
  if (tone === "error") return AlertCircle;
  return Info;
}

function activityTone(status: string): AppNotification["tone"] {
  const normalized = status.toLowerCase();

  if (normalized.includes("semnat") || normalized.includes("primit") || normalized.includes("confirm")) return "success";
  if (normalized.includes("partial")) return "info";
  if (normalized.includes("asteapta") || normalized.includes("semnare")) return "warning";

  return "info";
}

function categoryLabel(category?: AppNotification["category"]) {
  if (category === "security") return "Securitate";
  if (category === "account") return "Cont";
  if (category === "system") return "Sistem";
  return "Documente";
}

function buildActivityRows(contextId: string): ActivityRow[] {
  const receivedRows = readReceivedPackages(contextId).flatMap((group) =>
    group.packages.map((pkg) => ({
      id: `received-${group.email}-${pkg.name}-${pkg.date}`,
      title: pkg.name,
      description: `${group.from} · ${group.email} · ${pkg.documents.length} document${pkg.documents.length === 1 ? "" : "e"}`,
      createdAt: pkg.date,
      direction: "intrare" as const,
      status: pkg.status,
      tone: activityTone(pkg.status),
      href: "/documents/received",
    })),
  );
  const sentRows = readSentPackages(contextId).flatMap((group) =>
    group.packages.map((pkg) => ({
      id: `sent-${group.email}-${pkg.name}-${pkg.date}`,
      title: "singleDocument" in pkg && pkg.singleDocument && pkg.documents[0] ? packageDocumentTitle(pkg.documents[0]) : pkg.name,
      description: `${group.to} · ${group.email} · ${pkg.documents.length} document${pkg.documents.length === 1 ? "" : "e"}`,
      createdAt: pkg.date,
      direction: "iesire" as const,
      status: pkg.status,
      tone: activityTone(pkg.status),
      href: "/documents/sent",
    })),
  );

  return [...receivedRows, ...sentRows];
}

export function NotificationsHistory() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HistoryMode>("alerts");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [contextName, setContextName] = useState("Context curent");

  useEffect(() => {
    function syncHistory() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);
      const activeContext = contexts.find((context) => context.id === contextId);

      setNotifications(readNotifications());
      setActivities(buildActivityRows(contextId));
      setContextName(activeContext?.name ?? "Context curent");
    }

    syncHistory();
    window.addEventListener("docmanager-notifications-change", syncHistory);
    window.addEventListener("docmanager-account-context-change", syncHistory);
    window.addEventListener("storage", syncHistory);

    return () => {
      window.removeEventListener("docmanager-notifications-change", syncHistory);
      window.removeEventListener("docmanager-account-context-change", syncHistory);
      window.removeEventListener("storage", syncHistory);
    };
  }, []);

  const unreadCount = useMemo(() => unreadNotificationsCount(notifications), [notifications]);
  const documentAlertCount = notifications.filter((notification) => notification.category !== "security").length;
  const securityAlertCount = notifications.filter((notification) => notification.category === "security").length;

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return notifications.filter((notification) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !notification.read) ||
        notification.category === filter;
      const matchesQuery =
        !normalizedQuery ||
        `${notification.title} ${notification.description} ${categoryLabel(notification.category)}`
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, notifications, query]);

  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return activities.filter((activity) =>
      !normalizedQuery ||
      `${activity.title} ${activity.description} ${activity.status} ${activity.direction}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [activities, query]);

  function markAllRead() {
    setNotifications(markAllNotificationsRead());
  }

  function markOneRead(id: string) {
    setNotifications(markNotificationRead(id));
  }

  function removeNotification(id: string) {
    setNotifications(deleteNotification(id));
  }

  return (
    <>
      <section className="page-head notifications-page-head compact-page-head">
        <div>
          <p className="eyebrow">Alerte</p>
          <h1>Istoric alerte</h1>
          <p className="muted">Notificari si activitati pentru {contextName}: documente, semnari, cont si securitate.</p>
        </div>
        <button className="secondary-button" type="button" onClick={markAllRead} disabled={unreadCount === 0}>
          Marcheaza toate citite
        </button>
      </section>

      <section className="notification-summary-grid">
        <article>
          <Bell size={20} />
          <strong>{notifications.length}</strong>
          <span>Total alerte</span>
        </article>
        <article>
          <AlertCircle size={20} />
          <strong>{unreadCount}</strong>
          <span>Necitite</span>
        </article>
        <article>
          <FileInput size={20} />
          <strong>{activities.length}</strong>
          <span>Activitati documente</span>
        </article>
        <article>
          <ShieldAlert size={20} />
          <strong>{securityAlertCount}</strong>
          <span>Securitate</span>
        </article>
      </section>

      <section className="notifications-toolbar panel">
        <label className="compact-search notification-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cauta dupa alerta, document sau activitate"
          />
        </label>
        <div className="segmented compact-segmented">
          <button className={mode === "alerts" ? "active" : ""} type="button" onClick={() => setMode("alerts")}>Alerte</button>
          <button className={mode === "activity" ? "active" : ""} type="button" onClick={() => setMode("activity")}>Activitate</button>
        </div>
        {mode === "alerts" && (
          <label className="custom-select compact-custom-select">
            <Filter size={16} />
            <select value={filter} onChange={(event) => setFilter(event.target.value as NotificationFilter)}>
              <option value="all">Toate alertele</option>
              <option value="unread">Necitite</option>
              <option value="document">Documente</option>
              <option value="security">Securitate</option>
              <option value="account">Cont</option>
              <option value="system">Sistem</option>
            </select>
          </label>
        )}
      </section>

      {mode === "alerts" ? (
        <section className="notifications-history panel">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state notification-empty-state">
              <Bell size={34} />
              <h2>Nu exista alerte pentru filtrul curent</h2>
              <p>Cand apar evenimente importante in cont, le vei vedea aici.</p>
            </div>
          ) : filteredNotifications.map((notification) => {
            const Icon = notificationIcon(notification.tone);

            return (
              <article className={`notification-history-row enhanced ${notification.tone} ${notification.read ? "read" : "unread"}`} key={notification.id}>
                <span className="notification-row-icon"><Icon size={19} /></span>
                <div className="notification-row-content">
                  <div>
                    <strong>{notification.title}</strong>
                    <em>{categoryLabel(notification.category)}</em>
                  </div>
                  <p>{notification.description}</p>
                  <small><Clock size={14} /> {notification.createdAt}</small>
                </div>
                <div className="notification-row-actions">
                  {!notification.read && (
                    <button type="button" onClick={() => markOneRead(notification.id)}>
                      Citita
                    </button>
                  )}
                  {notification.href && <Link className="secondary-button compact-link-button" href={notification.href}>Deschide</Link>}
                  <button className="danger-icon-button" type="button" aria-label="Sterge alerta" onClick={() => removeNotification(notification.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="activity-history panel">
          {filteredActivities.length === 0 ? (
            <div className="empty-state notification-empty-state">
              <FileOutput size={34} />
              <h2>Nu exista activitate pentru filtrul curent</h2>
              <p>Istoricul se completeaza automat din pachetele primite si trimise.</p>
            </div>
          ) : filteredActivities.map((activity) => {
            const Icon = activity.direction === "intrare" ? FileInput : FileOutput;

            return (
              <article className={`activity-history-row ${activity.tone}`} key={activity.id}>
                <span><Icon size={18} /></span>
                <div>
                  <strong>{activity.title}</strong>
                  <p>{activity.description}</p>
                </div>
                <em>{activity.direction === "intrare" ? "Intrare" : "Iesire"}</em>
                <small>{activity.status}</small>
                <time>{activity.createdAt}</time>
                <Link className="secondary-button compact-link-button" href={activity.href}>Detalii</Link>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
