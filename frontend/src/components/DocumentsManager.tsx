"use client";

import { documents as seedDocuments } from "@/lib/data";
import { PackageTemplate, readPackageTemplates, writePackageTemplates } from "@/lib/packageTemplates";
import { PackageGroup, PackagePurpose, readSentPackages, statusTone, writeReceivedPackages } from "@/lib/packages";
import { Archive, FileCheck, FileText, IdCard, Plus, Search, Send, ShieldCheck, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type StoredDocument = {
  id: number;
  title: string;
  type: string;
  category: string;
  size: string;
};

const categoryOptions = ["Identitate", "HR", "Civil", "Contracte", "Medical", "Financiar", "Altul"];

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

function todayLabel() {
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
}

export function DocumentsManager() {
  const [items, setItems] = useState<StoredDocument[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Identitate");
  const [activeCategory, setActiveCategory] = useState("Toate");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
  const [isSingleSendFormOpen, setIsSingleSendFormOpen] = useState(false);
  const [isTemplateSendFormOpen, setIsTemplateSendFormOpen] = useState(false);
  const [sentGroups, setSentGroups] = useState<PackageGroup[]>([]);
  const [packageTemplates, setPackageTemplates] = useState<PackageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("docmanager_documents");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as StoredDocument[];
      if (Array.isArray(parsed)) {
        setItems(parsed.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          category: item.category ?? item.type,
          size: item.size,
        })));
      }
    } catch {
      window.localStorage.removeItem("docmanager_documents");
    }
  }, []);

  useEffect(() => {
    setSentGroups(readSentPackages());
  }, []);

  useEffect(() => {
    const templates = readPackageTemplates();
    setPackageTemplates(templates);
    setSelectedTemplateId(templates[0]?.id ?? "");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("docmanager_documents", JSON.stringify(items));
  }, [items]);

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

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const uploaded = files.map((file, index) => ({
      id: Date.now() + index,
      title: file.name.replace(/\.[^.]+$/, ""),
      type: selectedCategory,
      category: selectedCategory,
      size: formatBytes(file.size),
    }));

    setItems((current) => [...uploaded, ...current]);
    setMessage(`${files.length === 1 ? "Document incarcat" : "Documente incarcate"} cu succes.`);
    event.target.value = "";
  }

  function handleCreatePackage() {
    if (selectedIds.length === 0) {
      setMessage("Selecteaza cel putin un document pentru pachet.");
      return;
    }

    setIsPackageFormOpen(true);
    setMessage(null);
  }

  function handleSendSingleDocument() {
    if (selectedIds.length !== 1) {
      setMessage("Selecteaza un singur document pentru trimitere individuala.");
      return;
    }

    setIsSingleSendFormOpen(true);
    setIsPackageFormOpen(false);
    setMessage(null);
  }

  function handleSendTemplate() {
    if (!selectedTemplateId) {
      setMessage("Alege un pachet reutilizabil pentru trimitere.");
      return;
    }

    setIsTemplateSendFormOpen(true);
    setIsPackageFormOpen(false);
    setIsSingleSendFormOpen(false);
    setMessage(null);
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
    writePackageTemplates(nextTemplates);
  }

  function saveOutgoingPackages(
    recipients: string[],
    packagePayload: PackageGroup["packages"][number],
    accountIdentifier = "",
  ) {
    const saved = window.localStorage.getItem("docmanager_sent_packages");
    const currentPackages = saved ? JSON.parse(saved) : [];
    const receivedSaved = window.localStorage.getItem("docmanager_received_packages");
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

    window.localStorage.setItem("docmanager_sent_packages", JSON.stringify(nextPackages));
    writeReceivedPackages(nextReceivedPackages);
    setSentGroups(readSentPackages());
  }

  function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("packageName") ?? "").trim();
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? ""));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const selectedDocuments = items.filter((item) => selectedIds.includes(item.id));

    if (!name || recipients.length === 0 || selectedDocuments.length === 0) {
      setMessage("Completeaza numele pachetului, cel putin un destinatar si selecteaza documentele.");
      return;
    }

    const packagePayload = {
      name,
      date: todayLabel(),
      purpose,
      documents: selectedDocuments.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
      })),
      status: purpose === "signature" ? "Asteapta sa fie semnate" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    savePackageTemplate(name, selectedDocuments);
    setSelectedIds([]);
    setIsPackageFormOpen(false);
    setMessage(`Pachetul "${name}" a fost salvat si trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  function handleSingleSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? ""));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const selectedDocument = items.find((item) => selectedIds.includes(item.id));

    if (recipients.length === 0 || !selectedDocument) {
      setMessage("Completeaza cel putin un destinatar si selecteaza un document.");
      return;
    }

    const packagePayload = {
      name: selectedDocument.title,
      date: todayLabel(),
      purpose,
      singleDocument: true,
      documents: [{
        id: selectedDocument.id,
        title: selectedDocument.title,
        category: selectedDocument.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
        sentAsSingle: true,
      }],
      status: purpose === "signature" ? "Asteapta sa fie semnat" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    setSelectedIds([]);
    setIsSingleSendFormOpen(false);
    setMessage(`Documentul "${selectedDocument.title}" a fost trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  function handleTemplateSendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipients = splitRecipients(String(form.get("recipientEmails") ?? ""));
    const accountIdentifier = String(form.get("accountIdentifier") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "signature") as PackagePurpose;
    const template = packageTemplates.find((item) => item.id === selectedTemplateId);

    if (!template || recipients.length === 0) {
      setMessage("Alege pachetul reutilizabil si cel putin un destinatar.");
      return;
    }

    const packagePayload = {
      name: template.name,
      date: todayLabel(),
      purpose,
      documents: template.documents.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
      })),
      status: purpose === "signature" ? "Asteapta sa fie semnate" : "Trimis - asteapta confirmare primire",
    };

    saveOutgoingPackages(recipients, packagePayload, accountIdentifier);
    setIsTemplateSendFormOpen(false);
    setMessage(`Pachetul reutilizabil "${template.name}" a fost trimis catre ${recipients.length} destinatar${recipients.length === 1 ? "" : "i"}.`);
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Documentele mele</h1>
          <p className="muted">{selectedIds.length} documente selectate</p>
        </div>
        <div className="document-actions">
          <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={handleUpload} />
          <button className="icon-text-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <Plus size={18} /> Incarca
          </button>
          <button className="icon-text-button" type="button" onClick={handleSendSingleDocument} disabled={selectedIds.length !== 1}>
            <Send size={18} /> Trimite document
          </button>
          <button className="primary-button" type="button" onClick={handleCreatePackage}>
            <Send size={18} /> Creeaza pachet
          </button>
        </div>
      </section>

      {message && <p className="inline-alert">{message}</p>}

      <section className="template-library panel" aria-label="Sabloane de pachete">
        <div className="template-library-head">
          <div>
            <p className="eyebrow">Sabloane</p>
            <h2>Pachete reutilizabile</h2>
            <p>Selecteaza un pachet salvat si trimite-l rapid catre unul sau mai multi destinatari.</p>
          </div>
          <button className="icon-text-button" type="button" onClick={handleSendTemplate} disabled={!selectedTemplateId}>
            <Send size={18} /> Trimite sablon
          </button>
          <Link className="secondary-button" href="/documents/templates">Vezi lista sabloane</Link>
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
            <label className="compact-select reusable-package-select">Alege sablon
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                {packageTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name} ({template.documents.length} documente)</option>
                ))}
              </select>
            </label>
            <div className="template-doc-preview">
              {packageTemplates.find((template) => template.id === selectedTemplateId)?.documents.slice(0, 4).map((document) => (
                <span key={document.id}><FileText size={15} /> {document.title}</span>
              ))}
            </div>
          </div>
        )}
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
                <div className="form-grid two">
                  <label>Emailuri destinatari<textarea name="recipientEmails" placeholder={"maria@example.com\njuridic@example.ro"} required /></label>
                  <label>Identificator cont<input name="accountIdentifier" placeholder="Cod cont optional" /></label>
                </div>
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
                <div className="form-grid two">
                  <label>Emailuri destinatari<textarea name="recipientEmails" placeholder={"destinatar@example.com\ncontabil@example.ro"} required /></label>
                  <label>Identificator cont<input name="accountIdentifier" placeholder="Cod cont optional" /></label>
                </div>
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
                <div className="form-grid two">
                  <label>Emailuri destinatari<textarea name="recipientEmails" placeholder={"hr@example.ro\npartener@example.com"} required /></label>
                  <label>Identificator cont<input name="accountIdentifier" placeholder="Cod cont optional" /></label>
                </div>
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
          {filteredItems.map((doc) => {
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
