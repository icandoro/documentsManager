"use client";

import Link from "next/link";
import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PendingRegistration = {
  email?: string;
  accountType?: string;
  company?: {
    name?: string;
    cif?: string;
  } | null;
};

export function CheckEmailStep() {
  const [registration, setRegistration] = useState<PendingRegistration | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("docmanager_pending_registration");
    setRegistration(stored ? JSON.parse(stored) : null);
  }, []);

  async function resendConfirmation() {
    if (!registration?.email) {
      toast.error("Nu am gasit adresa de email a contului. Mergi la login si reincearca.");
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch("/api/auth/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registration.email }),
      });
      const data = await response.json().catch(() => ({}));

      toast.success(data.message ?? "Daca adresa exista si nu este confirmata, am retrimis linkul.");
    } catch {
      toast.error("Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="verification-panel">
        <div className="verification-icon"><MailCheck size={34} /></div>
        <p className="eyebrow">Confirmare email</p>
        <h1>Verifica adresa de email</h1>
        <p className="muted">
          Am trimis un email catre <strong>{registration?.email ?? "adresa introdusa"}</strong> cu un link de confirmare. Dupa confirmare, conturile de institutie continua cu incarcarea documentelor pentru aprobare.
        </p>
        <div className="timeline-list">
          <span className="done"><CheckCircle2 size={18} /> Cont creat</span>
          <span><MailCheck size={18} /> Confirmare email (acceseaza linkul primit)</span>
          {registration?.accountType === "institution" && <span><ShieldCheck size={18} /> Documente institutie si aprobare administrator</span>}
        </div>
        <button className="secondary-button" type="button" onClick={resendConfirmation} disabled={isResending}>
          {isResending ? "Se retrimite..." : "Retrimite emailul de confirmare"}
        </button>
        <Link className="primary-button" href="/auth/login">Mergi la login</Link>
      </section>
    </main>
  );
}
