"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, MailWarning, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type ConfirmState = "pending" | "success" | "error";

export function ConfirmEmailStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<ConfirmState>("pending");
  const [message, setMessage] = useState("Confirmam adresa de email...");
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Linkul de confirmare este incomplet. Verifica emailul primit si incearca din nou.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok) {
          setState("error");
          setMessage(data.message ?? "Linkul de confirmare este invalid sau a expirat.");
          return;
        }

        setState("success");
        setMessage(data.message ?? "Adresa de email a fost confirmata.");
        setAccountType(data.accountType ?? null);

        const stored = window.localStorage.getItem("docmanager_pending_registration");
        const pending = stored ? JSON.parse(stored) : null;

        if (pending) {
          window.localStorage.setItem("docmanager_pending_registration", JSON.stringify({ ...pending, emailConfirmedAt: new Date().toISOString() }));
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="verification-panel">
        <div className="verification-icon">
          {state === "error" ? <MailWarning size={34} /> : <CheckCircle2 size={34} />}
        </div>
        <p className="eyebrow">Confirmare email</p>
        <h1>{state === "success" ? "Email confirmat" : state === "error" ? "Nu am putut confirma emailul" : "Se confirma..."}</h1>
        <p className="muted">{message}</p>
        {state === "success" && accountType === "institution" && (
          <p className="muted"><ShieldCheck size={16} /> Continua cu incarcarea documentelor institutiei pentru aprobare.</p>
        )}
        {state === "success" ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => router.push(accountType === "institution" ? "/onboarding/institution" : "/auth/login")}
          >
            {accountType === "institution" ? "Continua cu documentele institutiei" : "Mergi la login"}
          </button>
        ) : (
          <Link className="secondary-button" href="/auth/check-email">Retrimite emailul de confirmare</Link>
        )}
      </section>
    </main>
  );
}
