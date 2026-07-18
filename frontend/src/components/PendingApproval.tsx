"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileCheck2, Hourglass, Info, MailCheck, ShieldCheck, Stamp } from "lucide-react";
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
    <main className="auth-page approval-page-shell">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="approval-panel">
        <div className="approval-compact-head">
          <p className="eyebrow">Cont in verificare</p>
          <h1>Cont in verificare</h1>
          <p>
            Contul dvs. institutional asteapta verificarea documentelor si aprobarea administratorului.
          </p>
        </div>

        <div className="approval-summary">
          <span><ShieldCheck size={18} /> {state?.company?.name || "Institutia inrolata"}</span>
          <span>CIF {state?.company?.cif || "-"}</span>
          <span><MailCheck size={18} /> {state?.email || "Email confirmat"}</span>
        </div>

        <div className="approval-steps" aria-label="Status verificare cont">
          <article className="approval-step done">
            <span className="step-number"><CheckCircle2 size={22} /></span>
            <strong>Email confirmat</strong>
            <p>Adresa de email a fost validata cu succes.</p>
          </article>
          <article className="approval-step done">
            <span className="step-number"><FileCheck2 size={22} /></span>
            <strong>Documente trimise</strong>
            <p>Toate fisierele necesare sunt in sistem.</p>
          </article>
          <article className="approval-step active">
            <span className="step-number"><Hourglass size={22} /></span>
            <strong>Asteapta aprobarea</strong>
            <p>Echipa noastra revizuieste datele furnizate pentru activarea contului.</p>
            <span className="approval-pulse">In procesare</span>
          </article>
        </div>

        <div className="approval-mobile-visual" aria-hidden="true">
          <div className="approval-browser-mock">
            <span className="mock-dot" />
            <span className="mock-dot" />
            <span className="mock-dot" />
            <div>
              <Stamp size={34} />
              <strong>Verificare documente</strong>
              <small>Operatorul valideaza institutia</small>
            </div>
          </div>
        </div>

        <p className="approval-info-pill"><Info size={16} /> Procesul de verificare poate dura pana la 24 de ore lucratoare.</p>

        <Link className="approval-back-button" href="/"><ArrowLeft size={18} /> Inapoi la prezentare</Link>

        <div className="approval-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    </main>
  );
}
