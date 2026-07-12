"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type PendingRegistration = {
  email?: string;
  accountType?: string;
  company?: {
    name?: string;
    cif?: string;
  } | null;
};

export function CheckEmailStep() {
  const router = useRouter();
  const [registration, setRegistration] = useState<PendingRegistration | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("docmanager_pending_registration");
    setRegistration(stored ? JSON.parse(stored) : null);
  }, []);

  function confirmEmailDemo() {
    const updated = {
      ...(registration ?? {}),
      emailConfirmedAt: new Date().toISOString(),
      status: registration?.accountType === "institution" ? "documents_required" : "active",
    };

    window.localStorage.setItem("docmanager_pending_registration", JSON.stringify(updated));
    if (registration?.accountType !== "institution") {
      window.localStorage.removeItem("docmanager_institution_onboarding");
    }
    router.push(registration?.accountType === "institution" ? "/onboarding/institution" : "/dashboard");
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
          Am creat contul pentru <strong>{registration?.email ?? "adresa introdusa"}</strong>. Dupa confirmare, conturile de institutie continua cu incarcarea documentelor pentru aprobare.
        </p>
        <div className="timeline-list">
          <span className="done"><CheckCircle2 size={18} /> Cont creat</span>
          <span><MailCheck size={18} /> Confirmare email</span>
          {registration?.accountType === "institution" && <span><ShieldCheck size={18} /> Documente institutie si aprobare administrator</span>}
        </div>
        <button className="primary-button" type="button" onClick={confirmEmailDemo}>
          Confirma emailul in demo
        </button>
        <Link className="secondary-button" href="/auth/login">Mergi la login</Link>
      </section>
    </main>
  );
}
