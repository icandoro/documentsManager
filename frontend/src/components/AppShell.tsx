"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, FileInput, FileOutput, Files, LayoutDashboard, LogOut, Menu, Settings, Shield, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AccountContext,
  readAccountContexts,
  readActiveAccountContextId,
  writeActiveAccountContextId,
} from "@/lib/institutions";

const nav = [
  { href: "/dashboard", label: "Panou control", icon: LayoutDashboard },
  { href: "/documents", label: "Documente", icon: Files },
  { href: "/documents/templates", label: "Sabloane", icon: Files },
  { href: "/documents/received", label: "Primite", icon: FileInput },
  { href: "/documents/sent", label: "Trimise", icon: FileOutput },
  { href: "/profile", label: "Profil", icon: UserRound },
  { href: "/profile#security", label: "Security", icon: Shield }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isApprovalLocked, setIsApprovalLocked] = useState(false);
  const [contexts, setContexts] = useState<AccountContext[]>([]);
  const [activeContextId, setActiveContextId] = useState("independent");

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

  function handleContextChange(id: string) {
    setActiveContextId(id);
    writeActiveAccountContextId(id);
  }

  if (isApprovalLocked) {
    return null;
  }

  return (
    <div className={`app-shell ${isMenuOpen ? "menu-open" : ""}`}>
      <button className="sidebar-backdrop" aria-label="Inchide meniul" onClick={() => setIsMenuOpen(false)} />
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link href="/" className="brand brand-dark" onClick={() => setIsMenuOpen(false)}>
            <span className="brand-mark">DM</span>
            <span>DocManager</span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="Inchide meniul" onClick={() => setIsMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="side-nav">
          {nav.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setIsMenuOpen(false)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link href="/legal/privacy" onClick={() => setIsMenuOpen(false)}><Settings size={18} /> Setari date</Link>
          <Link href="/" onClick={() => setIsMenuOpen(false)}><LogOut size={18} /> Iesire</Link>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <button className="icon-button menu-toggle" aria-label="Deschide meniul" onClick={() => setIsMenuOpen(true)}><Menu size={20} /></button>
          <div>
            <p className="muted">Cont activ</p>
            <strong>Popescu Ion</strong>
          </div>
          <label className="context-switcher">
            <Building2 size={17} />
            <select value={activeContextId} onChange={(event) => handleContextChange(event.target.value)}>
              {contexts.map((context) => (
                <option value={context.id} key={context.id}>{context.name}</option>
              ))}
            </select>
          </label>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificari"><Bell size={20} /></button>
            <Link href="/profile" className="avatar">PI</Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
