"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type TwoFactorChallenge = {
  email: string;
  maskedEmail: string;
  challengeToken: string;
};

function readChallenge(): TwoFactorChallenge | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem("docmanager_2fa_challenge");
    if (!saved) return null;

    const parsed = JSON.parse(saved) as Partial<TwoFactorChallenge>;

    if (parsed.email && parsed.challengeToken) {
      return {
        email: parsed.email,
        maskedEmail: parsed.maskedEmail ?? parsed.email,
        challengeToken: parsed.challengeToken,
      };
    }
  } catch {
    window.localStorage.removeItem("docmanager_2fa_challenge");
  }

  return null;
}

export function TwoFactorForm() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isComplete = useMemo(() => code.replace(/\D/g, "").length === 6, [code]);

  useEffect(() => {
    setChallenge(readChallenge());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !isComplete) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: challenge.email,
          challengeToken: challenge.challengeToken,
          code,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.message ?? "Codul 2FA nu este valid.");
        return;
      }

      window.localStorage.setItem("docmanager_token", data.token);
      window.localStorage.setItem("docmanager_user", JSON.stringify(data.user ?? { email: challenge.email }));
      window.localStorage.setItem("docmanager_user_role", "user");
      window.localStorage.removeItem("docmanager_2fa_challenge");
      toast.success("Verificare 2FA reusita. Te duc in cont.");
      setTimeout(() => router.push("/dashboard"), 500);
    } catch {
      toast.error("Nu pot valida codul 2FA acum.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page two-factor-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="auth-panel two-factor-panel">
        <div className="two-factor-icon"><ShieldCheck size={34} /></div>
        <p className="eyebrow">Pasul 2</p>
        <h1>Verificare 2FA</h1>
        <p className="muted">
          {challenge
            ? `Introdu codul din aplicatia de autentificare pentru ${challenge.maskedEmail}.`
            : "Nu exista o verificare 2FA in curs. Reia autentificarea pentru a genera un cod temporar."}
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>Cod de verificare
            <input
              autoComplete="one-time-code"
              className="two-factor-code-input"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              value={code}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!challenge || !isComplete || isSubmitting}>
            <KeyRound size={18} />
            {isSubmitting ? "Se verifica..." : "Finalizeaza login"}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/auth/login">Inapoi la login</Link>
        </div>
      </section>
    </main>
  );
}
