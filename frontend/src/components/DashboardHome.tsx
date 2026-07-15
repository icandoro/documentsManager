"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileInput,
  FileOutput,
  Files,
  Filter,
  Gauge,
  Landmark,
  MailCheck,
  Search,
  ShieldCheck,
  Signature,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { documents, receivedPackages, sentPackages } from "@/lib/data";
import {
  PlatformInstitution,
  PlatformUser,
  readPlatformInstitutions,
  readPlatformUsers,
  readTaxpayerCompanies,
  readTaxpayerPersons,
} from "@/lib/adminData";
import { packageDocumentTitle, readReceivedPackages, readSentPackages } from "@/lib/packages";

type StoredUser = PlatformUser & {
  role?: string;
};

type TaxpayerView = {
  id: string;
  type: "person" | "company";
  name: string;
  identifier: string;
  locality: string;
  status: "legat" | "nelegat";
  institutionId: string;
  email?: string;
  phone?: string;
  address?: string;
  sentCount: number;
  receivedCount: number;
};

type RegistryRow = {
  id: string;
  from: string;
  email: string;
  packageName: string;
  purpose: "Semnare" | "Informare";
  date: string;
  status: string;
  documents: string[];
};

type SentHistoryRow = {
  id: string;
  to: string;
  email: string;
  packageName: string;
  purpose: "Semnare" | "Informare";
  date: string;
  status: string;
  documents: string[];
};

function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;

  const saved = window.localStorage.getItem("docmanager_user");

  if (!saved) return null;

  try {
    return JSON.parse(saved) as StoredUser;
  } catch {
    return null;
  }
}

function normalizeIdentifier(value?: string) {
  return (value ?? "").toLowerCase().replace(/^ro/, "").replace(/\D/g, "");
}

function normalizeName(value?: string) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function purposeFromStatus(status: string) {
  return status.toLowerCase().includes("semn") ? "Semnare" : "Informare";
}

function packagePurpose(pkg: { status: string; purpose?: string }) {
  return pkg.purpose === "signature" ? "Semnare" : purposeFromStatus(pkg.status);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("semnat") || normalized.includes("primit") || normalized.includes("activ")) return "success";
  if (normalized.includes("asteapta") || normalized.includes("verific") || normalized.includes("solicit")) return "warning";
  if (normalized.includes("partial")) return "info";

  return "neutral";
}

function formatInstitutionName(institution?: PlatformInstitution) {
  return institution?.name ?? "Institutia curenta";
}

