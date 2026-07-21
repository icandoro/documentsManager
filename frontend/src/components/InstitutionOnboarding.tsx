"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Hourglass, Landmark, ShieldCheck } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type InstitutionDocumentKey = "signedRequest" | "proofDocuments" | "delegateDocument";

type PendingRegistration = {
  email?: string;
  accountType?: string;
  company?: {
    name?: string;
    cif?: string;
  } | null;
};

const requiredDocuments: Array<{
  key: InstitutionDocumentKey;
  title: string;
  description: string;
}> = [
  {
    key: "signedRequest",
    title: "Cerere semnata de institutie",
    description: "Cererea oficiala pentru activarea contului, semnata de reprezentantul institutiei.",
  },
  {
    key: "proofDocuments",
    title: "Documente doveditoare",
    description: "Acte care confirma dreptul de reprezentare si datele institutiei.",
  },
  {
    key: "delegateDocument",
    title: "Document persoana delegata",
    description: "Imputernicire sau document echivalent pentru persoana care administreaza contul.",
  },
];

export function InstitutionOnboarding() {
  const router = useRouter();
  const [registration, setRegistration] = useState<PendingRegistration | null>(null);
  const [files, setFiles] = useState<Record<InstitutionDocumentKey, File | null>>({
    signedRequest: null,
    proofDocuments: null,
    delegateDocument: null,
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("docmanager_pending_registration");
    setRegistration(stored ? JSON.parse(stored) : null);
  }, []);

  function handleFile(key: InstitutionDocumentKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFiles((current) => ({ ...current, [key]: file }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const missingDocument = requiredDocuments.find((document) => !files[document.key]);
    if (missingDocument) {
      setError(`Incarca documentul: ${missingDocument.title}.`);
      return;
    }

    if (typeof window !== "undefined" && !window.localStorage.getItem("docmanager_token")) {
      setError("Sesiunea de autentificare a expirat. Reintra in cont si reincearca.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    requiredDocuments.forEach((document) => {
      const file = files[document.key];
      if (file) formData.append(document.key, file);
    });

    try {
      const response = await apiFetch("/api/institutions/onboarding/documents", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message ?? "Documentele nu au putut fi trimise. Incearca din nou.");
        return;
      }

      window.localStorage.setItem("docmanager_institution_onboarding", JSON.stringify({
        email: registration?.email ?? null,
        company: registration?.company ?? null,
        documents: data.documents ?? {},
        status: "pending_admin_review",
        submittedAt: new Date().toISOString(),
      }));
      setSubmitted(true);
      setTimeout(() => router.push("/onboarding/pending-approval"), 700);
    } catch {
      setError("Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="onboarding-panel">
        <div className="onboarding-header">
          <span className="verification-icon"><Landmark size={34} /></span>
          <div>
            <p className="eyebrow">Activare institutie</p>
            <h1>Incarca documentele pentru verificare</h1>
            <p className="muted">
              Contul este creat si emailul este confirmat. Dupa trimiterea documentelor, contul ramane in asteptare pana la aprobarea unui administrator.
            </p>
          </div>
        </div>

        <div className="institution-summary">
          <span><ShieldCheck size={18} /> {registration?.company?.name || "Institutia selectata"}</span>
          <span>CIF {registration?.company?.cif || "-"}</span>
          <span>{registration?.email || "email confirmat"}</span>
        </div>

        {submitted ? (
          <div className="pending-review">
            <CheckCircle2 size={38} />
            <h2>Documentele au fost trimise</h2>
            <p>Contul institutiei asteapta verificarea documentelor si aprobarea unui administrator.</p>
            <Link className="primary-button" href="/onboarding/pending-approval">Vezi statusul verificarii</Link>
          </div>
        ) : (
          <form className="document-upload-list" onSubmit={handleSubmit}>
            {requiredDocuments.map((document) => (
              <label className="upload-row" key={document.key}>
                <span className="upload-row-icon"><FileUp size={22} /></span>
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.description}</small>
                  {files[document.key] && <em>{files[document.key]?.name}</em>}
                </span>
                <input type="file" onChange={(event) => handleFile(document.key, event)} />
              </label>
            ))}
            {error && <p className="form-alert error">{error}</p>}
            <p className="form-alert info"><Hourglass size={18} /> Dupa trimitere, statusul contului devine: in verificare administrator.</p>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Se trimite..." : "Trimite pentru aprobare"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
