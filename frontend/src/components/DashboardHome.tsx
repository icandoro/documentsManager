"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Building2,
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
import { apiFetch } from "@/lib/api";
import {
  readAccountContexts,
  readActiveAccountContextId,
  resolveActiveContextIdForUser,
} from "@/lib/institutions";
import {
  PlatformInstitution,
  PlatformUser,
  readPlatformInstitutions,
} from "@/lib/adminData";
import { readPackageTemplates } from "@/lib/packageTemplates";
import { packageDocumentTitle, readReceivedPackages, readSentPackages, type PackageGroup, type ReceivedPackageGroup } from "@/lib/packages";

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
  linkedUserId?: number | null;
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

type DashboardDocument = {
  id: number;
  title: string;
  type: string;
  status: string;
  size: string;
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

function documentsStorageKey(contextId: string) {
  return `docmanager_documents_${contextId}`;
}

function readDashboardDocuments(contextId: string): DashboardDocument[] {
  if (typeof window === "undefined") {
    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      status: document.status,
      size: document.size,
    }));
  }

  const saved = window.localStorage.getItem(documentsStorageKey(contextId));

  if (!saved) {
    return contextId === "independent"
      ? documents.map((document) => ({
        id: document.id,
        title: document.title,
        type: document.type,
        status: document.status,
        size: document.size,
      }))
      : [];
  }

  try {
    const parsed = JSON.parse(saved) as Array<{ id: number; title: string; type?: string; category?: string; status?: string; size?: string }>;

    if (Array.isArray(parsed)) {
      return parsed.map((document) => ({
        id: document.id,
        title: document.title,
        type: document.type ?? document.category ?? "Document",
        status: document.status ?? "Inregistrat",
        size: document.size ?? "fara marime",
      }));
    }
  } catch {
    window.localStorage.removeItem(documentsStorageKey(contextId));
  }

  return [];
}

function flattenReceived(contextId: string) {
  if (typeof window === "undefined") return receivedPackages as ReceivedPackageGroup[];

  return readReceivedPackages(contextId);
}

function flattenSent(contextId: string) {
  if (typeof window === "undefined") return sentPackages as PackageGroup[];

  return readSentPackages(contextId);
}

function formatInstitutionName(institution?: PlatformInstitution) {
  return institution?.name ?? "Institutia curenta";
}

