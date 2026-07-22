"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export function ResetPasswordStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Linkul de resetare este incomplet. Solicita unul nou.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Confirmarea parolei nu coincide cu parola introdusa.");
      return;
    }

    if (password.length < 8) {
      toast.error("Parola trebuie sa aiba cel putin 8 caractere.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.message ?? "Linkul de resetare este invalid sau a expirat.");
        return;
      }

      toast.success(data.message ?? "Parola a fost schimbata.");
      setTimeout(() => router.push("/auth/login"), 700);
    } catch {
      toast.error("Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="auth-page">
        <Link href="/" className="brand">
          <span className="brand-mark">DM</span>
          <span>DocManager</span>
        </Link>
        <section className="verification-panel">
          <div className="verification-icon"><ShieldAlert size={34} /></div>
          <p className="eyebrow">Resetare parola</p>
          <h1>Link incomplet</h1>
          <p className="muted">Linkul de resetare este incomplet sau a expirat. Solicita unul nou din pagina de login.</p>
          <Link className="primary-button" href="/auth/forgot-password">Solicita link nou</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Resetare parola</p>
          <h1><KeyRound size={22} /> Alege o parola noua</h1>
          <p className="muted">Parola trebuie sa aiba cel putin 8 caractere.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Parola noua
            <input type="password" placeholder="Minim 8 caractere" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>Confirma parola noua
            <input type="password" placeholder="Repeta parola" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Se salveaza..." : "Salveaza parola noua"}
          </button>
        </form>
        <div className="auth-links">
          <Link href="/auth/login">Mergi la login</Link>
        </div>
      </section>
    </main>
  );
}
