"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, CheckCircle2, ChevronDown, ClipboardList, FileInput, FileOutput, Files, Grid3X3, HelpCircle, Home, Info, Landmark, LogOut, Menu, Search, Settings, Shield, ShieldAlert, ShieldCheck, Upload, UserCog, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AccountContext,
  readAccountContexts,
  readActiveAccountContextId,
  writeActiveAccountContextId,
} from "@/lib/institutions";
import { AppNotification, markAllNotificationsRead, readNotifications, unreadNotificationsCount } from "@/lib/notifications";
import { documents as seedDocuments } from "@/lib/data";
import { readPackageTemplates } from "@/lib/packageTemplates";
import { packageDocumentTitle, readReceivedPackages, readSentPackages } from "@/lib/packages";
import { readPlatformInstitutions, readPlatformUsers, readTaxpayerCompanies, readTaxpayerPersons } from "@/lib/adminData";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

const nav: NavItem[] = [
  { href: "/documents", label: "Documente", icon: Files, children: [
    { href: "/documents", label: "Fisierele mele" },
    { href: "/documents/received", label: "Partajate" },
  ] },
  { href: "/documents/templates", label: "Sabloane", icon: Files },
  { href: "/documents/received", label: "Primite", icon: FileInput },
  { href: "/documents/sent", label: "Trimise", icon: FileOutput },
  { href: "/profile", label: "Profil", icon: UserRound },
  { href: "/profile#security", label: "Security", icon: Shield }
];

const superAdminNav: NavItem = { href: "/admin", label: "Administrare", icon: ShieldCheck };
const superAdminOnlyNav: NavItem[] = [
  { href: "/admin#users", label: "Users", icon: UserRound },
  { href: "/admin#institutions", label: "Institutions", icon: Building2 },
  { href: "/admin#persons", label: "Individuals", icon: UserRound },
  { href: "/admin#companies", label: "Legal Entities", icon: Landmark },
  { href: "/admin#relations", label: "Imports", icon: FileInput },
];

const institutionNav: NavItem[] = [
  { href: "/dashboard", label: "Registratura", icon: ClipboardList },
  { href: "/institutie/cetateni", label: "Cetateni si companii", icon: UsersRound },
  { href: "/documents/received", label: "Documente intrate", icon: FileInput },
  { href: "/documents/sent", label: "Documente trimise", icon: FileOutput },
  { href: "/documents", label: "Documente", icon: Files, children: [
    { href: "/documents", label: "Fisiere institutiei" },
    { href: "/documents/templates", label: "Sabloane" },
  ] },
  { href: "/profile", label: "Profil institutie", icon: Building2 },
  { href: "/profile#security", label: "Security", icon: Shield },
];

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  accountType?: "individual" | "company" | "institution";
  linkedInstitutionIds?: string[];
  avatarUrl?: string;
};

type GlobalSearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
  type: "document" | "template" | "sent" | "received" | "notification" | "admin" | "navigation";
  icon: LucideIcon;
};

type SearchDocument = {
  id: number;
  title: string;
  category: string;
  size: string;
};

const adminMobileNav = [
  { href: "/admin#users", label: "Users", icon: UserRound },
  { href: "/admin#institutions", label: "Institutions", icon: Landmark },
  { href: "/admin#relations", label: "Imports", icon: FileInput },
  { href: "/admin#users", label: "Profile", icon: UserCog },
];

function adminSectionFromHash() {
  if (typeof window === "undefined") return "users";

  return window.location.hash.replace("#", "") || "users";
}

function readStoredRole() {
  if (typeof window === "undefined") return "user";

  return window.localStorage.getItem("docmanager_user_role") ?? "user";
}

function readStoredUser(): StoredUser {
  if (typeof window === "undefined") {
    return { name: "Popescu Ion", email: "ion.popescu@example.com", role: "user" };
  }

  const savedUser = window.localStorage.getItem("docmanager_user");

  if (!savedUser) {
    return { name: "Popescu Ion", email: "ion.popescu@example.com", role: "user" };
  }

  try {
    return JSON.parse(savedUser) as StoredUser;
  } catch {
    window.localStorage.removeItem("docmanager_user");
    return { name: "Popescu Ion", email: "ion.popescu@example.com", role: "user" };
  }
}

function notificationIcon(tone: AppNotification["tone"]) {
  if (tone === "success") return CheckCircle2;
  if (tone === "warning") return ShieldAlert;
  if (tone === "error") return Shield;
  return Info;
}

