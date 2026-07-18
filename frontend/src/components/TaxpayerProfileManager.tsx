"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, FileInput, FileOutput, UserRound } from "lucide-react";

type StoredUser = {
  linkedInstitutionIds?: string[];
};

type TaxpayerProfile = {
  id: string;
  type: "person" | "company";
  name: string;
  identifier: string;
  locality: string;
  status: "legat" | "nelegat";
  email?: string;
  phone?: string;
  address?: string;
  sentCount: number;
  receivedCount: number;
  accountKind: string;
};

function readInstitutionId() {
  if (typeof window === "undefined") return "primaria-joita";

  try {
    const saved = window.localStorage.getItem("docmanager_user");
    const user = saved ? JSON.parse(saved) as StoredUser : null;
    return user?.linkedInstitutionIds?.[0] ?? "primaria-joita";
  } catch {
    return "primaria-joita";
  }
}

function accountKindLabel(kind: string) {
  if (kind === "resident") return "Domiciliu in localitate";
  if (kind === "property_owner") return "Proprietar in localitate";
  if (kind === "company_hq") return "Sediu social in localitate";
  if (kind === "company_property_owner") return "Proprietati in localitate";
  return "Nespecificat";
}

export function TaxpayerProfileManager({ taxpayerId }: { taxpayerId: string }) {
  const [taxpayer, setTaxpayer] = useState<TaxpayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const institutionId = readInstitutionId();
    const params = new URLSearchParams({ institutionId, id: taxpayerId, limit: "1" });

    setLoading(true);
    fetch(`/api/institution-taxpayers?${params.toString()}`)
      .then((response) => response.json())
      .then((data: { items: TaxpayerProfile[] }) => setTaxpayer(data.items[0] ?? null))
      .finally(() => setLoading(false));
  }, [taxpayerId]);

  const Icon = taxpayer?.type === "company" ? Building2 : UserRound;

  return (
    <section className="taxpayer-profile-page">
      <Link className="back-link" href="/dashboard"><ArrowLeft size={18} /> Inapoi la registratura</Link>
      <div className="page-head taxpayer-profile-head">
        <div>
          <p className="eyebrow">Profil contribuabil</p>
          <h1>{loading ? "Se incarca..." : taxpayer?.name ?? "Contribuabil negasit"}</h1>
          <p className="muted">Date personale, legatura cu institutia si sumarul schimburilor de documente.</p>
        </div>
      </div>

      {taxpayer ? (
        <div className="taxpayer-profile-layout">
          <article className="panel taxpayer-identity-panel">
            <span className="taxpayer-profile-icon"><Icon size={30} /></span>
            <div>
              <span className={taxpayer.status === "legat" ? "status-chip signed" : "status-chip review"}>
                {taxpayer.status === "legat" ? "Cont legat" : "Fara cont"}
              </span>
              <h2>{taxpayer.name}</h2>
              <p>{taxpayer.type === "person" ? "CNP" : "CIF"} {taxpayer.identifier}</p>
            </div>
          </article>

          <article className="panel taxpayer-data-panel">
            <h2>Date profil</h2>
            <dl>
              <div><dt>Email</dt><dd>{taxpayer.email ?? "Neidentificat"}</dd></div>
              <div><dt>Telefon</dt><dd>{taxpayer.phone ?? "Necompletat"}</dd></div>
              <div><dt>Localitate</dt><dd>{taxpayer.locality}</dd></div>
              <div><dt>Adresa</dt><dd>{taxpayer.address ?? "Necompletata"}</dd></div>
              <div><dt>Tip relatie</dt><dd>{accountKindLabel(taxpayer.accountKind)}</dd></div>
            </dl>
          </article>

          <article className="panel taxpayer-data-panel">
            <h2>Istoric documente</h2>
            <div className="profile-document-metrics">
              <span><FileInput size={18} /> Primite <strong>{taxpayer.receivedCount}</strong></span>
              <span><FileOutput size={18} /> Trimise <strong>{taxpayer.sentCount}</strong></span>
            </div>
          </article>
        </div>
      ) : !loading ? (
        <p className="empty-state-inline">Nu am gasit acest contribuabil pentru institutia curenta.</p>
      ) : null}
    </section>
  );
}
