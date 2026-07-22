"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, FileInput, FileOutput, UserRound } from "lucide-react";
import { readTaxpayerCompanies, readTaxpayerPersons } from "@/lib/adminData";
import { apiFetch } from "@/lib/api";
import { resolveActiveContextIdForUser } from "@/lib/institutions";

type StoredUser = {
  accountType?: string;
  institutionId?: number | string | null;
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
  if (typeof window === "undefined") return "";

  try {
    const saved = window.localStorage.getItem("docmanager_user");
    const user = saved ? JSON.parse(saved) as StoredUser : null;
    return resolveActiveContextIdForUser(user);
  } catch {
    return "";
  }
}

function accountKindLabel(kind: string) {
  if (kind === "resident") return "Domiciliu in localitate";
  if (kind === "property_owner") return "Proprietar in localitate";
  if (kind === "company_hq") return "Sediu social in localitate";
  if (kind === "company_property_owner") return "Proprietati in localitate";
  return "Nespecificat";
}

function readLocalTaxpayer(institutionId: string, taxpayerId: string): TaxpayerProfile | null {
  const person = readTaxpayerPersons().find((item) => item.institutionId === institutionId && item.id === taxpayerId);

  if (person) {
    return {
      id: person.id,
      type: "person",
      name: person.name,
      identifier: person.cnp,
      locality: person.locality,
      status: person.status,
      email: person.email,
      phone: person.phone,
      address: [person.street, person.streetNumber, person.buildingNumber, person.apartment, person.locality].filter(Boolean).join(", "),
      sentCount: 0,
      receivedCount: 0,
      accountKind: person.accountKind ?? "",
    };
  }

  const company = readTaxpayerCompanies().find((item) => item.institutionId === institutionId && item.id === taxpayerId);

  if (company) {
    return {
      id: company.id,
      type: "company",
      name: company.name,
      identifier: company.cif,
      locality: company.locality,
      status: company.status,
      email: company.email,
      phone: company.phone,
      address: [company.street, company.streetNumber, company.buildingNumber, company.apartment, company.locality].filter(Boolean).join(", "),
      sentCount: 0,
      receivedCount: 0,
      accountKind: company.accountKind ?? "",
    };
  }

  return null;
}

export function TaxpayerProfileManager({ taxpayerId }: { taxpayerId: string }) {
  const [taxpayer, setTaxpayer] = useState<TaxpayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const institutionId = readInstitutionId();
    const localTaxpayer = readLocalTaxpayer(institutionId, taxpayerId);

    if (localTaxpayer) {
      setTaxpayer(localTaxpayer);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ institutionId: institutionId, id: taxpayerId, limit: "1" });

    setLoading(true);
    apiFetch(`/api/institution-taxpayers?${params.toString()}`)
      .then((response) => response.json())
      .then((data: { items: TaxpayerProfile[] }) => setTaxpayer(data.items[0] ?? null))
      .finally(() => setLoading(false));
  }, [taxpayerId]);

  const Icon = taxpayer?.type === "company" ? Building2 : UserRound;

  return (
    <section className="taxpayer-profile-page">
      <Link className="back-link" href="/institutie/cetateni"><ArrowLeft size={18} /> Inapoi la lista cetateni</Link>
      <div className="page-head taxpayer-profile-head">
        <div>
          <p className="eyebrow">Profil cetatean</p>
          <h1>{loading ? "Se incarca..." : taxpayer?.name ?? "Cetatean negasit"}</h1>
          <p className="muted">Date personale, legatura cu institutia si sumarul schimburilor de documente.</p>
        </div>
      </div>

      {taxpayer ? (
        <div className="taxpayer-profile-layout">
          <article className="panel taxpayer-identity-panel">
            <span className="taxpayer-profile-icon"><Icon size={30} /></span>
            <div>
              <span className={taxpayer.status === "legat" ? "status-chip signed" : "status-chip review"}>
                {taxpayer.status === "legat" ? "Cont activ" : "Fara cont"}
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
        <p className="empty-state-inline">Nu am gasit acest cetatean pentru institutia curenta.</p>
      ) : null}
    </section>
  );
}