function documentsStorageKey(contextId: string) {
  return `docmanager_documents_${contextId}`;
}

function readSearchDocuments(contextId: string): SearchDocument[] {
  if (typeof window === "undefined") return [];

  const saved = window.localStorage.getItem(documentsStorageKey(contextId));

  if (!saved) {
    return contextId === "independent"
      ? seedDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        category: document.type === "Contract" ? "Contracte" : document.type,
        size: document.size,
      }))
      : [];
  }

  try {
    const parsed = JSON.parse(saved) as Array<{ id: number; title: string; category?: string; type?: string; size?: string }>;

    if (Array.isArray(parsed)) {
      return parsed.map((document) => ({
        id: document.id,
        title: document.title,
        category: document.category ?? document.type ?? "Document",
        size: document.size ?? "fara marime",
      }));
    }
  } catch {
    window.localStorage.removeItem(documentsStorageKey(contextId));
  }

  return [];
}

function matchesSearch(result: GlobalSearchResult, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return false;

  return [result.title, result.description, result.type].some((value) => value.toLowerCase().includes(normalized));
}

function userInitials(user: StoredUser) {
  const source = user.name || user.email || "Utilizator";
  const words = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isApprovalLocked, setIsApprovalLocked] = useState(false);
  const [contexts, setContexts] = useState<AccountContext[]>([]);
  const [activeContextId, setActiveContextId] = useState("independent");
  const [role, setRole] = useState("user");
  const [user, setUser] = useState<StoredUser>({ name: "Popescu Ion", email: "ion.popescu@example.com", role: "user" });
  const [adminSection, setAdminSection] = useState("users");
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({ "/documents": true });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  useEffect(() => {
    const onboardingStored = window.localStorage.getItem("docmanager_institution_onboarding");
    const registrationStored = window.localStorage.getItem("docmanager_pending_registration");
    const onboarding = onboardingStored ? JSON.parse(onboardingStored) : null;
    const registration = registrationStored ? JSON.parse(registrationStored) : null;
    const locked = registration?.accountType === "institution" && onboarding?.status === "pending_admin_review";

    setIsApprovalLocked(locked);

    if (locked && pathname !== "/onboarding/pending-approval") {
      router.replace("/onboarding/pending-approval");
    }
  }, [pathname, router]);

  useEffect(() => {
    function syncContexts() {
      const savedContexts = readAccountContexts();

      setContexts(savedContexts);
      setActiveContextId(readActiveAccountContextId(savedContexts));
    }

    syncContexts();
    window.addEventListener("storage", syncContexts);
    window.addEventListener("docmanager-account-context-change", syncContexts);

    return () => {
      window.removeEventListener("storage", syncContexts);
      window.removeEventListener("docmanager-account-context-change", syncContexts);
    };
  }, []);

  useEffect(() => {
    function syncSession() {
      setRole(readStoredRole());
      setUser(readStoredUser());
    }

    window.localStorage.setItem("docmanager_user_role", readStoredRole());
    syncSession();
    window.addEventListener("storage", syncSession);

    return () => window.removeEventListener("storage", syncSession);
  }, []);

  useEffect(() => {
    function syncNotifications() {
      setNotifications(readNotifications());
    }

    syncNotifications();
    window.addEventListener("storage", syncNotifications);
    window.addEventListener("docmanager-notifications-change", syncNotifications);

    return () => {
      window.removeEventListener("storage", syncNotifications);
      window.removeEventListener("docmanager-notifications-change", syncNotifications);
    };
  }, []);

  function handleContextChange(id: string) {
    setActiveContextId(id);
    writeActiveAccountContextId(id);
  }

  function handleAdminNavigation(href: string) {
    if (pathname !== "/admin") {
      router.push(href);
    } else {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }

    setIsMenuOpen(false);
    setAdminSection(href.split("#")[1] ?? "users");
  }

  function closeSidebar() {
    setIsMenuOpen(false);
    setIsSidebarCollapsed(true);
  }

  function openSidebar() {
    setIsSidebarCollapsed(false);
    setIsMenuOpen(true);
  }

  function toggleNavGroup(href: string) {
    setExpandedNav((current) => ({ ...current, [href]: !current[href] }));
  }

  function closeProfileMenu() {
    setIsProfileMenuOpen(false);
  }

  function markNotificationsRead() {
    setNotifications(markAllNotificationsRead());
  }

  function closeGlobalSearch() {
    window.setTimeout(() => setIsGlobalSearchOpen(false), 120);
  }

  const isSuperAdmin = role === "superadmin";
  const isInstitutionAccount = user.accountType === "institution";
  const institutionContextId = user.linkedInstitutionIds?.[0];
  const institutionContext = contexts.find((context) => context.id === institutionContextId);
  const isDocumentsWorkspace = pathname.startsWith("/documents");
  const isAdminWorkspace = pathname.startsWith("/admin");
  const visibleNav = isSuperAdmin ? superAdminOnlyNav : isInstitutionAccount ? institutionNav : [...nav, ...(role === "admin" ? [superAdminNav] : [])];
  const unreadCount = unreadNotificationsCount(notifications);
  const moduleLinks = isSuperAdmin ? [
    { href: "/admin#users", label: "Utilizatori", icon: UserRound },
    { href: "/admin#institutions", label: "Institutii", icon: Landmark },
    { href: "/admin#relations", label: "Importuri", icon: FileInput },
    { href: "/notifications", label: "Alerte", icon: Bell },
  ] : isInstitutionAccount ? [
    { href: "/dashboard", label: "Registratura", icon: ClipboardList },
    { href: "/institutie/cetateni", label: "Cetateni si companii", icon: UsersRound },
    { href: "/documents/received", label: "Documente intrate", icon: FileInput },
    { href: "/notifications", label: "Alerte", icon: Bell },
  ] : [
    { href: "/documents", label: "Documente", icon: Files },
    { href: "/documents/templates", label: "Sabloane", icon: Files },
    { href: "/documents/received", label: "Primite", icon: FileInput },
    { href: "/notifications", label: "Alerte", icon: Bell },
  ];

  useEffect(() => {
    if (!isInstitutionAccount || !institutionContextId || activeContextId === institutionContextId) {
      return;
    }

    setActiveContextId(institutionContextId);
    writeActiveAccountContextId(institutionContextId);
    window.dispatchEvent(new Event("docmanager-account-context-change"));
  }, [activeContextId, institutionContextId, isInstitutionAccount]);

  const globalSearchResults = useMemo(() => {
    if (typeof window === "undefined") return [];

    const currentContext = contexts.find((context) => context.id === activeContextId);
    const contextName = currentContext?.name ?? "contextul curent";
    const results: GlobalSearchResult[] = [
      ...moduleLinks.map((item) => ({
        id: `module-${item.href}`,
        title: item.label,
        description: "Modul rapid in platforma",
        href: item.href,
        type: "navigation" as const,
        icon: item.icon,
      })),
      ...notifications.slice(0, 8).map((notification) => ({
        id: `notification-${notification.id}`,
        title: notification.title,
        description: notification.description,
        href: notification.href ?? "/notifications",
        type: "notification" as const,
        icon: notificationIcon(notification.tone),
      })),
    ];

    if (isSuperAdmin) {
      readPlatformUsers().forEach((platformUser) => {
        results.push({
          id: `admin-user-${platformUser.id}`,
          title: platformUser.name,
          description: `${platformUser.email} · ${platformUser.cnp ?? platformUser.cif ?? "fara identificator"} · ${platformUser.status}`,
          href: "/admin#users",
          type: "admin",
          icon: UserRound,
        });
      });
      readPlatformInstitutions().forEach((institution) => {
        results.push({
          id: `admin-institution-${institution.id}`,
          title: institution.name,
          description: `${institution.locality} · CIF ${institution.cif} · ${institution.status}`,
          href: "/admin#institutions",
          type: "admin",
          icon: Landmark,
        });
      });
      readTaxpayerPersons().forEach((person) => {
        results.push({
          id: `admin-person-${person.id}`,
          title: person.name,
          description: `CNP ${person.cnp} · ${person.locality} · ${person.status}`,
          href: "/admin#persons",
          type: "admin",
          icon: UserRound,
        });
      });
      readTaxpayerCompanies().forEach((company) => {
        results.push({
          id: `admin-company-${company.id}`,
          title: company.name,
          description: `CIF ${company.cif} · ${company.locality} · ${company.status}`,
          href: "/admin#companies",
          type: "admin",
          icon: Building2,
        });
      });
    } else {
      if (isInstitutionAccount) {
        readTaxpayerPersons().filter((person) => person.institutionId === activeContextId).forEach((person) => {
          results.push({
            id: `institution-person-${person.id}`,
            title: person.name,
            description: `CNP ${person.cnp} · ${person.locality} · ${person.status}`,
            href: "/institutie/cetateni",
            type: "admin",
            icon: UserRound,
          });
        });
        readTaxpayerCompanies().filter((company) => company.institutionId === activeContextId).forEach((company) => {
          results.push({
            id: `institution-company-${company.id}`,
            title: company.name,
            description: `CUI ${company.cif} · ${company.locality} · ${company.status}`,
            href: "/institutie/cetateni",
            type: "admin",
            icon: Building2,
          });
        });
      }
      readSearchDocuments(activeContextId).forEach((document) => {
        results.push({
          id: `document-${document.id}`,
          title: document.title,
          description: `${document.category} · ${document.size} · ${contextName}`,
          href: "/documents",
          type: "document",
          icon: Files,
        });
      });
      readPackageTemplates(activeContextId).forEach((template) => {
        results.push({
          id: `template-${template.id}`,
          title: template.name,
          description: `${template.documents.length} documente in sablon · ${contextName}`,
          href: "/documents/templates",
          type: "template",
          icon: Files,
        });
      });
      readReceivedPackages(activeContextId).forEach((group, groupIndex) => {
        group.packages.forEach((packageItem, packageIndex) => {
          results.push({
            id: `received-${groupIndex}-${packageIndex}`,
            title: packageItem.name,
            description: `Primit de la ${group.from} · ${packageItem.documents.map(packageDocumentTitle).join(", ")}`,
            href: "/documents/received",
            type: "received",
            icon: FileInput,
          });
        });
      });
      readSentPackages(activeContextId).forEach((group, groupIndex) => {
        group.packages.forEach((packageItem, packageIndex) => {
          results.push({
            id: `sent-${groupIndex}-${packageIndex}`,
            title: packageItem.name,
            description: `Trimis catre ${group.to} · ${packageItem.status}`,
            href: "/documents/sent",
            type: "sent",
            icon: FileOutput,
          });
        });
      });
    }

    return results.filter((result) => matchesSearch(result, globalSearchQuery)).slice(0, 8);
  }, [activeContextId, contexts, globalSearchQuery, isInstitutionAccount, isSuperAdmin, moduleLinks, notifications]);

  function handleSearchResult(result: GlobalSearchResult) {
    setGlobalSearchQuery("");
    setIsGlobalSearchOpen(false);

    if (result.href.startsWith("/admin#")) {
      handleAdminNavigation(result.href);
      return;
    }

    router.push(result.href);
  }

  useEffect(() => {
    if (isSuperAdmin && pathname !== "/admin") {
      router.replace("/admin#users");
    }
  }, [isSuperAdmin, pathname, router]);

  useEffect(() => {
    function syncAdminSection() {
      setAdminSection(adminSectionFromHash());
    }

    syncAdminSection();
    window.addEventListener("hashchange", syncAdminSection);

    return () => window.removeEventListener("hashchange", syncAdminSection);
  }, []);

  if (isApprovalLocked) {
    return null;
  }

  return (
    <div className={`app-shell ${isMenuOpen ? "menu-open" : ""} ${isSidebarCollapsed ? "sidebar-collapsed" : ""} ${isDocumentsWorkspace ? "documents-shell" : ""} ${isAdminWorkspace ? "admin-shell" : ""}`}>
      <button className="sidebar-backdrop" aria-label="Inchide meniul" onClick={() => setIsMenuOpen(false)} />
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link href="/" className="brand brand-dark" onClick={() => setIsMenuOpen(false)}>
            <span className="brand-mark"><Files size={21} /></span>
            <span>
              DocManager
              <small>{isSuperAdmin ? "Enterprise Tier" : "Management System"}</small>
            </span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="Restrange meniul" onClick={closeSidebar}>
            <X size={20} />
          </button>
        </div>
        <button className="admin-new-document" type="button" onClick={() => router.push(isSuperAdmin ? "/admin#relations" : "/documents")}>
          <Upload size={20} />
          {isSuperAdmin ? "New Document" : "Incarca document"}
        </button>
        <nav className="side-nav">
          {visibleNav.map((item) => (
            <div className="side-nav-group" key={item.href}>
              {isSuperAdmin ? (
                <button className={`side-nav-link ${adminSection === item.href.split("#")[1] ? "active" : ""}`} type="button" onClick={() => handleAdminNavigation(item.href)}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              ) : item.children ? (
                <button className={`side-nav-link ${pathname.startsWith(item.href) ? "active" : ""}`} type="button" aria-expanded={Boolean(expandedNav[item.href])} onClick={() => toggleNavGroup(item.href)}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  <ChevronDown className="nav-chevron" size={15} />
                </button>
              ) : (
                <Link className={pathname === item.href || (item.href !== "/documents" && pathname.startsWith(item.href)) ? "active" : ""} href={item.href} onClick={() => setIsMenuOpen(false)}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )}
              {"children" in item && item.children && expandedNav[item.href] && (
                <div className="side-subnav">
                  {item.children.map((child) => (
                    isSuperAdmin ? (
                      <button className={adminSection === child.href.split("#")[1] ? "active" : ""} type="button" key={child.href} onClick={() => handleAdminNavigation(child.href)}>
                        {child.label}
                      </button>
                    ) : (
                      <Link className={pathname === child.href ? "active" : ""} href={child.href} key={child.href} onClick={() => setIsMenuOpen(false)}>
                        {child.label}
                      </Link>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {isSuperAdmin && <Link href="/legal/privacy" onClick={() => setIsMenuOpen(false)}><HelpCircle size={18} /> Support</Link>}
          {isSuperAdmin && <Link className="sidebar-logout" href="/" onClick={() => setIsMenuOpen(false)}><LogOut size={18} /> Iesire</Link>}
          {!isSuperAdmin && <Link href="/legal/privacy" onClick={() => setIsMenuOpen(false)}><Settings size={18} /> Setari date</Link>}
          {!isSuperAdmin && <Link className="sidebar-logout" href="/" onClick={() => setIsMenuOpen(false)}><LogOut size={18} /> Iesire</Link>}
        </div>
      </aside>
      <main className="workspace">
        <header className={`topbar ${isSuperAdmin ? "admin-crm-topbar" : ""}`}>
          <button className="icon-button menu-toggle" aria-label="Deschide meniul" onClick={openSidebar}><Menu size={20} /></button>
          <label className={`global-search ${isGlobalSearchOpen ? "active" : ""}`}>
            <Search size={22} />
            <input
              value={globalSearchQuery}
              onBlur={closeGlobalSearch}
              onChange={(event) => {
                setGlobalSearchQuery(event.target.value);
                setIsGlobalSearchOpen(true);
              }}
              onFocus={() => setIsGlobalSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsGlobalSearchOpen(false);
                  setGlobalSearchQuery("");
                }
                if (event.key === "Enter" && globalSearchResults[0]) {
                  event.preventDefault();
                  handleSearchResult(globalSearchResults[0]);
                }
              }}
              placeholder={isSuperAdmin ? "Cauta utilizatori, CNP, CIF sau institutii..." : isInstitutionAccount ? "Cauta cetateni, CNP, CUI sau documente..." : "Cauta documente, utilizatori sau activitati..."}
            />
            {globalSearchQuery && (
              <button className="global-search-clear" type="button" aria-label="Sterge cautarea" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                setGlobalSearchQuery("");
                setIsGlobalSearchOpen(false);
              }}>
                <X size={16} />
              </button>
            )}
            {isGlobalSearchOpen && globalSearchQuery.trim() && (
              <div className="global-search-panel">
                <div className="global-search-panel-head">
                  <strong>Rezultate rapide</strong>
                  <span>{globalSearchResults.length} gasite</span>
                </div>
                {globalSearchResults.length === 0 ? (
                  <div className="global-search-empty">
                    <Search size={20} />
                    <span>Nu am gasit rezultate pentru "{globalSearchQuery}".</span>
                  </div>
                ) : (
                  <div className="global-search-list">
                    {globalSearchResults.map((result) => {
                      const ResultIcon = result.icon;

                      return (
                        <button type="button" key={result.id} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSearchResult(result)}>
                          <span className={`global-search-icon ${result.type}`}><ResultIcon size={17} /></span>
                          <span>
                            <strong>{result.title}</strong>
                            <small>{result.description}</small>
                          </span>
                          <em>{result.type}</em>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </label>
          {!isSuperAdmin && !isInstitutionAccount && (
            <label className="context-switcher">
              <Building2 size={17} />
              <select value={activeContextId} onChange={(event) => handleContextChange(event.target.value)}>
                {contexts.map((context) => (
                  <option value={context.id} key={context.id}>{context.name}</option>
                ))}
              </select>
            </label>
          )}
          {isInstitutionAccount && (
            <span className="context-switcher static-context">
              <Building2 size={17} />
              <strong>{institutionContext?.name ?? user.name ?? "Institutie"}</strong>
            </span>
          )}
          {isSuperAdmin && <span className="system-pill"><i /> Sistem: operational</span>}
          <div className="topbar-actions">
            <div className="notification-menu-wrap">
              <button className="icon-button notification-trigger" aria-label="Notificari" aria-expanded={isNotificationsOpen} onClick={() => {
                setIsNotificationsOpen((current) => !current);
                setIsAppsMenuOpen(false);
                setIsProfileMenuOpen(false);
              }}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>
              {isNotificationsOpen && (
                <div className="notification-menu" role="menu">
                  <header>
                    <strong>Alerte</strong>
                    <button type="button" onClick={markNotificationsRead}>Marcheaza citite</button>
                  </header>
                  <div className="notification-menu-list">
                    {notifications.slice(0, 4).map((notification) => {
                      const Icon = notificationIcon(notification.tone);

                      return (
                        <Link className={`notification-item ${notification.tone} ${notification.read ? "read" : "unread"}`} href={notification.href ?? "/notifications"} key={notification.id} onClick={() => setIsNotificationsOpen(false)}>
                          <span><Icon size={17} /></span>
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.description}</p>
                            <small>{notification.createdAt}</small>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <Link className="notification-history-link" href="/notifications" onClick={() => setIsNotificationsOpen(false)}>Vezi istoricul alertelor</Link>
                </div>
              )}
            </div>
            <div className="apps-menu-wrap">
              <button className="icon-button topbar-grid" aria-label="Aplicatii" aria-expanded={isAppsMenuOpen} onClick={() => {
                setIsAppsMenuOpen((current) => !current);
                setIsNotificationsOpen(false);
                setIsProfileMenuOpen(false);
              }}><Grid3X3 size={20} /></button>
              {isAppsMenuOpen && (
                <div className="apps-menu" role="menu" aria-label="Module rapide">
                  <strong>Module rapide</strong>
                  <div>
                    {moduleLinks.map((item) => (
                      <Link href={item.href} key={item.href} onClick={() => setIsAppsMenuOpen(false)}>
                        <item.icon size={19} />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {isSuperAdmin && <button className="icon-button" type="button" aria-label="Setari"><Settings size={20} /></button>}
            {isSuperAdmin && (
              <div className="admin-user-summary">
                <strong>{user.name ?? "Administrator"}</strong>
                <span>SUPER ADMIN</span>
              </div>
            )}
            <div className="profile-menu-wrap">
              <button className="profile-account-trigger" type="button" aria-label="Deschide meniul de profil" aria-expanded={isProfileMenuOpen} onClick={() => {
                setIsProfileMenuOpen((current) => !current);
                setIsNotificationsOpen(false);
                setIsAppsMenuOpen(false);
              }}>
                <span className="profile-account-text">
                  <strong>{user.name ?? "Utilizator"}</strong>
                  <small>{isSuperAdmin ? "Admin" : role === "admin" ? "Admin" : "Cont activ"}</small>
                </span>
                <span className={`profile-avatar ${user.avatarUrl ? "has-image" : ""}`} aria-hidden="true">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{userInitials(user)}</span>}
                </span>
              </button>
              {isProfileMenuOpen && (
                <div className="profile-menu" role="menu">
                  <Link href={isSuperAdmin ? "/admin" : "/profile"} role="menuitem" onClick={closeProfileMenu}><UserRound size={17} /> Profil</Link>
                  <Link href="/profile#security" role="menuitem" onClick={closeProfileMenu}><Shield size={17} /> Security</Link>
                  <Link href="/" role="menuitem" className="danger" onClick={closeProfileMenu}><LogOut size={17} /> Logout</Link>
                </div>
              )}
            </div>
          </div>
        </header>
        {children}
        {isSuperAdmin && (
          <nav className="admin-mobile-nav" aria-label="Administrare mobil">
            <button type="button" onClick={() => handleAdminNavigation("/admin#users")}>
              <Home size={21} />
              Home
            </button>
            {adminMobileNav.map((item) => (
              <button className={adminSection === item.href.split("#")[1] ? "active" : ""} type="button" key={`${item.href}-${item.label}`} onClick={() => handleAdminNavigation(item.href)}>
                <item.icon size={21} />
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}