function GenericDashboard() {
  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Platform Overview</h1>
          <p className="muted">Snapshot rapid pentru fluxurile de documente, trimiteri si activitatea contului.</p>
        </div>
        <Link href="/documents" className="secondary-button"><Filter size={18} /> Filtre avansate</Link>
      </section>
      <section className="stats-grid">
        <article><Files /><strong>{documents.length}</strong><span>Total documente</span><em>+12%</em></article>
        <article><FileInput /><strong>{receivedPackages.length}</strong><span>Pachete primite</span><em>Active</em></article>
        <article><FileOutput /><strong>{sentPackages.length}</strong><span>Pachete trimise</span><em>Monitorizate</em></article>
        <article className="dark-metric"><ShieldCheck /><strong>2FA</strong><span>Security</span><Link href="/profile#security">Activeaza</Link></article>
      </section>
      <section className="dashboard-grid enterprise-dashboard-grid">
        <article className="panel performance-card">
          <div className="panel-title-row">
            <div>
              <h2>System Performance</h2>
              <p>Volum documente pe ultimele zile</p>
            </div>
            <span><i /> Trimiteri <i /> Primiri</span>
          </div>
          <div className="bar-chart" aria-label="Grafic volum documente">
            {[42, 56, 68, 44, 55, 43, 82, 34].map((height, index) => (
              <span key={index} style={{ "--bar-height": `${height}%` } as CSSProperties}><i /></span>
            ))}
          </div>
        </article>
        <article className="panel quick-insights">
          <h2>Quick Insights</h2>
          <div className="insight-row"><Zap /><span><strong>Transfer activ</strong><small>{sentPackages.length} fluxuri in lucru</small></span></div>
          <div className="insight-row"><ShieldCheck /><span><strong>Compliance pass</strong><small>Documentele au status urmaribil</small></span></div>
          <div className="insight-row"><Gauge /><span><strong>Procesare medie</strong><small>1.2s pe fisier legal</small></span></div>
          <Link className="secondary-button" href="/documents/sent">Descarca raport</Link>
        </article>
      </section>
      <section className="recent-documents-card panel">
        <div className="section-title-row">
          <h2>Documente recente</h2>
          <Link href="/documents">Vezi arhiva <ArrowUpRight size={16} /></Link>
        </div>
        <div className="recent-document-head">
          <span>Fisier</span>
          <span>Lead institutional</span>
          <span>Status</span>
          <span>Actiuni</span>
        </div>
        {documents.slice(0, 3).map((document, index) => (
          <article className="recent-document-row" key={document.id}>
            <span className="file-icon"><Files size={20} /></span>
            <div>
              <strong>{document.title}</strong>
              <small>{document.size}</small>
            </div>
            <span>{index === 0 ? "Primaria Joita" : index === 1 ? "Demo Construct SRL" : "Independent"}</span>
            <em className={index === 0 ? "signed" : index === 1 ? "review" : "pending"}>{index === 0 ? "Semnat" : index === 1 ? "Review" : "Pending"}</em>
            <Link href="/documents"><ArrowUpRight size={18} /></Link>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <h2>Pachete primite recent</h2>
          {receivedPackages.map((group) => (
            <div className="package-row" key={group.email}>
              <div>
                <strong>{group.from}</strong>
                <p>{group.packages[0].name} · {group.packages[0].documents.length} documente</p>
              </div>
              <Building2 size={18} />
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>Urmatoarele actiuni</h2>
          <div className="task-list">
            <span>Finalizeaza profilul juridic</span>
            <span>Activeaza verificarea in doi pasi</span>
            <span>Pregateste fluxul pentru semnare digitala</span>
          </div>
        </article>
      </section>
    </>
  );
}

function InstitutionDashboard({ user }: { user: StoredUser }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "person" | "company">("all");
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState("");
  const [institution, setInstitution] = useState<PlatformInstitution | undefined>();
  const [taxpayers, setTaxpayers] = useState<TaxpayerView[]>([]);
  const [registryRows, setRegistryRows] = useState<RegistryRow[]>([]);
  const [sentRows, setSentRows] = useState<SentHistoryRow[]>([]);

  useEffect(() => {
    const institutions = readPlatformInstitutions();
    const institutionId = user.linkedInstitutionIds?.[0] ?? institutions[0]?.id ?? "primaria-joita";
    const currentInstitution = institutions.find((item) => item.id === institutionId) ?? institutions[0];
    const users = readPlatformUsers();
    const persons = readTaxpayerPersons()
      .filter((person) => person.institutionId === institutionId)
      .map<TaxpayerView>((person) => {
        const matchedUser = users.find((item) =>
          normalizeIdentifier(item.cnp) === normalizeIdentifier(person.cnp) ||
          normalizeName(item.name) === normalizeName(person.name)
        );

        return {
          id: person.id,
          type: "person",
          name: person.name,
          identifier: person.cnp,
          locality: person.locality,
          status: person.status,
          institutionId: person.institutionId,
          email: matchedUser?.email,
          phone: matchedUser?.phone,
          address: matchedUser?.address ? `${matchedUser.address.street} ${matchedUser.address.number}, ${matchedUser.address.city}` : undefined,
          sentCount: matchedUser?.sentCount ?? 0,
          receivedCount: matchedUser?.receivedCount ?? 0,
        };
      });
    const companies = readTaxpayerCompanies()
      .filter((company) => company.institutionId === institutionId)
      .map<TaxpayerView>((company) => {
        const matchedUser = users.find((item) =>
          normalizeIdentifier(item.cif) === normalizeIdentifier(company.cif) ||
          normalizeName(item.name) === normalizeName(company.name)
        );

        return {
          id: company.id,
          type: "company",
          name: company.name,
          identifier: company.cif,
          locality: company.locality,
          status: company.status,
          institutionId: company.institutionId,
          email: matchedUser?.email,
          phone: matchedUser?.phone,
          address: matchedUser?.address ? `${matchedUser.address.street} ${matchedUser.address.number}, ${matchedUser.address.city}` : undefined,
          sentCount: matchedUser?.sentCount ?? 0,
          receivedCount: matchedUser?.receivedCount ?? 0,
        };
      });
    const allTaxpayers = [...persons, ...companies];
    const received = readReceivedPackages(institutionId);
    const receivedRows = received.flatMap((group, groupIndex) =>
      group.packages.map<RegistryRow>((pkg, packageIndex) => ({
        id: `received-${groupIndex}-${packageIndex}`,
        from: group.from,
        email: group.email,
        packageName: pkg.name,
        purpose: packagePurpose(pkg),
        date: pkg.date,
        status: pkg.status,
        documents: pkg.documents.map(packageDocumentTitle),
      })),
    );
    const demoRows: RegistryRow[] = [
      {
        id: "demo-registry-popescu-1",
        from: "Popescu Ion",
        email: "pf.demo@docmanager.local",
        packageName: "Actualizare date fiscale",
        purpose: "Informare",
        date: "16 iul. 2026",
        status: "Inregistrat",
        documents: ["Buletin", "Certificat nastere"],
      },
      {
        id: "demo-registry-demo-construct",
        from: "Demo Construct SRL",
        email: "pj.demo@docmanager.local",
        packageName: "Cerere certificat fiscal",
        purpose: "Semnare",
        date: "15 iul. 2026",
        status: "Asteapta semnare",
        documents: ["Cerere", "Certificat constatator"],
      },
      {
        id: "demo-registry-popescu-2",
        from: "Popescu Ion",
        email: "pf.demo@docmanager.local",
        packageName: "Declaratie proprietate",
        purpose: "Semnare",
        date: "12 iul. 2026",
        status: "Semnat",
        documents: ["Declaratie", "Extras CF"],
      },
    ];
    const sent = readSentPackages(institutionId);
    const flattenedSent = sent.flatMap((group, groupIndex) =>
      group.packages.map<SentHistoryRow>((pkg, packageIndex) => ({
        id: `sent-${groupIndex}-${packageIndex}`,
        to: group.to,
        email: group.email,
        packageName: pkg.name,
        purpose: packagePurpose(pkg),
        date: pkg.date,
        status: pkg.status,
        documents: pkg.documents.map(packageDocumentTitle),
      })),
    );
    const demoSent: SentHistoryRow[] = [
      {
        id: "demo-sent-popescu",
        to: "Popescu Ion",
        email: "pf.demo@docmanager.local",
        packageName: "Instiintare taxe locale",
        purpose: "Informare",
        date: "14 iul. 2026",
        status: "Documente primite",
        documents: ["Decizie impunere"],
      },
      {
        id: "demo-sent-company",
        to: "Demo Construct SRL",
        email: "pj.demo@docmanager.local",
        packageName: "Solicitare documente urbanism",
        purpose: "Semnare",
        date: "10 iul. 2026",
        status: "Partial semnate",
        documents: ["Cerere urbanism", "Plan amplasament"],
      },
    ];

    setInstitution(currentInstitution);
    setTaxpayers(allTaxpayers);
    setRegistryRows([...receivedRows, ...demoRows]);
    setSentRows([...flattenedSent, ...demoSent]);
    setSelectedTaxpayerId((current) => current || allTaxpayers[0]?.id || "");
  }, [user]);

  const filteredTaxpayers = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return taxpayers.filter((taxpayer) => {
      const matchesType = typeFilter === "all" || taxpayer.type === typeFilter;
      const matchesQuery = !normalizedQuery || [taxpayer.name, taxpayer.identifier, taxpayer.email ?? "", taxpayer.locality]
        .some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesType && matchesQuery;
    });
  }, [query, taxpayers, typeFilter]);
  const selectedTaxpayer = taxpayers.find((taxpayer) => taxpayer.id === selectedTaxpayerId) ?? filteredTaxpayers[0] ?? taxpayers[0];
  const selectedIncoming = registryRows.filter((row) =>
    selectedTaxpayer
      ? normalizeName(row.from) === normalizeName(selectedTaxpayer.name) || row.email === selectedTaxpayer.email
      : false,
  );
  const selectedOutgoing = sentRows.filter((row) =>
    selectedTaxpayer
      ? normalizeName(row.to) === normalizeName(selectedTaxpayer.name) || row.email === selectedTaxpayer.email
      : false,
  );
  const personsCount = taxpayers.filter((taxpayer) => taxpayer.type === "person").length;
  const companiesCount = taxpayers.filter((taxpayer) => taxpayer.type === "company").length;

  return (
    <div className="institution-dashboard">
      <section className="page-head institution-page-head">
        <div>
          <p className="eyebrow">Registratura</p>
          <h1>{formatInstitutionName(institution)}</h1>
          <p className="muted">Gestioneaza contribuabilii, documentele intrate si istoricul schimburilor pe CNP/CIF.</p>
        </div>
        <Link href="/documents/received" className="secondary-button"><FileInput size={18} /> Registratura intrari</Link>
      </section>

      <section className="stats-grid institution-stats-grid">
        <article><UsersRound /><strong>{taxpayers.length}</strong><span>Contribuabili</span><em>In evidenta</em></article>
        <article><UserRound /><strong>{personsCount}</strong><span>Persoane fizice</span><em>CNP mapat</em></article>
        <article><Landmark /><strong>{companiesCount}</strong><span>Persoane juridice</span><em>CIF/CUI</em></article>
        <article><MailCheck /><strong>{registryRows.length}</strong><span>Documente intrate</span><em>Registratura</em></article>
      </section>

      <section className="institution-workspace">
        <article className="panel institution-taxpayers-panel">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Baza locala</p>
              <h2>Cetateni si companii</h2>
            </div>
            <span>{filteredTaxpayers.length} rezultate</span>
          </div>
          <div className="institution-filters">
            <label className="search-control">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cauta nume, CNP, CIF sau email"
              />
            </label>
            <div className="segmented-control">
              <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>Toate</button>
              <button type="button" className={typeFilter === "person" ? "active" : ""} onClick={() => setTypeFilter("person")}>PF</button>
              <button type="button" className={typeFilter === "company" ? "active" : ""} onClick={() => setTypeFilter("company")}>PJ</button>
            </div>
          </div>
          <div className="institution-taxpayer-list">
            {filteredTaxpayers.map((taxpayer) => {
              const Icon = taxpayer.type === "person" ? UserRound : Building2;

              return (
                <button
                  type="button"
                  className={`institution-taxpayer-row ${selectedTaxpayer?.id === taxpayer.id ? "active" : ""}`}
                  key={taxpayer.id}
                  onClick={() => setSelectedTaxpayerId(taxpayer.id)}
                >
                  <span className="taxpayer-icon"><Icon size={20} /></span>
                  <span>
                    <strong>{taxpayer.name}</strong>
                    <small>{taxpayer.type === "person" ? "CNP" : "CIF"} {taxpayer.identifier}</small>
                  </span>
                  <em className={taxpayer.status === "legat" ? "linked" : "unlinked"}>{taxpayer.status === "legat" ? "Cont legat" : "Fara cont"}</em>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel institution-registry-panel">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Registratura</p>
              <h2>Documente intrate</h2>
            </div>
            <Link href="/documents/received">Vezi toate <ArrowUpRight size={16} /></Link>
          </div>
          <div className="institution-registry-table">
            <div className="institution-registry-head">
              <span>Expeditor</span>
              <span>Scop</span>
              <span>Documente</span>
              <span>Data</span>
              <span>Status</span>
            </div>
            {registryRows.slice(0, 6).map((row) => (
              <article className="institution-registry-row" key={row.id}>
                <span><strong>{row.from}</strong><small>{row.email}</small></span>
                <em className={row.purpose === "Semnare" ? "purpose-signature" : "purpose-info"}>{row.purpose}</em>
                <span><strong>{row.packageName}</strong><small>{row.documents.length} documente</small></span>
                <span>{row.date}</span>
                <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
              </article>
            ))}
          </div>
        </article>
      </section>

      {selectedTaxpayer ? (
        <section className="panel taxpayer-detail-panel">
          <div className="taxpayer-profile-card">
            <span className="taxpayer-profile-icon">
              {selectedTaxpayer.type === "person" ? <UserRound size={28} /> : <Building2 size={28} />}
            </span>
            <div>
              <p className="eyebrow">{selectedTaxpayer.type === "person" ? "Persoana fizica" : "Persoana juridica"}</p>
              <h2>{selectedTaxpayer.name}</h2>
              <p>{selectedTaxpayer.email ?? "Cont neidentificat"} · {selectedTaxpayer.locality}</p>
            </div>
            <div className="taxpayer-profile-meta">
              <span>{selectedTaxpayer.type === "person" ? "CNP" : "CIF"} <strong>{selectedTaxpayer.identifier}</strong></span>
              <span>Trimise <strong>{selectedOutgoing.length}</strong></span>
              <span>Primite <strong>{selectedIncoming.length}</strong></span>
            </div>
          </div>
          <div className="taxpayer-history-grid">
            <div>
              <h3>Documente primite de la contribuabil</h3>
              <div className="taxpayer-history-list">
                {selectedIncoming.length ? selectedIncoming.map((row) => (
                  <article key={row.id}>
                    <FileInput size={18} />
                    <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                    <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                  </article>
                )) : <p className="empty-state-inline">Nu exista documente primite de la acest contribuabil.</p>}
              </div>
            </div>
            <div>
              <h3>Documente trimise catre contribuabil</h3>
              <div className="taxpayer-history-list">
                {selectedOutgoing.length ? selectedOutgoing.map((row) => (
                  <article key={row.id}>
                    <FileOutput size={18} />
                    <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                    <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                  </article>
                )) : <p className="empty-state-inline">Nu exista documente trimise catre acest contribuabil.</p>}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function DashboardHome() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <GenericDashboard />;
  }

  if (user?.accountType === "institution") {
    return <InstitutionDashboard user={user} />;
  }

  return <GenericDashboard />;
}
