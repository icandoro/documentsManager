"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
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
  Search,
  ShieldCheck,
  Signature,
  UserRound,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { documents, receivedPackages, sentPackages } from "@/lib/data";
import {
  PlatformInstitution,
  PlatformUser,
  readPlatformInstitutions,
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

type TaxpayerSummary = {
  total: number;
  persons: number;
  companies: number;
  active: number;
};

type TaxpayerApiResponse = {
  items: TaxpayerView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: TaxpayerSummary;
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
  const [statusFilter, setStatusFilter] = useState<"all" | "legat" | "nelegat">("all");
  const [accountKindFilter, setAccountKindFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<TaxpayerSummary>({ total: 0, persons: 0, companies: 0, active: 0 });
  const [isLoadingTaxpayers, setIsLoadingTaxpayers] = useState(false);
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState("");
  const [institution, setInstitution] = useState<PlatformInstitution | undefined>();
  const [institutionId, setInstitutionId] = useState(user.linkedInstitutionIds?.[0] ?? "primaria-joita");
  const [taxpayers, setTaxpayers] = useState<TaxpayerView[]>([]);
  const [detailTaxpayer, setDetailTaxpayer] = useState<TaxpayerView | null>(null);
  const [registryRows, setRegistryRows] = useState<RegistryRow[]>([]);
  const [sentRows, setSentRows] = useState<SentHistoryRow[]>([]);

  useEffect(() => {
    const institutions = readPlatformInstitutions();
    const nextInstitutionId = user.linkedInstitutionIds?.[0] ?? institutions[0]?.id ?? "primaria-joita";
    const currentInstitution = institutions.find((item) => item.id === nextInstitutionId) ?? institutions[0];
    const received = readReceivedPackages(nextInstitutionId);
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
    const sent = readSentPackages(nextInstitutionId);
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
    setInstitutionId(nextInstitutionId);
    setRegistryRows([...receivedRows, ...demoRows]);
    setSentRows([...flattenedSent, ...demoSent]);
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      institutionId,
      page: String(page),
      limit: "20",
      q: query,
      type: typeFilter,
      status: statusFilter,
      accountKind: accountKindFilter,
    });

    setIsLoadingTaxpayers(true);
    fetch(`/api/institution-taxpayers?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: TaxpayerApiResponse) => {
        setTaxpayers(data.items);
        setTotalResults(data.total);
        setTotalPages(data.totalPages);
        setSummary(data.summary);
        setSelectedTaxpayerId((current) => data.items.some((item) => item.id === current) ? current : data.items[0]?.id ?? "");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setTaxpayers([]);
          setTotalResults(0);
          setTotalPages(1);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingTaxpayers(false);
      });

    return () => controller.abort();
  }, [accountKindFilter, institutionId, page, query, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [accountKindFilter, query, statusFilter, typeFilter]);

  const selectedTaxpayer = taxpayers.find((taxpayer) => taxpayer.id === selectedTaxpayerId) ?? taxpayers[0];
  const detailIncoming = registryRows.filter((row) =>
    detailTaxpayer
      ? normalizeName(row.from) === normalizeName(detailTaxpayer.name) || row.email === detailTaxpayer.email
      : false,
  );
  const detailOutgoing = sentRows.filter((row) =>
    detailTaxpayer
      ? normalizeName(row.to) === normalizeName(detailTaxpayer.name) || row.email === detailTaxpayer.email
      : false,
  );
  const pendingSignatureCount = (taxpayer: TaxpayerView) => {
    const byTaxpayer = [...registryRows, ...sentRows].filter((row) => {
      const participantName = "from" in row ? row.from : row.to;

      return normalizeName(participantName) === normalizeName(taxpayer.name) || row.email === taxpayer.email;
    });

    return byTaxpayer.filter((row) => {
      const status = row.status.toLowerCase();
      return row.purpose === "Semnare" && !status.includes("semnat") && !status.includes("primit");
    }).length;
  };

  return (
    <div className="institution-dashboard">
      <section className="page-head institution-page-head">
        <div>
          <p className="eyebrow">Registratura</p>
          <h1>{formatInstitutionName(institution)}</h1>
          <p className="muted">Gestioneaza contribuabilii, legaturile de cont si istoricul schimburilor pe CNP/CIF.</p>
        </div>
        <Link href="/documents/received" className="secondary-button"><FileInput size={18} /> Registratura intrari</Link>
      </section>

      <section className="stats-grid institution-stats-grid">
        <article><UsersRound /><strong>{summary.total}</strong><span>Contribuabili</span><em>In evidenta</em></article>
        <article><UserRound /><strong>{summary.persons}</strong><span>Persoane fizice</span><em>CNP mapat</em></article>
        <article><Landmark /><strong>{summary.companies}</strong><span>Persoane juridice</span><em>CIF/CUI</em></article>
      </section>

      <section className="institution-workspace">
        <article className="panel institution-taxpayers-panel">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Baza locala</p>
              <h2>Cetateni si companii</h2>
            </div>
            <span>{isLoadingTaxpayers ? "Se incarca..." : `${totalResults} rezultate`}</span>
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
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Toate statusurile</option>
              <option value="legat">Cont legat</option>
              <option value="nelegat">Fara cont</option>
            </select>
            <select value={accountKindFilter} onChange={(event) => setAccountKindFilter(event.target.value)}>
              <option value="all">Toate tipurile</option>
              <option value="resident">Domiciliu localitate</option>
              <option value="property_owner">Proprietar localitate</option>
              <option value="company_hq">Sediu social local</option>
              <option value="company_property_owner">Companie cu proprietati</option>
            </select>
          </div>
          <div className="institution-taxpayer-list">
            {taxpayers.map((taxpayer) => {
              const Icon = taxpayer.type === "person" ? UserRound : Building2;
              const incomingCount = registryRows.filter((row) => normalizeName(row.from) === normalizeName(taxpayer.name) || row.email === taxpayer.email).length;
              const outgoingCount = sentRows.filter((row) => normalizeName(row.to) === normalizeName(taxpayer.name) || row.email === taxpayer.email).length;
              const pendingCount = pendingSignatureCount(taxpayer);

              return (
                <article
                  className={`institution-taxpayer-row ${selectedTaxpayer?.id === taxpayer.id ? "active" : ""}`}
                  key={taxpayer.id}
                >
                  <button type="button" className="taxpayer-main-button" onClick={() => setSelectedTaxpayerId(taxpayer.id)}>
                    <span className="taxpayer-icon"><Icon size={20} /></span>
                    <span>
                      <strong>{taxpayer.name}</strong>
                      <small>{taxpayer.type === "person" ? "CNP" : "CIF"} {taxpayer.identifier} · {taxpayer.locality}</small>
                    </span>
                  </button>
                  <span className="taxpayer-row-meta">
                    <em className={taxpayer.status === "legat" ? "linked" : "unlinked"}>{taxpayer.status === "legat" ? "Cont legat" : "Fara cont"}</em>
                    <small>{pendingCount} in asteptare semnare</small>
                  </span>
                  <span className="taxpayer-row-counts">
                    <small>Primite <strong>{incomingCount}</strong></small>
                    <small>Trimise <strong>{outgoingCount}</strong></small>
                  </span>
                  <button type="button" className="taxpayer-details-button" onClick={() => setDetailTaxpayer(taxpayer)}>Detalii</button>
                </article>
              );
            })}
            {!isLoadingTaxpayers && taxpayers.length === 0 ? <p className="empty-state-inline">Nu exista contribuabili pentru filtrele selectate.</p> : null}
          </div>
          <div className="institution-pagination">
            <span>Afisare {taxpayers.length ? (page - 1) * 20 + 1 : 0}-{(page - 1) * 20 + taxpayers.length} din {totalResults}</span>
            <div>
              <button type="button" disabled={page <= 1 || isLoadingTaxpayers} onClick={() => setPage((current) => Math.max(1, current - 1))}>Inapoi</button>
              <strong>{page} / {totalPages}</strong>
              <button type="button" disabled={page >= totalPages || isLoadingTaxpayers} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Urmator</button>
            </div>
          </div>
        </article>
      </section>

      {detailTaxpayer ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel taxpayer-detail-modal">
            <button className="modal-close" type="button" aria-label="Inchide detaliile contribuabilului" onClick={() => setDetailTaxpayer(null)}>
              <X size={22} />
            </button>
            <div className="taxpayer-profile-card">
              <span className="taxpayer-profile-icon">
                {detailTaxpayer.type === "person" ? <UserRound size={28} /> : <Building2 size={28} />}
              </span>
              <div>
                <p className="eyebrow">{detailTaxpayer.type === "person" ? "Persoana fizica" : "Persoana juridica"}</p>
                <h2>{detailTaxpayer.name}</h2>
                <p>{detailTaxpayer.email ?? "Cont neidentificat"} · {detailTaxpayer.locality}</p>
              </div>
              <div className="taxpayer-profile-meta">
                <span>{detailTaxpayer.type === "person" ? "CNP" : "CIF"} <strong>{detailTaxpayer.identifier}</strong></span>
                <span>Trimise <strong>{detailOutgoing.length}</strong></span>
                <span>Primite <strong>{detailIncoming.length}</strong></span>
              </div>
            </div>
            <div className="taxpayer-modal-actions">
              <Link className="secondary-button" href={`/institutie/cetateni/${detailTaxpayer.id}`}>
                Profil contribuabil <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="taxpayer-history-grid">
              <div>
                <h3>Documente primite de la contribuabil</h3>
                <div className="taxpayer-history-list">
                  {detailIncoming.length ? detailIncoming.map((row) => (
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
                  {detailOutgoing.length ? detailOutgoing.map((row) => (
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
        </div>
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
