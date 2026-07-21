"use client";

import { documents as seedDocuments } from "@/lib/data";
import { PlatformUser, readPlatformUsers, readTaxpayerCompanies, readTaxpayerPersons } from "@/lib/adminData";
import { AccountContext, readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import { PackageTemplate, readPackageTemplates, writePackageTemplates } from "@/lib/packageTemplates";
import {
  PackageGroup,
  PackagePurpose,
  createPackageDocumentId,
  readSentPackages,
  receivedPackagesStorageKey,
  sentPackagesStorageKey,
  statusTone,
  writeReceivedPackages,
  writeSentPackages,
} from "@/lib/packages";
import { Archive, Building2, Check, ChevronLeft, ChevronRight, FileCheck, FileText, IdCard, Mail, Plus, Search, Send, ShieldCheck, UploadCloud, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type StoredDocument = {
  id: number;
  title: string;
  type: string;
  category: string;
  size: string;
  storageName?: string;
  uploadedAt?: string;
};

const categoryOptions = ["Identitate", "HR", "Civil", "Contracte", "Medical", "Financiar", "Altul"];
const recipientHistoryStorageKey = "docmanager_recipient_history";
const documentsPerPage = 3;

function iconForType(type: string) {
  if (type === "Identitate") return IdCard;
  if (type === "Civil") return FileCheck;
  if (type === "HR" || type === "Contract") return FileText;
  return ShieldCheck;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildStorageName(fileName: string, index: number) {
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "document";
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${Date.now()}-${index}-${suffix}-${baseName}.${extension}`;
}

async function uploadDocumentToServer(file: File, category: string, ownerId?: number): Promise<StoredDocument | null> {
  if (!ownerId) return null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  formData.append("ownerId", String(ownerId));

  try {
    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) return null;

    const payload = await response.json() as {
      id?: number;
      title?: string;
      type?: string;
      category?: string;
      sizeBytes?: number;
      storageName?: string;
      uploadedAt?: string;
    };

    if (typeof payload.id !== "number") return null;

    return {
      id: payload.id,
      title: payload.title ?? file.name.replace(/\.[^.]+$/, ""),
      type: payload.type ?? category,
      category: payload.category ?? category,
      size: formatBytes(payload.sizeBytes ?? file.size),
      storageName: payload.storageName,
      uploadedAt: payload.uploadedAt,
    };
  } catch {
    return null;
  }
}

function initialDocuments(): StoredDocument[] {
  return seedDocuments.map(({ id, title, type, size }) => ({
    id,
    title,
    type,
    category: type === "Contract" ? "Contracte" : type,
    size,
  }));
}

function splitRecipients(value: string) {
  return Array.from(new Set(value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean)));
}

function readRecipientHistory() {
  if (typeof window === "undefined") return [];

  const saved = window.localStorage.getItem(recipientHistoryStorageKey);

  if (!saved) return ["maria@example.com", "juridic@example.ro", "hr@example.ro"];

  try {
    const parsed = JSON.parse(saved) as string[];

    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    window.localStorage.removeItem(recipientHistoryStorageKey);
  }

  return [];
}

function writeRecipientHistory(recipients: string[]) {
  const current = readRecipientHistory();
  const next = Array.from(new Set([...recipients, ...current].map((email) => email.toLowerCase().trim()).filter(Boolean))).slice(0, 24);

  window.localStorage.setItem(recipientHistoryStorageKey, JSON.stringify(next));
}

function emailForContext(context: AccountContext) {
  if (context.id === "independent") return "";

  const slug = context.id
    .replace(/^primaria-/, "")
    .replace(/[^a-z0-9]+/gi, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();

  return `${slug || "institutie"}@institutie.docmanager.local`;
}

function todayLabel() {
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
}

function documentsStorageKey(contextId: string) {
  return `docmanager_documents_${contextId}`;
}

function readDocumentsForContext(contextId: string) {
  const saved = window.localStorage.getItem(documentsStorageKey(contextId));

  if (!saved) {
    return contextId === "independent" ? initialDocuments() : [];
  }

  try {
    const parsed = JSON.parse(saved) as StoredDocument[];

    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        category: item.category ?? item.type,
        size: item.size,
        storageName: item.storageName,
        uploadedAt: item.uploadedAt,
      }));
    }
  } catch {
    window.localStorage.removeItem(documentsStorageKey(contextId));
  }

  return contextId === "independent" ? initialDocuments() : [];
}

export function DocumentsManager() {
  const [items, setItems] = useState<StoredDocument[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Identitate");
  const [activeCategory, setActiveCategory] = useState("Toate");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
  const [isSingleSendFormOpen, setIsSingleSendFormOpen] = useState(false);
  const [isTemplateSendFormOpen, setIsTemplateSendFormOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [sentGroups, setSentGroups] = useState<PackageGroup[]>([]);
  const [packageTemplates, setPackageTemplates] = useState<PackageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [activeContextId, setActiveContextId] = useState("independent");
  const [activeContext, setActiveContext] = useState<AccountContext | null>(null);
  const [recipientHistory, setRecipientHistory] = useState<string[]>([]);
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<string[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [manualRecipientEmail, setManualRecipientEmail] = useState("");
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipDocumentPersistRef = useRef(false);

  useEffect(() => {
    const savedUser = window.localStorage.getItem("docmanager_user");

    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser) as PlatformUser);
      } catch {
        setCurrentUser(null);
      }
    }

    function syncDocumentsContext() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);
      const context = contexts.find((item) => item.id === contextId) ?? contexts[0] ?? null;

      skipDocumentPersistRef.current = true;
      setActiveContextId(contextId);
      setActiveContext(context);
      setSelectedRecipientEmails(context && context.id !== "independent" ? [emailForContext(context)] : []);
      setItems(readDocumentsForContext(contextId));
      const contextTemplates = readPackageTemplates(contextId);
      setPackageTemplates(contextTemplates);
      setSelectedTemplateId(contextTemplates[0]?.id ?? "");
      setSelectedIds([]);
      setActiveCategory("Toate");
      setCurrentPage(1);
    }

    syncDocumentsContext();
    setRecipientHistory(readRecipientHistory());
    window.addEventListener("storage", syncDocumentsContext);
    window.addEventListener("docmanager-account-context-change", syncDocumentsContext);

    return () => {
      window.removeEventListener("storage", syncDocumentsContext);
      window.removeEventListener("docmanager-account-context-change", syncDocumentsContext);
    };
  }, []);

  useEffect(() => {
    setSentGroups(readSentPackages(activeContextId));
  }, [activeContextId]);

  useEffect(() => {
    if (skipDocumentPersistRef.current) {
      skipDocumentPersistRef.current = false;
      return;
    }

    window.localStorage.setItem(documentsStorageKey(activeContextId), JSON.stringify(items));
  }, [activeContextId, items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byCategory = activeCategory === "Toate" ? items : items.filter((item) => item.category === activeCategory);

    if (!normalized) return byCategory;

    return byCategory.filter((item) =>
      [item.title, item.type, item.category, item.size].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [activeCategory, items, query]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));

    return ["Toate", ...categoryOptions].map((category) => ({
      category,
      count: category === "Toate" ? items.length : counts.get(category) ?? 0,
    }));
  }, [items]);

  const totalDocumentPages = Math.max(1, Math.ceil(filteredItems.length / documentsPerPage));
  const currentDocumentPage = Math.min(currentPage, totalDocumentPages);
  const paginatedItems = useMemo(() => {
    const start = (currentDocumentPage - 1) * documentsPerPage;

    return filteredItems.slice(start, start + documentsPerPage);
  }, [currentDocumentPage, filteredItems]);
  const documentRangeStart = filteredItems.length === 0 ? 0 : (currentDocumentPage - 1) * documentsPerPage + 1;
  const documentRangeEnd = Math.min(currentDocumentPage * documentsPerPage, filteredItems.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, query]);

  useEffect(() => {
    if (currentPage > totalDocumentPages) {
      setCurrentPage(totalDocumentPages);
    }
  }, [currentPage, totalDocumentPages]);

  const selectedTemplate = useMemo(
    () => packageTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [packageTemplates, selectedTemplateId],
  );

  const filteredTemplates = useMemo(() => {
    const normalized = templateSearchQuery.trim().toLowerCase();

    if (!normalized) return packageTemplates;

    return packageTemplates.filter((template) =>
      [
        template.name,
        template.createdAt,
        ...template.documents.flatMap((document) => [document.title, document.category]),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [packageTemplates, templateSearchQuery]);

  const recipientSuggestions = useMemo(() => {
    if (typeof window === "undefined") return [];

    const platformEmails = readPlatformUsers()
      .filter((platformUser) => platformUser.email && platformUser.email !== currentUser?.email)
      .map((platformUser) => platformUser.email.toLowerCase());
    const normalizedQuery = recipientQuery.trim().toLowerCase();
    const options = Array.from(new Set([...recipientHistory, ...platformEmails]));

    return options
      .filter((email) => !normalizedQuery || email.includes(normalizedQuery))
      .slice(0, 8);
  }, [currentUser?.email, recipientHistory, recipientQuery]);

  function toggleRecipient(email: string) {
    setSelectedRecipientEmails((current) =>
      current.includes(email)
        ? current.filter((item) => item !== email)
        : [...current, email],
    );
  }

  function addManualRecipient() {
    const emails = splitRecipients(manualRecipientEmail);

    if (emails.length === 0) {
      toast.info("Scrie cel putin un email valid pentru destinatar.");
      return;
    }

    setSelectedRecipientEmails((current) => Array.from(new Set([...current, ...emails])));
    setRecipientHistory((current) => Array.from(new Set([...emails, ...current])).slice(0, 24));
    writeRecipientHistory(emails);
    setManualRecipientEmail("");
    setRecipientQuery("");
  }

  function resetRecipientSelection() {
    if (activeContext && activeContext.id !== "independent") {
      setSelectedRecipientEmails([emailForContext(activeContext)]);
      return;
    }

    setSelectedRecipientEmails([]);
    setRecipientQuery("");
    setManualRecipientEmail("");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const uploadedAt = new Date().toISOString();
    const uploaded = await Promise.all(files.map(async (file, index) => {
      const serverDocument = await uploadDocumentToServer(file, selectedCategory, currentUser?.databaseId);

      if (serverDocument) return serverDocument;

      return {
        id: Date.now() + index + Math.floor(Math.random() * 100000),
        title: file.name.replace(/\.[^.]+$/, ""),
        type: selectedCategory,
        category: selectedCategory,
        size: formatBytes(file.size),
        storageName: buildStorageName(file.name, index),
        uploadedAt,
      };
    }));

    setItems((current) => [...uploaded, ...current]);
    toast.success(`${files.length === 1 ? "Document incarcat" : "Documente incarcate"} cu succes.`);
    input.value = "";
  }

  function handleCreatePackage() {
    if (selectedIds.length === 0) {
      toast.info("Selecteaza cel putin un document pentru pachet.");
      return;
    }

    resetRecipientSelection();
    setIsPackageFormOpen(true);
  }

  function handleSendSingleDocument() {
    if (selectedIds.length !== 1) {
      toast.info("Selecteaza un singur document pentru trimitere individuala.");
      return;
    }

    resetRecipientSelection();
    setIsSingleSendFormOpen(true);
    setIsPackageFormOpen(false);
  }

  function handleSendTemplate() {
    if (!selectedTemplateId) {
      toast.info("Alege un pachet reutilizabil pentru trimitere.");
      return;
    }

    resetRecipientSelection();
    setIsTemplateSendFormOpen(true);
    setIsPackageFormOpen(false);
    setIsSingleSendFormOpen(false);
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function savePackageTemplate(name: string, documents: StoredDocument[]) {
    const template: PackageTemplate = {
      id: `${Date.now()}`,
      name,
      documents: documents.map(({ id, title, category }) => ({ id, title, category })),
      createdAt: todayLabel(),
    };
    const nextTemplates = [template, ...packageTemplates];

    setPackageTemplates(nextTemplates);
    setSelectedTemplateId(template.id);
    writePackageTemplates(nextTemplates, activeContextId);
  }

  function addSelectedDocumentsToTemplate() {
    if (!selectedTemplateId) {
      toast.info("Alege mai intai un sablon.");
      setIsTemplatePickerOpen(true);
      return;
    }

    const selectedDocuments = items.filter((item) => selectedIds.includes(item.id));

    if (selectedDocuments.length === 0) {
      toast.info("Bifeaza documentele din lista de mai jos, apoi revino la sablon.");
      document.querySelector(".document-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const nextTemplates = packageTemplates.map((template) => {
      if (template.id !== selectedTemplateId) return template;

      const existingIds = new Set(template.documents.map((document) => document.id));
      const documentsToAdd = selectedDocuments
        .filter((document) => !existingIds.has(document.id))
        .map(({ id, title, category }) => ({ id, title, category }));

      return {
        ...template,
        documents: [...template.documents, ...documentsToAdd],
      };
    });

    const addedCount = nextTemplates.find((template) => template.id === selectedTemplateId)?.documents.length ?? 0;
    const previousCount = packageTemplates.find((template) => template.id === selectedTemplateId)?.documents.length ?? 0;

    if (addedCount === previousCount) {
      toast.info("Documentele selectate exista deja in acest sablon.");
      return;
    }

    setPackageTemplates(nextTemplates);
    writePackageTemplates(nextTemplates, activeContextId);
    toast.success(`${addedCount - previousCount} document${addedCount - previousCount === 1 ? "" : "e"} adaugat${addedCount - previousCount === 1 ? "" : "e"} in sablon.`);
  }

  function saveOutgoingPackages(
    recipients: string[],
    packagePayload: PackageGroup["packages"][number],
    accountIdentifier = "",
  ) {
    const saved = window.localStorage.getItem(sentPackagesStorageKey(activeContextId));
    const currentPackages = saved ? JSON.parse(saved) : [];
    const receivedSaved = window.localStorage.getItem(receivedPackagesStorageKey(activeContextId));
    const currentReceivedPackages = receivedSaved ? JSON.parse(receivedSaved) : [];
    const nextPackages = [
      ...recipients.map((email) => ({
        to: email.split("@")[0],
        email,
        accountIdentifier: accountIdentifier || undefined,
        packages: [packagePayload],
      })),
      ...currentPackages,
    ];
    const nextReceivedPackages = [
      ...recipients.map(() => ({
        from: "Contul meu",
        email: "expeditor@docmanager.local",
        packages: [packagePayload],
      })),
      ...currentReceivedPackages,
    ];

    writeSentPackages(nextPackages, activeContextId);
    writeReceivedPackages(nextReceivedPackages, activeContextId);
    setSentGroups(readSentPackages(activeContextId));
  }

  function validateInstitutionRecipients(recipients: string[]) {
    if (currentUser?.accountType !== "institution") {
      return true;
    }

    const platformUsers = readPlatformUsers();
    const persons = readTaxpayerPersons();
    const companies = readTaxpayerCompanies();
    const institutionIds = currentUser.linkedInstitutionIds;
    const invalid = recipients.filter((email) => {
      const recipient = platformUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());

      if (!recipient) {
        return true;
      }

      if (recipient.accountType === "individual" && recipient.cnp) {
        return !persons.some((person) =>
          person.cnp === recipient.cnp &&
          person.status === "legat" &&
          institutionIds.includes(person.institutionId),
        );
      }

      if (recipient.accountType === "company" && recipient.cif) {
        return !companies.some((company) =>
          company.cif.replace(/^RO/i, "") === recipient.cif?.replace(/^RO/i, "") &&
          company.status === "legat" &&
          institutionIds.includes(company.institutionId),
        );
      }

      return true;
    });

    if (invalid.length > 0) {
      toast.error(`Institutia poate trimite doar catre conturi existente si legate in baza proprie dupa CNP/CIF. Verifica: ${invalid.join(", ")}.`);
      return false;
    }

    return true;
  }

  function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("packageName") ?? "").trim();
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? "") || selectedRecipientEmails.join(","));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const selectedDocuments = items.filter((item) => selectedIds.includes(item.id));

    if (!name || recipients.length === 0 || selectedDocuments.length === 0) {
      toast.info("Completeaza numele pachetului, cel putin un destinatar si selecteaza documentele.");
      return;
    }

    if (!validateInstitutionRecipients(recipients)) return;

    const packagePayload = {
      name,
      date: todayLabel(),
      purpose,
      documents: selectedDocuments.map((item, index) => ({
        id: createPackageDocumentId(item.id, index),
        title: item.title,
        category: item.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
      })),
      status: purpose === "signature" ? "Asteapta sa fie semnate" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    writeRecipientHistory(recipients);
    setRecipientHistory(readRecipientHistory());
    savePackageTemplate(name, selectedDocuments);
    setSelectedIds([]);
    setIsPackageFormOpen(false);
    toast.success(`Pachetul "${name}" a fost salvat si trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  function handleSingleSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? "") || selectedRecipientEmails.join(","));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const selectedDocument = items.find((item) => selectedIds.includes(item.id));

    if (recipients.length === 0 || !selectedDocument) {
      toast.info("Completeaza cel putin un destinatar si selecteaza un document.");
      return;
    }

    if (!validateInstitutionRecipients(recipients)) return;

    const packagePayload = {
      name: selectedDocument.title,
      date: todayLabel(),
      purpose,
      singleDocument: true,
      documents: [{
        id: createPackageDocumentId(selectedDocument.id),
        title: selectedDocument.title,
        category: selectedDocument.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
        sentAsSingle: true,
      }],
      status: purpose === "signature" ? "Asteapta sa fie semnat" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    writeRecipientHistory(recipients);
    setRecipientHistory(readRecipientHistory());
    setSelectedIds([]);
    setIsSingleSendFormOpen(false);
    toast.success(`Documentul "${selectedDocument.title}" a fost trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  function handleTemplateSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? "") || selectedRecipientEmails.join(","));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const template = packageTemplates.find((item) => item.id === selectedTemplateId);

    if (!template || recipients.length === 0) {
      toast.info("Alege pachetul reutilizabil si cel putin un destinatar.");
      return;
    }

    if (!validateInstitutionRecipients(recipients)) return;

    const packagePayload = {
      name: template.name,
      date: todayLabel(),
      purpose,
      documents: template.documents.map((item, index) => ({
        id: createPackageDocumentId(item.id, index),
        title: item.title,
        category: item.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
      })),
      status: purpose === "signature" ? "Asteapta sa fie semnate" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    writeRecipientHistory(recipients);
    setRecipientHistory(readRecipientHistory());
    setIsTemplateSendFormOpen(false);
    toast.success(`Pachetul reutilizabil "${template.name}" a fost trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  function RecipientPicker() {
    const isInstitutionContext = Boolean(activeContext && activeContext.id !== "independent");
    const institutionEmail = activeContext ? emailForContext(activeContext) : "";

    return (
      <div className="recipient-picker">
        <input type="hidden" name="recipientEmails" value={selectedRecipientEmails.join(",")} />
        {isInstitutionContext ? (
          <div className="institution-recipient-card">
            <span><Building2 size={20} /></span>
            <div>
              <strong>{activeContext?.name}</strong>
              <p>{activeContext?.locality ?? "Institutia curenta"} · {activeContext?.identifier ?? institutionEmail}</p>
            </div>
            <em><Check size={15} /> Selectata</em>
          </div>
        ) : (
          <>
            <div className="recipient-search-row">
              <label>Cauta in istoric sau utilizatori
                <span className="recipient-search-input">
                  <Search size={16} />
                  <input value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Scrie pentru filtrare: email, nume sau domeniu" />
                </span>
              </label>
              <label>Adauga manual
                <span className="recipient-manual-input">
                  <Mail size={16} />
                  <input value={manualRecipientEmail} onChange={(event) => setManualRecipientEmail(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addManualRecipient();
                    }
                  }} placeholder="email@domeniu.ro" />
                  <button type="button" onClick={addManualRecipient}>Adauga</button>
                </span>
              </label>
            </div>
            <div className="recipient-choice-list">
              {recipientSuggestions.length === 0 ? (
                <div className="recipient-empty">
                  <UsersRound size={18} />
                  <span>Nu ai istoric pentru cautarea curenta. Introdu emailul manual si apasa Adauga.</span>
                </div>
              ) : recipientSuggestions.map((email) => (
                <label className="recipient-choice" key={email}>
                  <input checked={selectedRecipientEmails.includes(email)} type="checkbox" onChange={() => toggleRecipient(email)} />
                  <span>
                    <strong>{email.split("@")[0]}</strong>
                    <small>{email}</small>
                  </span>
                </label>
              ))}
            </div>
            {selectedRecipientEmails.length > 0 && (
              <div className="recipient-selected-strip">
                {selectedRecipientEmails.map((email) => (
                  <span key={email}>{email}<button type="button" aria-label={`Sterge ${email}`} onClick={() => toggleRecipient(email)}><X size={13} /></button></span>
                ))}
              </div>
            )}
          </>
        )}
        <label className="account-identifier-field">Identificator cont
          <input name="accountIdentifier" placeholder="Cod cont optional" />
        </label>
      </div>
    );
  }

  return (
    <>
      <section className="page-head documents-page-head">
        <div className="documents-title-line">
          <p className="eyebrow">Biblioteca</p>
          <div>
            <h1>Documentele mele</h1>
            <p className="selected-counter"><span /> {selectedIds.length} documente selectate</p>
          </div>
        </div>
      </section>

      {currentUser?.accountType === "institution" && (
        <section className="institution-rule-card">
          <ShieldCheck size={24} />
          <div>
            <strong>Regula pentru institutii</strong>
            <p>Poti trimite documente doar catre persoane fizice sau juridice care au cont si exista in baza institutiei tale, legate dupa CNP/CIF.</p>
          </div>
        </section>
      )}

      <section className="document-action-board" aria-label="Actiuni documente si sabloane">
        <article className="template-library action-card action-card-template" aria-label="Sabloane de pachete">
          <div className="action-card-glow" />
          <div className="template-library-head">
            <div>
              <p className="eyebrow">Sabloane</p>
              <h2>Pachete reutilizabile</h2>
              <p>Selecteaza un pachet salvat si trimite-l rapid catre unul sau mai multi destinatari.</p>
            </div>
            <div className="template-card-actions">
              <button className="action-pill action-pill-violet" type="button" onClick={handleSendTemplate} disabled={!selectedTemplateId}>
                <Send size={18} /> Trimite sablon
              </button>
              <Link className="action-pill action-pill-ghost" href="/documents/templates">Vezi lista sabloane</Link>
            </div>
          </div>
          {packageTemplates.length === 0 ? (
            <div className="template-empty">
              <Archive size={22} />
              <div>
                <strong>Nu ai inca sabloane salvate</strong>
                <p>Selecteaza documentele dorite si apasa Creeaza pachet. Pachetul creat ramane aici ca sablon reutilizabil.</p>
              </div>
            </div>
          ) : (
            <div className="template-picker-grid">
              <div className="template-selected-card">
                <span><Archive size={19} /></span>
                <div>
                  <small>Sablon selectat</small>
                  <strong>{selectedTemplate?.name ?? "Alege sablon"}</strong>
                  <p>{selectedTemplate ? `${selectedTemplate.documents.length} documente · creat la ${selectedTemplate.createdAt}` : "Deschide lista si alege un pachet reutilizabil"}</p>
                </div>
                <button type="button" onClick={() => setIsTemplatePickerOpen(true)}>Alege</button>
              </div>
              <div className="template-doc-preview">
                {selectedTemplate?.documents.slice(0, 4).map((document) => (
                  <span key={document.id}><FileText size={15} /> {document.title}</span>
                ))}
                {(selectedTemplate?.documents.length ?? 0) > 4 && <em>+{(selectedTemplate?.documents.length ?? 0) - 4} documente</em>}
                <button type="button" onClick={addSelectedDocumentsToTemplate}>+ Adauga document</button>
              </div>
            </div>
          )}
        </article>

        <article className="action-card action-card-documents">
          <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={handleUpload} />
          <div className="action-card-glow" />
          <div>
            <p className="eyebrow">Actiuni rapide</p>
            <h2>Lucreaza cu documente</h2>
            <p>Incarca fisiere, trimite un document individual sau creeaza un pachet nou din selectia curenta.</p>
          </div>
          <div className="document-actions">
            <button className="action-button upload-action" type="button" onClick={() => fileInputRef.current?.click()}>
              <Plus size={20} /> <span>Incarca</span>
            </button>
            <button className="action-button send-action" type="button" onClick={handleSendSingleDocument} disabled={selectedIds.length !== 1}>
              <Send size={20} /> <span>Trimite document</span>
            </button>
            <button className="action-button create-package-action" type="button" onClick={handleCreatePackage}>
              <Send size={20} /> <span>Creeaza pachet</span>
            </button>
          </div>
        </article>
      </section>

      {isPackageFormOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Creeaza pachet">
          <form className="modal-panel package-modal-form" onSubmit={handlePackageSubmit}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">Pachet nou</p>
                <h2>Creeaza pachet</h2>
                <p>{selectedIds.length} documente selectate</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide formularul" onClick={() => setIsPackageFormOpen(false)}><X size={18} /></button>
            </header>
            <div className="wizard-steps">
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>1</span>
                  <div>
                    <h3>Documente si pachet</h3>
                    <p>Pachetul ramane salvat in cont si il poti retrimite ulterior.</p>
                  </div>
                </div>
                <label>Nume pachet<input name="packageName" placeholder="Dosar angajare" required /></label>
                <div className="selected-doc-list">
                  {items.filter((item) => selectedIds.includes(item.id)).map((item) => (
                    <span key={item.id}><FileText size={16} /> {item.title}<small>{item.category}</small></span>
                  ))}
                </div>
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>2</span>
                  <div>
                    <h3>Destinatari</h3>
                    <p>Poti adauga mai multe emailuri separate prin virgula sau rand nou.</p>
                  </div>
                </div>
                <RecipientPicker />
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>3</span>
                  <div>
                    <h3>Scopul trimiterii</h3>
                    <p>Statusurile se actualizeaza separat pe pachet si pe document.</p>
                  </div>
                </div>
                <div className="purpose-grid">
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="signature" defaultChecked />
                    <strong>Solicita semnare</strong>
                    <span>Destinatarul descarca documentele si incarca PDF-urile semnate.</span>
                  </label>
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="send" />
                    <strong>Doar trimitere</strong>
                    <span>Statusul se finalizeaza dupa confirmarea primirii.</span>
                  </label>
                </div>
              </section>
            </div>
            <div className="modal-actions">
              <button className="primary-button" type="submit">Creeaza si trimite</button>
              <button className="secondary-button" type="button" onClick={() => setIsPackageFormOpen(false)}>Anuleaza</button>
            </div>
          </form>
        </section>
      )}

      {isSingleSendFormOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Trimite document">
          <form className="modal-panel package-modal-form" onSubmit={handleSingleSendSubmit}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">Document individual</p>
                <h2>Trimite document</h2>
                <p>{items.find((item) => selectedIds.includes(item.id))?.title}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide formularul" onClick={() => setIsSingleSendFormOpen(false)}><X size={18} /></button>
            </header>
            <div className="wizard-steps">
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>1</span>
                  <div>
                    <h3>Document trimis</h3>
                    <p>Documentul pleaca individual, fara sa creezi manual un pachet.</p>
                  </div>
                </div>
                <div className="selected-doc-list">
                  {items.filter((item) => selectedIds.includes(item.id)).map((item) => (
                    <span key={item.id}><FileText size={16} /> {item.title}<small>{item.category}</small></span>
                  ))}
                </div>
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>2</span>
                  <div>
                    <h3>Destinatari</h3>
                    <p>Trimite acelasi document catre unul sau mai multe conturi.</p>
                  </div>
                </div>
                <RecipientPicker />
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>3</span>
                  <div>
                    <h3>Scopul trimiterii</h3>
                    <p>Alege daca destinatarul trebuie sa incarce inapoi document semnat.</p>
                  </div>
                </div>
                <div className="purpose-grid">
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="signature" defaultChecked />
                    <strong>Solicita semnare</strong>
                    <span>Status galben pana la incarcare PDF semnat.</span>
                  </label>
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="send" />
                    <strong>Doar trimitere</strong>
                    <span>Status albastru pana la confirmarea primirii.</span>
                  </label>
                </div>
              </section>
            </div>
            <div className="modal-actions">
              <button className="primary-button" type="submit">Trimite</button>
              <button className="secondary-button" type="button" onClick={() => setIsSingleSendFormOpen(false)}>Anuleaza</button>
            </div>
          </form>
        </section>
      )}

      {isTemplateSendFormOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Trimite pachet salvat">
          <form className="modal-panel package-modal-form" onSubmit={handleTemplateSendSubmit}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">Pachet reutilizabil</p>
                <h2>Trimite pachet salvat</h2>
                <p>{packageTemplates.find((item) => item.id === selectedTemplateId)?.name}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide formularul" onClick={() => setIsTemplateSendFormOpen(false)}><X size={18} /></button>
            </header>
            <div className="wizard-steps">
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>1</span>
                  <div>
                    <h3>Pachet selectat</h3>
                    <p>Alegi un pachet salvat in cont si creezi o trimitere noua in istoric.</p>
                  </div>
                </div>
                <label>Pachet reutilizabil
                  <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                    {packageTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name} ({template.documents.length} documente)</option>
                    ))}
                  </select>
                </label>
                <div className="selected-doc-list">
                  {packageTemplates.find((item) => item.id === selectedTemplateId)?.documents.map((item) => (
                    <span key={item.id}><FileText size={16} /> {item.title}<small>{item.category}</small></span>
                  ))}
                </div>
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>2</span>
                  <div>
                    <h3>Destinatari</h3>
                    <p>Poti trimite pachetul salvat catre mai multe conturi simultan.</p>
                  </div>
                </div>
                <RecipientPicker />
              </section>
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <span>3</span>
                  <div>
                    <h3>Scopul trimiterii</h3>
                    <p>Pachetul ramane reutilizabil si dupa aceasta trimitere.</p>
                  </div>
                </div>
                <div className="purpose-grid">
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="signature" defaultChecked />
                    <strong>Solicita semnare</strong>
                    <span>Urmaresti raspunsul semnat pentru fiecare document.</span>
                  </label>
                  <label className="purpose-card">
                    <input type="radio" name="purpose" value="send" />
                    <strong>Doar trimitere</strong>
                    <span>Destinatarul confirma primirea documentelor.</span>
                  </label>
                </div>
              </section>
            </div>
            <div className="modal-actions">
              <button className="primary-button" type="submit">Trimite pachetul</button>
              <button className="secondary-button" type="button" onClick={() => setIsTemplateSendFormOpen(false)}>Anuleaza</button>
            </div>
          </form>
        </section>
      )}

      {isTemplatePickerOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Alege sablon">
          <div className="modal-panel template-picker-modal">
            <header className="modal-head">
              <div>
                <p className="eyebrow">Sabloane salvate</p>
                <h2>Alege pachet reutilizabil</h2>
                <p>Selecteaza un sablon pentru trimitere rapida sau pentru adaugarea documentelor bifate.</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide selectorul" onClick={() => setIsTemplatePickerOpen(false)}><X size={18} /></button>
            </header>
            <label className="template-picker-search">
              <Search size={17} />
              <input value={templateSearchQuery} onChange={(event) => setTemplateSearchQuery(event.target.value)} placeholder="Cauta dupa nume sablon, document sau folder" />
            </label>
            <div className="template-picker-list">
              {filteredTemplates.length === 0 ? (
                <div className="template-picker-empty">
                  <Archive size={24} />
                  <strong>Nu am gasit sabloane</strong>
                  <p>Schimba termenul de cautare sau creeaza un sablon nou din documentele selectate.</p>
                </div>
              ) : filteredTemplates.map((template) => {
                const isSelected = template.id === selectedTemplateId;

                return (
                  <button className={`template-picker-option ${isSelected ? "selected" : ""}`} type="button" key={template.id} onClick={() => {
                    setSelectedTemplateId(template.id);
                    setIsTemplatePickerOpen(false);
                    setTemplateSearchQuery("");
                  }}>
                    <span className="template-picker-icon"><Archive size={19} /></span>
                    <span>
                      <strong>{template.name}</strong>
                      <small>{template.documents.length} documente · creat la {template.createdAt}</small>
                      <em>{template.documents.slice(0, 3).map((document) => document.title).join(", ")}</em>
                    </span>
                    {isSelected && <i><Check size={15} /></i>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="document-filter-bar panel">
        <label className="compact-select search-filter">Cautare
          <span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nume, folder sau marime" /></span>
        </label>
        <label className="compact-select">Folder
          <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
            {categories.map(({ category, count }) => <option key={category} value={category}>{category} ({count})</option>)}
          </select>
        </label>
        <label className="compact-select">Folder incarcare
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            {categoryOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </section>

      {filteredItems.length === 0 ? (
        <section className="empty-state">
          <UploadCloud size={34} />
          <h2>Nu am gasit documente</h2>
          <p>Schimba termenul de cautare sau incarca un document nou.</p>
        </section>
      ) : (
        <section className="document-list panel">
          <div className="document-list-head">
            <span>Document</span>
            <span>Folder</span>
            <span>Marime</span>
            <span>Selectie</span>
          </div>
          {paginatedItems.map((doc) => {
            const Icon = iconForType(doc.type);

            return (
              <article className="document-row" key={doc.id}>
                <div className="document-main-cell">
                  <Icon size={24} />
                  <div>
                    <h2>{doc.title}</h2>
                    <p>{doc.type}</p>
                  </div>
                </div>
                <span className="folder-chip"><Archive size={15} /> {doc.category}</span>
                <span className="muted">{doc.size}</span>
                <label className="select-document icon-select">
                  <input checked={selectedIds.includes(doc.id)} type="checkbox" onChange={() => toggleSelected(doc.id)} />
                  Selecteaza
                </label>
              </article>
            );
          })}
          <footer className="document-list-footer">
            <span>Afisare {documentRangeStart}-{documentRangeEnd} din {filteredItems.length} documente</span>
            <div className="pagination">
              <button
                type="button"
                aria-label="Pagina anterioara"
                disabled={currentDocumentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: totalDocumentPages }, (_, index) => index + 1).map((page) => (
                <button
                  className={page === currentDocumentPage ? "active" : ""}
                  type="button"
                  key={page}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                aria-label="Pagina urmatoare"
                disabled={currentDocumentPage === totalDocumentPages}
                onClick={() => setCurrentPage((page) => Math.min(totalDocumentPages, page + 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </section>
      )}

      <section className="recent-packages">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Pachete</p>
            <h2>Pachete trimise recent</h2>
          </div>
          <Link className="secondary-button" href="/documents/sent">Vezi toate</Link>
        </div>
        {sentGroups.length === 0 ? (
          <article className="empty-state compact">
            <Send size={30} />
            <h2>Nu ai pachete create</h2>
            <p>Selecteaza documente si apasa Creeaza pachet.</p>
          </article>
        ) : (
          <div className="package-groups compact-list">
            {sentGroups.slice(0, 3).map((group, index) => (
              <article className="panel" key={`${group.email}-${index}`}>
                <div className="group-title">
                  <Send size={22} />
                  <div>
                    <h2>{group.to}</h2>
                    <p>{group.email}</p>
                  </div>
                </div>
                {group.packages.map((pkg) => (
                  <div className="package-detail" key={pkg.name}>
                    <div>
                      <strong>{pkg.name}</strong>
                      <p>{pkg.date} · {pkg.documents.map((document) => typeof document === "string" ? document : document.title).join(", ")}</p>
                    </div>
                    <span className={`status-chip ${statusTone(pkg.status)}`}>{pkg.status}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
