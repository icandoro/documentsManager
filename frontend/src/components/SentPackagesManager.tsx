"use client";

import { PackageGroup, normalizePackageDocument, readSentPackages, statusTone } from "@/lib/packages";
import { readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import { ChevronLeft, ChevronRight, Download, FileSignature, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const pageSize = 6;

type SentRow = {
  id: string;
  recipient: string;
  email: string;
  packageName: string;
  date: string;
  purpose: string;
  status: string;
  documents: ReturnType<typeof normalizePackageDocument>[];
};

function flattenGroups(groups: PackageGroup[]): SentRow[] {
  return groups.flatMap((group, groupIndex) =>
    group.packages.map((pkg, packageIndex) => ({
      id: `${group.email}-${pkg.name}-${groupIndex}-${packageIndex}`,
      recipient: group.to,
      email: group.email,
      packageName: pkg.name,
      date: pkg.date,
      purpose: pkg.purpose === "signature" ? "Trimitere la semnat" : "Doar trimitere",
      status: pkg.status,
      documents: pkg.documents.map((document) => normalizePackageDocument(document, pkg.purpose)),
    })),
  );
}

function matches(row: SentRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const documents = row.documents.map((document) => `${document.title} ${document.status} ${document.signedFile ?? ""} ${document.signedAt ?? ""}`).join(" ");

  return `${row.recipient} ${row.email} ${row.packageName} ${row.date} ${row.status} ${documents}`.toLowerCase().includes(normalized);
}

function dateInputToDisplay(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)).toLowerCase();
}

function downloadSignedDocument(title: string, signedFile: string) {
  const blob = new Blob([`Document semnat disponibil in DocManager: ${title}\nFisier: ${signedFile}`], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = signedFile;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SentPackagesManager() {
  const [groups, setGroups] = useState<PackageGroup[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [sentDateFilter, setSentDateFilter] = useState("");
  const [signedDateFilter, setSignedDateFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<SentRow | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    function syncContextPackages() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);

      setGroups(readSentPackages(contextId));
      setSelectedRow(null);
    }

    syncContextPackages();
    window.addEventListener("storage", syncContextPackages);
    window.addEventListener("docmanager-account-context-change", syncContextPackages);

    return () => {
      window.removeEventListener("storage", syncContextPackages);
      window.removeEventListener("docmanager-account-context-change", syncContextPackages);
    };
  }, []);

  const rows = useMemo(() => flattenGroups(groups), [groups]);
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.status))), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const sentDateDisplay = dateInputToDisplay(sentDateFilter);
    const signedDateDisplay = dateInputToDisplay(signedDateFilter);
    const matchesStatus = statusFilter === "all" || row.status === statusFilter || row.documents.some((document) => document.status === statusFilter);
    const matchesPurpose = purposeFilter === "all" || row.purpose === purposeFilter;
    const matchesSentDate = !sentDateDisplay || row.date.toLowerCase().includes(sentDateDisplay);
    const matchesSignedDate = !signedDateDisplay || row.documents.some((document) => (document.signedAt ?? "").toLowerCase().includes(signedDateDisplay));

    return matches(row, query) && matchesStatus && matchesPurpose && matchesSentDate && matchesSignedDate;
  }), [purposeFilter, query, rows, sentDateFilter, signedDateFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [purposeFilter, query, sentDateFilter, signedDateFilter, statusFilter]);

  return (
    <>
      <section className="list-controls panel">
        <label className="compact-select search-filter">Cautare
          <span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pachet, document sau destinatar" /></span>
        </label>
        <label className="compact-select">Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Toate statusurile</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="compact-select">Tip pachet
          <select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)}>
            <option value="all">Toate</option>
            <option value="Trimitere la semnat">La semnat</option>
            <option value="Doar trimitere">Doar trimitere</option>
          </select>
        </label>
        <label className="compact-select">Data trimiterii
          <input type="date" value={sentDateFilter} onChange={(event) => setSentDateFilter(event.target.value)} />
        </label>
        <label className="compact-select">Data semnarii
          <input type="date" value={signedDateFilter} onChange={(event) => setSignedDateFilter(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={() => { setQuery(""); setStatusFilter("all"); setPurposeFilter("all"); setSentDateFilter(""); setSignedDateFilter(""); }}>
          Reseteaza
        </button>
      </section>

      <section className="compact-package-list panel">
        <div className="compact-package-head">
          <span>Pachet</span>
          <span>Destinatar</span>
          <span>Data trimiterii</span>
          <span>Status</span>
        </div>
        {visibleRows.map((row) => (
          <button className="compact-package-row clickable" type="button" key={row.id} onClick={() => setSelectedRow(row)}>
            <div>
              <strong><Send size={17} /> {row.packageName}</strong>
              <p>{row.purpose}</p>
            </div>
            <div>
              <strong>{row.recipient}</strong>
              <p>{row.email}</p>
            </div>
            <span>{row.date}</span>
            <span className={`status-chip ${statusTone(row.status)}`}>{row.status}</span>
          </button>
        ))}
      </section>

      {selectedRow && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Detalii ${selectedRow.packageName}`}>
          <div className="modal-panel">
            <header className="modal-head">
              <div>
                <p className="eyebrow">Pachet trimis</p>
                <h2>{selectedRow.packageName}</h2>
                <p>{selectedRow.recipient} · {selectedRow.email} · {selectedRow.date}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide detaliile" onClick={() => setSelectedRow(null)}><X size={18} /></button>
            </header>
            <div className="modal-summary">
              <span className={`status-chip ${statusTone(selectedRow.status)}`}>{selectedRow.status}</span>
              <span>{selectedRow.purpose}</span>
              <span>{selectedRow.documents.length} documente</span>
            </div>
            <div className="modal-doc-list">
              {selectedRow.documents.map((document) => (
                <article className="modal-doc-row" key={document.title}>
                  <FileSignature size={18} />
                  <div>
                    <strong>{document.title}</strong>
                    <p>{document.category ?? "Fara folder"}{document.signedFile ? ` · PDF semnat: ${document.signedFile}` : ""}</p>
                  </div>
                  <span className={`status-chip ${statusTone(document.status)}`}>{document.status}</span>
                  <span>{document.signedAt ? `Semnat: ${document.signedAt}` : ""}</span>
                  {document.signedFile ? (
                    <button className="secondary-button modal-doc-action" type="button" onClick={() => downloadSignedDocument(document.title, document.signedFile ?? `${document.title}.pdf`)}>
                      <Download size={16} /> Descarca semnat
                    </button>
                  ) : (
                    <span className="muted">Asteapta PDF semnat</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pagination-bar">
        <span>{filteredRows.length} pachete</span>
        <div>
          <button className="icon-button" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={18} /></button>
          <strong>{page} / {totalPages}</strong>
          <button className="icon-button" type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={18} /></button>
        </div>
      </section>
    </>
  );
}
