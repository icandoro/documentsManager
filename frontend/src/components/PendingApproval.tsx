"use client";

import Link from "next/link";
import { Hourglass, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type OnboardingState = {
  email?: string | null;
  company?: {
    name?: string;
    cif?: string;
  } | null;
  submittedAt?: string;
};

export function PendingApproval() {
  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("docmanager_institution_onboarding");
    setState(stored ? JSON.parse(stored) : null);
  }, []);

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="approval-panel">
        <span className="verification-icon"><Hourglass size={34} /></span>
        <p className="eyebrow">Cont in verificare</p>
        <h1>Contul dvs. asteapta verificarea documentelor si aprobarea lor</h1>
        <p className="muted">
          Documentele institutiei au fost trimise. Pana cand un administrator aproba contul, accesul in zona de lucru ramane blocat.
        </p>

        <div className="approval-summary">
          <span><ShieldCheck size={18} /> {state?.company?.name || "Institutia inrolata"}</span>
          <span>CIF {state?.company?.cif || "-"}</span>
          <span><MailCheck size={18} /> {state?.email || "Email confirmat"}</span>
        </div>

        <div className="timeline-list">
          <span className="done"><MailCheck size={18} /> Email confirmat</span>
          <span className="done"><ShieldCheck size={18} /> Documente trimise</span>
          <span><Hourglass size={18} /> Asteapta verificarea administratorului</span>
        </div>

        <Link className="secondary-button" href="/">Inapoi la prezentare</Link>
      </section>
    </main>
  );
}