function GenericDashboard() {
  const [contextId, setContextId] = useState("independent");
  const [contextName, setContextName] = useState("Activitate independenta");
  const [dashboardDocuments, setDashboardDocuments] = useState<DashboardDocument[]>(
    documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      status: document.status,
      size: document.size,
    })),
  );
  const [received, setReceived] = useState<ReceivedPackageGroup[]>(receivedPackages as ReceivedPackageGroup[]);
  const [sent, setSent] = useState<PackageGroup[]>(sentPackages as PackageGroup[]);
  const [templateCount, setTemplateCount] = useState(0);

  useEffect(() => {
    function syncDashboard() {
      const contexts = readAccountContexts();
      const nextContextId = readActiveAccountContextId(contexts);
      const nextContext = contexts.find((context) => context.id === nextContextId);

      setContextId(nextContextId);
      setContextName(nextContext?.name ?? "Activitate independenta");
      setDashboardDocuments(readDashboardDocuments(nextContextId));
      setReceived(flattenReceived(nextContextId));
      setSent(flattenSent(nextContextId));
      setTemplateCount(readPackageTemplates(nextContextId).length);
    }

    syncDashboard();
    window.addEventListener("docmanager-account-context-change", syncDashboard);
    window.addEventListener("storage", syncDashboard);

    return () => {
      window.removeEventListener("docmanager-account-context-change", syncDashboard);
      window.removeEventListener("storage", syncDashboard);
    };
  }, []);

  const receivedRows = received.flatMap((group) =>
    group.packages.map((pkg) => ({
      id: `received-${group.email}-${pkg.name}`,
      title: pkg.name,
      participant: group.from,
      direction: "Primit",
      date: pkg.date,
      status: pkg.status,
      count: pkg.documents.length,
    })),
  );
  const sentRows = sent.flatMap((group) =>
    group.packages.map((pkg) => ({
      id: `sent-${group.email}-${pkg.name}`,
      title: pkg.name,
      participant: group.to,
      direction: "Trimis",
      date: pkg.date,
      status: pkg.status,
      count: pkg.documents.length,
    })),
  );
  const activityRows = [...receivedRows, ...sentRows].slice(0, 6);
  const pendingSignatureCount = activityRows.filter((row) => row.status.toLowerCase().includes("semn") && !row.status.toLowerCase().includes("semnat")).length;
  const signedCount = activityRows.filter((row) => row.status.toLowerCase().includes("semnat") || row.status.toLowerCase().includes("primit")).length;

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Panou control</p>
          <h1>Panou de control</h1>
          <p className="muted">Activitatea contului pentru {contextName}: documente, pachete, semnari si actiuni recente.</p>
        </div>
        <Link href="/documents" className="secondary-button"><Filter size={18} /> Filtre avansate</Link>
      </section>
      <section className="stats-grid">
        <article><Files /><strong>{dashboardDocuments.length}</strong><span>Documente</span><em>{contextId === "independent" ? "Personal" : "Context"}</em></article>
        <article><FileInput /><strong>{receivedRows.length}</strong><span>Pachete primite</span><em>{pendingSignatureCount ? "De procesat" : "La zi"}</em></article>
        <article><FileOutput /><strong>{sentRows.length}</strong><span>Pachete trimise</span><em>Urmăribile</em></article>
        <article className="dark-metric"><ShieldCheck /><strong>{templateCount}</strong><span>Sabloane</span><Link href="/documents/templates">Vezi lista</Link></article>
      </section>
      <section className="dashboard-grid enterprise-dashboard-grid">
        <article className="panel performance-card">
          <div className="panel-title-row">
            <div>
              <h2>Flux documente</h2>
              <p>Volum estimat pe baza activitatii din cont</p>
            </div>
            <span><i /> Trimiteri <i /> Primiri</span>
          </div>
          <div className="bar-chart" aria-label="Grafic volum documente">
            {[dashboardDocuments.length + 18, receivedRows.length * 18 + 28, sentRows.length * 20 + 22, templateCount * 18 + 24, signedCount * 20 + 30, pendingSignatureCount * 24 + 26].map((height, index) => (
              <span key={index} style={{ "--bar-height": `${height}%` } as CSSProperties}><i /></span>
            ))}
          </div>
        </article>
        <article className="panel quick-insights">
          <h2>Indicatori rapizi</h2>
          <div className="insight-row"><Zap /><span><strong>Fluxuri active</strong><small>{receivedRows.length + sentRows.length} pachete in istoric</small></span></div>
          <div className="insight-row"><Signature /><span><strong>Semnari in asteptare</strong><small>{pendingSignatureCount} documente/pachete necesita atentie</small></span></div>
          <div className="insight-row"><Gauge /><span><strong>Finalizate</strong><small>{signedCount} fluxuri marcate ca primite/semnate</small></span></div>
          <Link className="secondary-button" href="/documents/sent">Vezi trimiteri</Link>
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
        {dashboardDocuments.slice(0, 4).map((document) => (
          <article className="recent-document-row" key={document.id}>
            <span className="file-icon"><Files size={20} /></span>
            <div>
              <strong>{document.title}</strong>
              <small>{document.size}</small>
            </div>
            <span>{contextName}</span>
            <em className={statusTone(document.status)}>{document.status}</em>
            <Link href="/documents"><ArrowUpRight size={18} /></Link>
          </article>
        ))}
        {dashboardDocuments.length === 0 ? <p className="empty-state-inline">Nu exista documente incarcate in contextul selectat.</p> : null}
      </section>
      <section className="dashboard-grid account-activity-grid">
        <article className="panel dashboard-activity-card">
          <div className="section-title-row">
            <h2>Istoric activitate cont</h2>
            <Link href="/documents/received">Vezi primite <ArrowUpRight size={16} /></Link>
          </div>
          <div className="dashboard-activity-list">
            {activityRows.map((row) => (
              <article key={row.id}>
                <span className={row.direction === "Primit" ? "received" : "sent"}>{row.direction === "Primit" ? <FileInput size={17} /> : <FileOutput size={17} />}</span>
                <div>
                  <strong>{row.title}</strong>
                  <small>{row.participant} · {row.count} documente · {row.date}</small>
                </div>
                <em className={statusTone(row.status)}>{row.status}</em>
              </article>
            ))}
            {activityRows.length === 0 ? <p className="empty-state-inline">Nu exista activitate pentru contextul selectat.</p> : null}
          </div>
        </article>
        <article className="panel dashboard-actions-card">
          <h2>Actiuni recomandate</h2>
          <div className="task-list">
            <span>{pendingSignatureCount ? "Verifica documentele care asteapta semnare" : "Nu ai semnari restante"}</span>
            <span>Actualizeaza profilul pentru contextul selectat</span>
            <span>Pregateste un sablon reutilizabil pentru trimiteri frecvente</span>
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
  const [institutionId, setInstitutionId] = useState("");
  const [taxpayers, setTaxpayers] = useState<TaxpayerView[]>([]);
  const [detailTaxpayer, setDetailTaxpayer] = useState<TaxpayerView | null>(null);
  const [registryRows, setRegistryRows] = useState<RegistryRow[]>([]);
  const [sentRows, setSentRows] = useState<SentHistoryRow[]>([]);

  useEffect(() => {
    function syncInstitutionDashboard() {
      const institutions = readPlatformInstitutions();
      const nextInstitutionId = resolveActiveContextIdForUser(user);
      const currentInstitution = institutions.find((item) => item.id === nextInstitutionId);
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

      setInstitution(currentInstitution);
      setInstitutionId(nextInstitutionId);
      setRegistryRows(receivedRows);
      setSentRows(flattenedSent);
    }

    syncInstitutionDashboard();
    window.addEventListener("storage", syncInstitutionDashboard);
    window.addEventListener("docmanager-account-context-change", syncInstitutionDashboard);

    return () => {
      window.removeEventListener("storage", syncInstitutionDashboard);
      window.removeEventListener("docmanager-account-context-change", syncInstitutionDashboard);
    };
  }, [user]);

  useEffect(() => {
    if (!institutionId) return;

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
    apiFetch(`/api/institution-taxpayers?${params.toString()}`, { signal: controller.signal })
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
  const incomingDocumentCount = registryRows.reduce((total, row) => total + row.documents.length, 0);
  const outgoingDocumentCount = sentRows.reduce((total, row) => total + row.documents.length, 0);
  const totalDocumentCount = incomingDocumentCount + outgoingDocumentCount;
  const activeFlows = [...registryRows, ...sentRows].filter((row) => {
    const normalized = row.status.toLowerCase();
    return normalized.includes("asteapta") || normalized.includes("partial") || normalized.includes("trimis");
  }).length;
  const chartValues = [
    summary.total,
    summary.persons,
    summary.companies,
    incomingDocumentCount,
    outgoingDocumentCount,
    activeFlows,
  ];
  const maxChartValue = Math.max(...chartValues, 1);

  return (
    <div className="institution-dashboard">
      <section className="page-head institution-page-head">
        <div>
          <p className="eyebrow">Panou control</p>
          <h1>{formatInstitutionName(institution)}</h1>
          <p className="muted">Rezumat rapid pentru documente, cetateni, pachete si actiuni recente.</p>
        </div>
        <Link href="/institutie/registratura" className="secondary-button"><FileInput size={18} /> Lista documente</Link>
      </section>

      <section className="stats-grid institution-stats-grid">
        <article><UsersRound /><strong>{summary.total}</strong><span>Cetateni</span><em>In evidenta</em></article>
        <article><UserRound /><strong>{summary.persons}</strong><span>Persoane fizice</span><em>CNP mapat</em></article>
        <article><Landmark /><strong>{summary.companies}</strong><span>Persoane juridice</span><em>CIF/CUI</em></article>
      </section>

      <section className="stats-grid institution-document-stats">
        <article><FileInput /><strong>{incomingDocumentCount}</strong><span>Documente intrate</span><em>Registratura</em></article>
        <article><FileOutput /><strong>{outgoingDocumentCount}</strong><span>Documente iesite</span><em>Trimise</em></article>
        <article><Files /><strong>{totalDocumentCount}</strong><span>Total documente</span><em>Activitate cont</em></article>
      </section>

      <section className="institution-analytics-grid">
        <article className="panel institution-chart-card">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Activitate</p>
              <h2>Volum operational</h2>
            </div>
            <span>{activeFlows} fluxuri active</span>
          </div>
          <div className="mini-bar-chart" aria-label="Grafic activitate institutie">
            {chartValues.map((value, index) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                style={{ "--bar-height": `${Math.max(16, Math.round((value / maxChartValue) * 100))}%` } as CSSProperties}
              >
                <em>{["Total", "PF", "PJ", "Intrate", "Iesite", "Activi"][index]}</em>
              </span>
            ))}
          </div>
        </article>
        <article className="panel institution-chart-card compact">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Registratura</p>
              <h2>Stare curenta</h2>
            </div>
            <Gauge size={20} />
          </div>
          <div className="dashboard-status-stack">
            <span><strong>{registryRows.length}</strong> pachete intrate</span>
            <span><strong>{sentRows.length}</strong> pachete iesite</span>
            <span><strong>{activeFlows}</strong> in procesare</span>
          </div>
        </article>
      </section>

      <section className="institution-workspace">
        <article className="panel institution-taxpayers-panel">
          <div className="institution-panel-head">
            <div>
              <p className="eyebrow">Baza locala</p>
              <h2>Cetateni recenti</h2>
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
              <option value="legat">Cont activ</option>
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
                    <em className={taxpayer.status === "legat" ? "linked" : "unlinked"}>{taxpayer.status === "legat" ? "Cont activ" : "Fara cont"}</em>
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
            {!isLoadingTaxpayers && taxpayers.length === 0 ? <p className="empty-state-inline">Nu exista cetateni pentru filtrele selectate.</p> : null}
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
            <button className="modal-close" type="button" aria-label="Inchide detaliile cetateanului" onClick={() => setDetailTaxpayer(null)}>
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
              <span className="taxpayer-linked-account-id">
                ID cont platforma: <strong>{detailTaxpayer.linkedUserId ? `user-${detailTaxpayer.linkedUserId}` : "fara cont legat"}</strong>
              </span>
              <Link className="secondary-button citizen-profile-link" href={`/institutie/cetateni/${detailTaxpayer.id}`}>
                Profil cetatean <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="taxpayer-history-grid">
              <div>
                <h3>Documente primite de la cetatean</h3>
                <div className="taxpayer-history-list">
                  {detailIncoming.length ? detailIncoming.map((row) => (
                    <article key={row.id}>
                      <FileInput size={18} />
                      <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                      <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                    </article>
                  )) : <p className="empty-state-inline">Nu exista documente primite de la acest cetatean.</p>}
                </div>
              </div>
              <div>
                <h3>Documente trimise catre cetatean</h3>
                <div className="taxpayer-history-list">
                  {detailOutgoing.length ? detailOutgoing.map((row) => (
                    <article key={row.id}>
                      <FileOutput size={18} />
                      <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                      <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                    </article>
                  )) : <p className="empty-state-inline">Nu exista documente trimise catre acest cetatean.</p>}
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
