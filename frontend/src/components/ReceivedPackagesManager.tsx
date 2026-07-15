"use client";

import { readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import { normalizePackageDocument, PackageGroup, readReceivedPackages, ReceivedPackageGroup, statusTone, writeReceivedPackages } from "@/lib/packages";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileInput, FileSignature, Search, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

type DeleteTarget =
  | { kind: "package"; row: ReceivedRow }
  | { kind: "document"; row: ReceivedRow; documentTitle: string };

function deletedPackagesStorageKey(contextId: string) {
  return `docmanager_deleted_received_packages_${contextId}`;
}

function deletedDocumentsStorageKey(contextId: string) {
  return `docmanager_deleted_received_documents_${contextId}`;
}

function readDeletedKeys(storageKey: string) {
  const saved = window.localStorage.getItem(storageKey);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as string[];

    if (Array.isArray(parsed)) return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return [];
}

function packageDeleteKey(row: Pick<ReceivedRow, "email" | "packageName" | "date">) {
  return `${row.email}::${row.packageName}::${row.date}`;
}

function documentDeleteKey(row: Pick<ReceivedRow, "email" | "packageName" | "date">, documentTitle: string) {
  return `${packageDeleteKey(row)}::${documentTitle}`;
}

function packageStatusForDocuments(documents: ReturnType<typeof normalizePackageDocument>[], fallback: string) {
  const signedCount = documents.filter((document) => document.status === "Semnat").length;
  const receivedCount = documents.filter((document) => document.status === "Primire confirmata").length;

  if (signedCount === documents.length && documents.length > 0) return "Documente semnate";
  if (signedCount > 0) return "Partial semnate";
  if (receivedCount === documents.length && documents.length > 0) return "Documente primite";
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
        status: packageStatusForDocuments(pkg.documents.map((document) => normalizePackageDocument(document, pkg.purpose)), pkg.status),
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [receivedDateFilter, setReceivedDateFilter] = useState("");
  const [signedDateFilter, setSignedDateFilter] = useState("");
  const [selectedRow, setSelectedRow] = useState<ReceivedRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletedPackageKeys, setDeletedPackageKeys] = useState<string[]>([]);
  const [deletedDocumentKeys, setDeletedDocumentKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [activeContextId, setActiveContextId] = useState("independent");

  useEffect(() => {
    function syncContextPackages() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);

      setActiveContextId(contextId);
      setGroups(readReceivedPackages(contextId));
      setDeletedPackageKeys(readDeletedKeys(deletedPackagesStorageKey(contextId)));
      setDeletedDocumentKeys(readDeletedKeys(deletedDocumentsStorageKey(contextId)));
      setSelectedRow(null);
      setDeleteTarget(null);
    }

    syncContextPackages();
    window.addEventListener("storage", syncContextPackages);
    window.addEventListener("docmanager-account-context-change", syncContextPackages);

    return () => {
      window.removeEventListener("storage", syncContextPackages);
      window.removeEventListener("docmanager-account-context-change", syncContextPackages);
    };
  }, []);

  const rows = useMemo(() => flattenGroups(groups)
    .filter((row) => !deletedPackageKeys.includes(packageDeleteKey(row)))
    .map((row) => ({
      ...row,
      documents: row.documents.filter((document) => !deletedDocumentKeys.includes(documentDeleteKey(row, document.title))),
    }))
    .filter((row) => row.documents.length > 0), [deletedDocumentKeys, deletedPackageKeys, groups]);
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
      const next = current.map((group) => group.email === sender.email && group.packages.some((pkg) => pkg.name === packageName) ? updater(group) : group);
      const updatedGroup = next.find((group) => group.email === sender.email && group.packages.some((pkg) => pkg.name === packageName));
      const updatedPackage = updatedGroup?.packages.find((pkg) => pkg.name === packageName);
      const savedSent = window.localStorage.getItem(`docmanager_sent_packages_${activeContextId}`);

      if (updatedPackage && savedSent) {
        const sentGroups = JSON.parse(savedSent) as PackageGroup[];
        const nextSentGroups = Array.isArray(sentGroups) ? sentGroups.map((group: PackageGroup) => ({
          ...group,
          packages: Array.isArray(group.packages) ? group.packages.map((pkg) => pkg.name === packageName ? updatedPackage : pkg) : group.packages,
        })) : sentGroups;

        window.localStorage.setItem(`docmanager_sent_packages_${activeContextId}`, JSON.stringify(nextSentGroups));
      }

      writeReceivedPackages(next, activeContextId);
      if (updatedGroup && updatedPackage) {
        const updatedRow = flattenGroups([updatedGroup]).find((row) => row.packageName === packageName);
        if (updatedRow) {
          setSelectedRow(updatedRow);
        }
      }

      return next;
    });
  }

  function handleSignedUpload(sender: ReceivedPackageGroup, packageName: string, documentTitle: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Documentele semnate trebuie incarcate doar in format PDF.");
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
    toast.success(`Documentul "${documentTitle}" a fost incarcat semnat.`);
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
    toast.success("Primirea pachetului a fost confirmata.");
    setSelectedRow(null);
  }

  function persistDeletedPackage(key: string) {
    setDeletedPackageKeys((current) => {
      const next = Array.from(new Set([...current, key]));

      window.localStorage.setItem(deletedPackagesStorageKey(activeContextId), JSON.stringify(next));
      return next;
    });
  }

  function persistDeletedDocument(key: string) {
    setDeletedDocumentKeys((current) => {
      const next = Array.from(new Set([...current, key]));

      window.localStorage.setItem(deletedDocumentsStorageKey(activeContextId), JSON.stringify(next));
      return next;
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "package") {
      persistDeletedPackage(packageDeleteKey(deleteTarget.row));
      setSelectedRow((current) => current && current.id === deleteTarget.row.id ? null : current);
      toast.success(`Pachetul "${deleteTarget.row.packageName}" a fost sters din documentele primite.`);
      setDeleteTarget(null);
      return;
    }

    const key = documentDeleteKey(deleteTarget.row, deleteTarget.documentTitle);
    const remainingDocuments = deleteTarget.row.documents.filter((document) => document.title !== deleteTarget.documentTitle);

    persistDeletedDocument(key);
    setSelectedRow((current) => {
      if (!current || current.id !== deleteTarget.row.id) return current;
      if (remainingDocuments.length === 0) return null;

      return { ...current, documents: remainingDocuments };
    });
    toast.success(`Documentul "${deleteTarget.documentTitle}" a fost sters din documentele primite.`);
    setDeleteTarget(null);
  }

  return (
    <>
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
          <span>Actiuni</span>
        </div>
        {visibleRows.map((row) => (
          <article className="compact-package-row clickable" key={row.id} onClick={() => setSelectedRow(row)} role="button" tabIndex={0} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedRow(row);
            }
          }}>
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
            <button className="icon-button danger received-delete-button" type="button" aria-label={`Sterge pachetul ${row.packageName}`} onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget({ kind: "package", row });
            }}>
              <Trash2 size={17} />
            </button>
          </article>
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
              <div className="modal-head-actions">
                <button className="icon-button danger" type="button" aria-label={`Sterge pachetul ${selectedRow.packageName}`} onClick={() => setDeleteTarget({ kind: "package", row: selectedRow })}>
                  <Trash2 size={18} />
                </button>
                <button className="icon-button" type="button" aria-label="Inchide detaliile" onClick={() => setSelectedRow(null)}><X size={18} /></button>
              </div>
            </header>
            <div className="modal-summary">
              <span className={`status-chip ${statusTone(selectedRow.status)}`}>{selectedRow.status}</span>
              <span>{selectedRow.purpose}</span>
              <span>{selectedRow.documents.length} documente</span>
            </div>
            <div className="modal-doc-list">
              {selectedRow.documents.map((document) => (
                <article className="modal-doc-row" key={document.title}>
                  <div className="modal-doc-main">
                    <FileSignature size={18} />
                    <div>
                      <strong>{document.title}</strong>
                      <p>{document.category ?? "Fara folder"}{document.signedFile ? ` · PDF semnat: ${document.signedFile}` : ""}</p>
                    </div>
                  </div>
                  <div className="modal-doc-meta">
                    <span className={`status-chip ${statusTone(document.status)}`}>{document.status}</span>
                    <small>{document.signedAt ? `Semnat: ${document.signedAt}` : document.receivedAt ? `Primit: ${document.receivedAt}` : "In asteptare"}</small>
                  </div>
                  <div className="modal-doc-actions">
                    <button className="secondary-button modal-doc-action" type="button" onClick={() => downloadDocument(document.title)}>
                      <Download size={16} /> Descarca
                    </button>
                    <button className="secondary-button danger-soft modal-doc-action" type="button" onClick={() => setDeleteTarget({ kind: "document", row: selectedRow, documentTitle: document.title })}>
                      <Trash2 size={16} /> Sterge
                    </button>
                    {selectedRow.isSignaturePackage && document.status !== "Semnat" && (
                      <label className="secondary-button upload-signed">
                        <UploadCloud size={16} /> PDF semnat
                        <input type="file" accept="application/pdf,.pdf" onChange={(event) => handleSignedUpload(selectedRow.sender, selectedRow.packageName, document.title, event)} />
                      </label>
                    )}
                  </div>
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

      {deleteTarget && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmare stergere document primit">
          <div className="modal-panel confirm-modal">
            <div className="confirm-icon danger">
              <Trash2 size={24} />
            </div>
            <div>
              <p className="eyebrow">Confirmare stergere</p>
              <h2>{deleteTarget.kind === "package" ? "Stergi pachetul primit?" : "Stergi documentul primit?"}</h2>
              <p className="muted">
                {deleteTarget.kind === "package"
                  ? `Pachetul "${deleteTarget.row.packageName}" va fi eliminat din lista ta de documente primite.`
                  : `Documentul "${deleteTarget.documentTitle}" va fi eliminat din pachetul "${deleteTarget.row.packageName}".`}
                {" "}Aceasta actiune afecteaza doar contul tau.
              </p>
            </div>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>
                Anuleaza
              </button>
              <button className="primary-button danger-confirm" type="button" onClick={confirmDelete}>
                Sterge
              </button>
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
