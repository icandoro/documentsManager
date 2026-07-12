"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Landmark, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type AuthFormProps = {
  mode: "login" | "register" | "forgot";
};

type Notice = {
  id: number;
  type: "success" | "info" | "error";
  text: string;
};

const accountCards = [
  {
    id: "individual",
    title: "Persoana fizica",
    icon: UserRound,
    text: "Cont personal pentru documente de identitate, contracte si pachete trimise rapid.",
    benefits: ["Profil personal complet", "Documente proprii organizate", "Trimitere pachete catre firme sau institutii"],
  },
  {
    id: "company",
    title: "Persoana juridica",
    icon: Building2,
    text: "Cont pentru firme, PFA sau organizatii care gestioneaza documente cu parteneri.",
    benefits: ["Precompletare date dupa CIF", "Documente si pachete pe companie", "Pregatit pentru fluxuri de semnare"],
  },
  {
    id: "institution",
    title: "Institutie",
    icon: Landmark,
    text: "Flux verificat pentru institutii, cu documente doveditoare si persoana delegata.",
    benefits: ["Verificare documente de inrolare", "Cont activat dupa aprobare", "Structura dedicata pentru documente primite si trimise"],
  },
];

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState("individual");
  const [hasChosenAccountType, setHasChosenAccountType] = useState(!isRegister);
  const [companyData, setCompanyData] = useState({
    cif: "",
    name: "",
    registrationNumber: "",
    address: "",
    status: "",
  });
  const [isLookingUpCompany, setIsLookingUpCompany] = useState(false);

  const needsCompanyData = isRegister && (accountType === "company" || accountType === "institution");
  const selectedAccount = accountCards.find((card) => card.id === accountType) ?? accountCards[0];
  const SelectedAccountIcon = selectedAccount.icon;

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), notice.type === "error" ? 6500 : 4800);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  function showNotice(type: Notice["type"], text: string) {
    setNotice({ id: Date.now(), type, text });
  }

  function updateCompanyField(field: keyof typeof companyData, value: string) {
    setCompanyData((current) => ({ ...current, [field]: value }));
  }

  async function lookupCompany() {
    const normalizedCif = companyData.cif.replace(/\D+/g, "");

    if (!normalizedCif) {
      showNotice("error", "Introdu CIF-ul inainte de preluarea datelor.");
      return;
    }

    setNotice(null);
    setIsLookingUpCompany(true);

    try {
      const response = await fetch(`/api/public/company/${normalizedCif}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.manualEntryAllowed) {
          showNotice("info", data.message ?? "Nu am gasit date publice. Poti completa manual campurile.");
          updateCompanyField("cif", normalizedCif);
          return;
        }

        showNotice("error", data.message ?? "Nu am putut prelua datele publice.");
        return;
      }

      if (data.manualEntryAllowed) {
        updateCompanyField("cif", normalizedCif);
        showNotice("info", data.message ?? "Preluarea automata nu este disponibila acum. Completeaza manual campurile si poti continua.");
        return;
      }

      setCompanyData({
        cif: data.cif ?? normalizedCif,
        name: data.name ?? "",
        registrationNumber: data.registrationNumber ?? "",
        address: data.address ?? "",
        status: data.status ?? "",
      });
      showNotice(data.warning ? "info" : "success", data.warning ?? "Datele publice au fost preluate. Verifica si completeaza unde este nevoie.");
    } catch {
      showNotice("error", "Nu pot contacta serviciul de preluare date. Completeaza manual.");
    } finally {
      setIsLookingUpCompany(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (mode === "forgot") {
      showNotice("info", "Resetarea parolei va fi legata in pasul urmator.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const endpoint = isRegister ? "register" : "login";
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          password: form.get("password"),
          accountType,
          company: needsCompanyData ? companyData : null
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotice("error", data.message ?? (isRegister ? "Contul nu a putut fi creat." : "Autentificarea nu a reusit."));
        return;
      }

      if (isRegister) {
        if (accountType !== "institution") {
          window.localStorage.removeItem("docmanager_institution_onboarding");
        }
        window.localStorage.setItem("docmanager_pending_registration", JSON.stringify({
          email: form.get("email"),
          accountType,
          company: needsCompanyData ? companyData : null,
          nextStep: data.nextStep ?? null,
          user: data.user ?? null,
        }));
      }

      if (!isRegister && data.token) {
        window.localStorage.setItem("docmanager_token", data.token);
        window.localStorage.setItem("docmanager_user", JSON.stringify(data.user ?? {}));
        window.localStorage.removeItem("docmanager_institution_onboarding");
      }

      showNotice("success", isRegister ? "Contul a fost creat. Urmeaza confirmarea emailului." : "Autentificare reusita. Te duc in dashboard.");
      setTimeout(() => router.push(isRegister ? "/auth/check-email" : "/dashboard"), 700);
    } catch {
      showNotice("error", "Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      {notice && (
        <aside className="toast-stack" aria-live="polite">
          <div className={`toast-card ${notice.type}`} key={notice.id}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Inchide notificarea" onClick={() => setNotice(null)}>
              <X size={16} />
            </button>
          </div>
        </aside>
      )}
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Acces securizat</p>
          <h1>{isLogin ? "Autentificare" : isRegister && !hasChosenAccountType ? "Alege tipul de cont" : isRegister ? "Creeaza cont" : "Resetare parola"}</h1>
          <p className="muted">
            {isLogin
              ? "Intra in cont cu email, parola si verificare in doi pasi cand este activa."
              : isRegister && !hasChosenAccountType
                ? "Selecteaza cum vrei sa te inrolezi. Formularul se adapteaza automat in functie de tipul contului."
                : isRegister
                ? "Creeaza contul, confirma emailul, apoi continui cu pasii necesari tipului de cont ales."
                : "Primeste un link securizat pentru alegerea unei parole noi."}
          </p>
        </div>
        {isRegister && !hasChosenAccountType && (
          <section className="account-choice">
            <div className="account-card-grid">
              {accountCards.map((card) => {
                const Icon = card.icon;
                const isSelected = accountType === card.id;

                return (
                  <button className={`account-card ${isSelected ? "selected" : ""}`} key={card.id} type="button" onClick={() => setAccountType(card.id)}>
                    <span className="account-card-check"><CheckCircle2 size={18} /></span>
                    <span className="account-card-icon"><Icon size={30} /></span>
                    <strong>{card.title}</strong>
                    <span>{card.text}</span>
                    <ul>
                      {card.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
            <button className="primary-button account-next" type="button" disabled={!accountType} onClick={() => setHasChosenAccountType(true)}>
              Continua cu {selectedAccount.title}
            </button>
          </section>
        )}
        {(!isRegister || hasChosenAccountType) && <form className="form-grid" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="selected-account-strip">
                <span><SelectedAccountIcon size={18} /> {selectedAccount.title}</span>
                <button type="button" onClick={() => setHasChosenAccountType(false)}>Schimba</button>
              </div>
              <div className="two-cols">
                <label>Nume<input name="lastName" placeholder="Popescu" /></label>
                <label>Prenume<input name="firstName" placeholder="Ion" /></label>
              </div>
              {needsCompanyData && (
                <section className="form-subsection">
                  <div>
                    <p className="eyebrow">Date publice</p>
                    <h2>{accountType === "institution" ? "Date institutie" : "Date persoana juridica"}</h2>
                  </div>
                  <div className="lookup-row">
                    <label>CIF<input value={companyData.cif} onChange={(event) => updateCompanyField("cif", event.target.value)} placeholder="Ex: 12345678" /></label>
                    <button className="secondary-button" type="button" onClick={lookupCompany} disabled={isLookingUpCompany}>
                      {isLookingUpCompany ? "Se preiau..." : "Preia date"}
                    </button>
                  </div>
                  <label>Denumire<input value={companyData.name} onChange={(event) => updateCompanyField("name", event.target.value)} placeholder="Denumire oficiala" /></label>
                  <label>Nr. Registrul Comertului<input value={companyData.registrationNumber} onChange={(event) => updateCompanyField("registrationNumber", event.target.value)} placeholder="J..." /></label>
                  <label>Adresa<input value={companyData.address} onChange={(event) => updateCompanyField("address", event.target.value)} placeholder="Adresa sediu" /></label>
                  {companyData.status && <p className="muted">Status ANAF: {companyData.status}</p>}
                </section>
              )}
              {accountType === "institution" && (
                <p className="form-alert info">
                  Documentele institutiei se incarca dupa confirmarea emailului, intr-o zona separata de activare cont.
                </p>
              )}
            </>
          )}
          <label>Email<input name="email" type="email" placeholder="nume@example.com" required /></label>
          {mode !== "forgot" && <label>Parola<input name="password" type="password" placeholder="Minim 8 caractere" minLength={8} required /></label>}
          {isLogin && <label>Cod 2FA<input inputMode="numeric" placeholder="Optional, daca este activ" /></label>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Se trimite..." : isLogin ? "Intra in cont" : isRegister ? "Creeaza cont" : "Trimite link resetare"}
          </button>
        </form>}
        <div className="auth-links">
          {!isLogin && <Link href="/auth/login">Am deja cont</Link>}
          {isLogin && <Link href="/auth/register">Creeaza cont</Link>}
          {mode !== "forgot" && <Link href="/auth/forgot-password">Am uitat parola</Link>}
        </div>
      </section>
    </main>
  );
}
