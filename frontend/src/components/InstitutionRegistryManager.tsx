"use client";

import { readPlatformInstitutions, type PlatformInstitution, type PlatformUser } from "@/lib/adminData";
import { resolveActiveContextIdForUser } from "@/lib/institutions";
import { packageDocumentTitle, readReceivedPackages, readSentPackages, statusTone, type PackageDocument } from "@/lib/packages";
import { FileInput, FileOutput, FileText, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type StoredUser = Pick<PlatformUser, "id" | "name" | "email" | "accountType" | "institutionId" | "linkedInstitutionIds">;

type RegistryDocumentRow = {
  id: string;
  direction: "in" | "out";
  partner: string;
  email: string;
  packageName: string;
  purpose: string;
  date: string;
  status: string;
  documents: Array<string | PackageDocument>;
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

function packagePurpose(purpose?: string, status?: string) {
  const normalized = `${purpose ?? ""} ${status ?? ""}`.toLowerCase();
  return normalized.includes("signature") || normalized.includes("semn") ? "Semnare" : "Informare";
}

function formatInstitutionName(institution?: PlatformInstitution, user?: StoredUser | null) {
  return institution?.name ?? user?.name ?? "Institutia curenta";
}

export function InstitutionRegistryManager() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [institution, setInstitution] = useState<PlatformInstitution | undefined>();
  const [rows, setRows] = useState<RegistryDocumentRow[]>([]);
  const [query, setQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "in" | "out">("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [detailRow, setDetailRow] = useState<RegistryDocumentRow | null>(null);

  useEffect(() => {
    function syncRegistry() {
      const storedUser = readStoredUser();
      const institutionId = resolveActiveContextIdForUser(storedUser);
      const nextInstitution = readPlatformInstitutions().find((item) => item.id === institutionId);
      const receivedRows = readReceivedPackages(institutionId).flatMap((group, groupIndex) =>
        group.packages.map<RegistryDocumentRow>((pkg, packageIndex) => ({
          id: `in-${groupIndex}-${packageIndex}`,
          direction: "in",
          partner: group.from,
          email: group.email,
          packageName: pkg.name,
          purpose: packagePurpose("purpose" in pkg ? pkg.purpose : undefined, pkg.status),
          date: pkg.date,
          status: pkg.status,
          documents: pkg.documents,
        })),
      );
      const sentRows = readSentPackages(institutionId).flatMap((group, groupIndex) =>
        group.packages.map<RegistryDocumentRow>((pkg, packageIndex) => ({
          id: `out-${groupIndex}-${packageIndex}`,
          direction: "out",
          partner: group.to,
          email: group.email,
          packageName: pkg.name,
          purpose: packagePurpose("purpose" in pkg ? pkg.purpose : undefined, pkg.status),
          date: pkg.date,
          status: pkg.status,
          documents: pkg.documents,
        })),
      );

      setUser(storedUser);
      setInstitution(nextInstitution);
      setRows([...receivedRows, ...sentRows]);
    }

    syncRegistry();
    window.addEventListener("storage", syncRegistry);
    window.addEventListener("docmanager-account-context-change", syncRegistry);

    return () => {
      window.removeEventListener("storage", syncRegistry);
      window.removeEventListener("docmanager-account-context-change", syncRegistry);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery = !normalizedQuery || `${row.partner} ${row.email} ${row.packageName} ${row.status} ${row.purpose}`.toLowerCase().includes(normalizedQuery);
      const matchesDirection = directionFilter === "all" || row.direction === directionFilter;
      const matchesPurpose = purposeFilter === "all" || row.purpose === purposeFilter;
      const matchesStatus = statusFilter === "all" || statusTone(row.status) === statusFilter;

      return matchesQuery && matchesDirection && matchesPurpose && matchesStatus;
    });
  }, [directionFilter, purposeFilter, query, rows, statusFilter]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStartIndex = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEndIndex = Math.min(currentPage * pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [directionFilter, purposeFilter, query, statusFilter]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  function goToPage(nextPage: number) {
    const normalizedPage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(normalizedPage);
  }

  function submitPageInput(event: FormEvent) {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageInput, 10);

    if (Number.isNaN(requestedPage)) {
      setPageInput(String(currentPage));
      return;
    }

    goToPage(requestedPage);
  }

  return (
    <section className="institution-registry-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Registratura</span>
          <h1>{formatInstitutionName(institution, user)}</h1>
          <p>Urmareste documentele intrate si iesite, scopul trimiterii si statusul procesarii.</p>
        </div>
      </div>

      <article className="institution-list-card registry-documents-card">
        <header>
          <div>
            <span className="eyebrow">Registratura</span>
            <h2>Lista documente</h2>
          </div>
          <span className="list-results-pill">{filteredRows.length} rezultate</span>
          <div className="institution-list-actions">
            <label className="compact-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta dupa expeditor, destinatar, pachet sau status" />
            </label>
            <div className="segmented-control">
              <button type="button" className={directionFilter === "all" ? "active" : ""} onClick={() => setDirectionFilter("all")}>Toate</button>
              <button type="button" className={directionFilter === "in" ? "active" : ""} onClick={() => setDirectionFilter("in")}>Intrate</button>
              <button type="button" className={directionFilter === "out" ? "active" : ""} onClick={() => setDirectionFilter("out")}>Iesite</button>
            </div>
            <select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)}>
              <option value="all">Toate scopurile</option>
              <option value="Semnare">Semnare</option>
              <option value="Informare">Informare</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Toate statusurile</option>
              <option value="waiting">Asteapta semnare</option>
              <option value="signed">Semnate</option>
              <option value="sent">Trimise</option>
              <option value="received">Primite</option>
              <option value="neutral">Inregistrate</option>
            </select>
          </div>
        </header>

        <div className="registry-list">
          {paginatedRows.length > 0 && (
            <div className="registry-list-head" aria-hidden="true">
              <span>Pachet</span>
              <span>Directie</span>
              <span>Documente</span>
              <span>Status</span>
              <span>Data</span>
              <span />
            </div>
          )}
          {paginatedRows.map((row) => (
            <article className="registry-row" key={row.id}>
              <div className="registry-row-main">
                <span className={`registry-row-icon ${row.direction}`}>{row.direction === "in" ? <FileInput size={18} /> : <FileOutput size={18} />}</span>
                <span>
                  <strong>{row.packageName}</strong>
                  <small>{row.partner} · {row.email}</small>
                </span>
              </div>
              <span className={`registry-direction-pill ${row.direction}`}>{row.direction === "in" ? "Intrat" : "Iesit"}</span>
              <span className="registry-row-docs">{row.documents.length} · {row.purpose}</span>
              <span className={`registry-status ${statusTone(row.status)}`}>{row.status}</span>
              <span className="registry-row-date">{row.date}</span>
              <button className="registry-details-button" type="button" onClick={() => setDetailRow(row)}>Detalii</button>
            </article>
          ))}
          {filteredRows.length === 0 ? <p className="empty-state-inline">Nu exista documente pentru filtrele selectate.</p> : null}
        </div>
        {filteredRows.length > 0 ? (
          <div className="institution-pagination institution-list-pagination">
            <span>Afisare {pageStartIndex}-{pageEndIndex} din {filteredRows.length} documente</span>
            <div className="pagination-controls">
              <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button>
              <form className="page-jump-form" onSubmit={submitPageInput}>
                <label htmlFor="registry-page-jump">Pagina</label>
                <input
                  id="registry-page-jump"
                  inputMode="numeric"
                  min={1}
                  max={totalPages}
                  type="number"
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                />
                <span>din {totalPages}</span>
              </form>
              <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>Urmator</button>
            </div>
          </div>
        ) : null}
      </article>

      {detailRow ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel taxpayer-detail-modal registry-detail-modal">
            <button className="modal-close" type="button" aria-label="Inchide detaliile documentului" onClick={() => setDetailRow(null)}>
              <X size={22} />
            </button>
            <div className="taxpayer-profile-card">
              <span className="taxpayer-profile-icon">
                {detailRow.direction === "in" ? <FileInput size={28} /> : <FileOutput size={28} />}
              </span>
              <div>
                <p className="eyebrow">{detailRow.direction === "in" ? "Document intrat" : "Document iesit"}</p>
                <h2>{detailRow.packageName}</h2>
                <p>{detailRow.partner} · {detailRow.email}</p>
              </div>
              <div className="taxpayer-profile-meta">
                <span>Scop <strong>{detailRow.purpose}</strong></span>
                <span>Data <strong>{detailRow.date}</strong></span>
                <span>Status <strong className={`registry-status ${statusTone(detailRow.status)}`}>{detailRow.status}</strong></span>
              </div>
            </div>
            <div className="taxpayer-history-grid registry-detail-documents">
              <div>
                <h3>Documente din pachet ({detailRow.documents.length})</h3>
                <div className="taxpayer-history-list">
                  {detailRow.documents.length ? detailRow.documents.map((document, index) => {
                    const title = packageDocumentTitle(document);
                    const documentStatus = typeof document === "string" ? undefined : document.status;

                    return (
                      <article key={typeof document === "string" ? `${title}-${index}` : document.id ?? `${title}-${index}`}>
                        <FileText size={18} />
                        <span><strong>{title}</strong></span>
                        {documentStatus ? <em className={`registry-status ${statusTone(documentStatus)}`}>{documentStatus}</em> : null}
                      </article>
                    );
                  }) : <p className="empty-state-inline">Pachetul nu contine documente.</p>}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
