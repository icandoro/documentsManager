"use client";

import { normalizePackageDocument, PackageGroup, readReceivedPackages, ReceivedPackageGroup, statusTone, writeReceivedPackages } from "@/lib/packages";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileInput, FileSignature, Search, UploadCloud, X } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const pageSize = 6;

type ReceivedRow = {
  id: string;
  sender: ReceivedPackageGroup;
  from: string;
  email: string;
  packageName: string;
  date: string;
  purpose: string;
  status: string;
  isSignaturePackage: boolean;
  documents: ReturnType<typeof normalizePackageDocument>[];
};

function packageStatusForDocuments(documents: ReturnType<typeof normalizePackageDocument>[], fallback: string) {
  if (documents.every((document) => document.status === "Semnat")) return "Documente semnate";
  if (documents.every((document) => document.status === "Primire confirmata")) return "Documente primite";
  return fallback;
}

function flattenGroups(groups: ReceivedPackageGroup[]): ReceivedRow[] {
  return groups.flatMap((group, groupIndex) =>
    group.packages.map((pkg, packageIndex) => {
      const isSignaturePackage = pkg.purpose === "signature" || pkg.status.includes("semnat") || pkg.status.includes("Semnare");

      return {
        id: `${group.email}-${pkg.name}-${groupIndex}-${packageIndex}`,
        sender: group,
        from: group.from,
        email: group.email,
        packageName: pkg.name,
        date: pkg.date,
        purpose: isSignaturePackage ? "Semnare documente" : "Doar trimitere",
        status: pkg.status,
        isSignaturePackage,
        documents: pkg.documents.map((document) => normalizePackageDocument(document, pkg.purpose)),
      };
    }),
  );
}

function matches(row: ReceivedRow, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const documents = row.documents.map((document) => `${document.title} ${document.status} ${document.signedFile ?? ""} ${document.signedAt ?? ""} ${document.receivedAt ?? ""}`).join(" ");

  return `${row.from} ${row.email} ${row.packageName} ${row.date} ${row.status} ${documents}`.toLowerCase().includes(normalized);
}

function dateInputToDisplay(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)).toLowerCase();
}

function downloadDocument(title: string) {
  const blob = new Blob([`Document descarcat din DocManager: ${title}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/\s+/g, "-").toLowerCase()}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReceivedPackagesManager() {
  const [groups, setGroups] = useState<ReceivedPackageGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [receivedDateFilter, setReceivedDateFilter] = useState("");
  const [signedDateFilter, setSignedDateFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<ReceivedRow | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setGroups(readReceivedPackages());
  }, []);

  const rows = useMemo(() => flattenGroups(groups), [groups]);
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.status))), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const receivedDateDisplay = dateInputToDisplay(receivedDateFilter);
    const signedDateDisplay = dateInputToDisplay(signedDateFilter);
    const matchesStatus = statusFilter === "all" || row.status === statusFilter || row.documents.some((document) => document.status === statusFilter);
    const matchesPurpose = purposeFilter === "all" || row.purpose === purposeFilter;
    const matchesReceivedDate = !receivedDateDisplay || row.date.toLowerCase().includes(receivedDateDisplay);
    const matchesSignedDate = !signedDateDisplay || row.documents.some((document) => (document.signedAt ?? "").toLowerCase().includes(signedDateDisplay));

    return matches(row, query) && matchesStatus && matchesPurpose && matchesReceivedDate && matchesSignedDate;
  }), [purposeFilter, query, receivedDateFilter, rows, signedDateFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [purposeFilter, query, receivedDateFilter, signedDateFilter, statusFilter]);

  function updatePackage(sender: ReceivedPackageGroup, packageName: string, updater: (group: ReceivedPackageGroup) => ReceivedPackageGroup) {
    setGroups((current) => {
      const localGroups = current.filter((group) => group.from === "Contul meu" || group.email === "expeditor@docmanager.local");
      const next = localGroups.map((group) => group.email === sender.email && group.packages.some((pkg) => pkg.name === packageName) ? updater(group) : group);
      const updatedPackage = next.flatMap((group) => group.packages).find((pkg) => pkg.name === packageName);
      const savedSent = window.localStorage.getItem("docmanager_sent_packages");

      if (updatedPackage && savedSent) {
        const sentGroups = JSON.parse(savedSent) as PackageGroup[];
        const nextSentGroups = Array.isArray(sentGroups) ? sentGroups.map((group: PackageGroup) => ({
          ...group,
          packages: Array.isArray(group.packages) ? group.packages.map((pkg) => pkg.name === packageName ? updatedPackage : pkg) : group.packages,
        })) : sentGroups;

        window.localStorage.setItem("docmanager_sent_packages", JSON.stringify(nextSentGroups));
      }

      writeReceivedPackages(next);
      return readReceivedPackages();
    });
  }

  function handleSignedUpload(sender: ReceivedPackageGroup, packageName: string, documentTitle: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Documentele semnate trebuie incarcate doar in format PDF.");
      event.target.value = "";
      return;
    }

    const signedAt = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
    updatePackage(sender, packageName, (group) => {
      const packages = group.packages.map((pkg) => {
        if (pkg.name !== packageName) return pkg;

        const documents = pkg.documents.map((document) => {
          const normalized = normalizePackageDocument(document, pkg.purpose);
          if (normalized.title !== documentTitle) return normalized;

          return { ...normalized, status: "Semnat", signedFile: file.name, signedAt };
        });

        return { ...pkg, documents, status: packageStatusForDocuments(documents, pkg.status) };
      });

      return { ...group, packages };
    });
    setMessage(`Documentul "${documentTitle}" a fost incarcat semnat.`);
    setSelectedRow(null);
    event.target.value = "";
  }

  function confirmReceipt(sender: ReceivedPackageGroup, packageName: string) {
    const receivedAt = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
    updatePackage(sender, packageName, (group) => {
      const packages = group.packages.map((pkg) => {
        if (pkg.name !== packageName) return pkg;

        const documents = pkg.documents.map((document) => ({
          ...normalizePackageDocument(document, pkg.purpose),
          status: "Primire confirmata",
          receivedAt,
        }));

        return { ...pkg, documents, status: "Documente primite" };
      });

      return { ...group, packages };
    });
    setMessage("Primirea pachetului a fost confirmata.");
    setSelectedRow(null);
  }

  return (
    <>
      {message && <p className="inline-alert">{message}</p>}
      <section className="list-controls panel">
        <label className="compact-select search-filter">Cautare
          <span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pachet, document sau expeditor" /></span>
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
            <option value="Semnare documente">Semnare</option>
            <option value="Doar trimitere">Doar trimitere</option>
          </select>
        </label>
        <label className="compact-select">Data primirii
          <input type="date" value={receivedDateFilter} onChange={(event) => setReceivedDateFilter(event.target.value)} />
        </label>
        <label className="compact-select">Data semnarii
          <input type="date" value={signedDateFilter} onChange={(event) => setSignedDateFilter(event.target.value)} />
        </label>
        <button className="secondary-button" type="button" onClick={() => { setQuery(""); setStatusFilter("all"); setPurposeFilter("all"); setReceivedDateFilter(""); setSignedDateFilter(""); }}>
          Reseteaza
        </button>
      </section>

      <section className="compact-package-list panel">
        <div className="compact-package-head">
          <span>Pachet</span>
          <span>Expeditor</span>
          <span>Data primirii</span>
          <span>Status</span>
        </div>
        {visibleRows.map((row) => (
          <button className="compact-package-row clickable" type="button" key={row.id} onClick={() => setSelectedRow(row)}>
            <div>
              <strong><FileInput size={17} /> {row.packageName}</strong>
              <p>{row.purpose}</p>
            </div>
            <div>
              <strong>{row.from}</strong>
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
                <p className="eyebrow">Pachet primit</p>
                <h2>{selectedRow.packageName}</h2>
                <p>{selectedRow.from} · {selectedRow.email} · {selectedRow.date}</p>
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
                  <span>{document.signedAt ? `Semnat: ${document.signedAt}` : document.receivedAt ? `Primit: ${document.receivedAt}` : ""}</span>
                  <button className="secondary-button modal-doc-action" type="button" onClick={() => downloadDocument(document.title)}>
                    <Download size={16} /> Descarca original
                  </button>
                  {selectedRow.isSignaturePackage && document.status !== "Semnat" && (
                    <label className="secondary-button upload-signed">
                      <UploadCloud size={16} /> Incarca PDF semnat
                      <input type="file" accept="application/pdf,.pdf" onChange={(event) => handleSignedUpload(selectedRow.sender, selectedRow.packageName, document.title, event)} />
                    </label>
                  )}
                </article>
              ))}
            </div>
            {!selectedRow.isSignaturePackage && selectedRow.status !== "Documente primite" && (
              <button className="primary-button package-action" type="button" onClick={() => confirmReceipt(selectedRow.sender, selectedRow.packageName)}>
                <CheckCircle2 size={18} /> Confirma primirea
              </button>
            )}
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
