"use client";

import { readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import { PackageTemplate, readPackageTemplates, writePackageTemplates } from "@/lib/packageTemplates";
import { Archive, FileText, Search, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function TemplatesManager() {
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<PackageTemplate | null>(null);
  const [activeContextId, setActiveContextId] = useState("independent");
  const [activeContextName, setActiveContextName] = useState("Activitate independenta");

  useEffect(() => {
    function syncTemplatesContext() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);
      const context = contexts.find((item) => item.id === contextId);

      setActiveContextId(contextId);
      setActiveContextName(context?.name ?? "Activitate independenta");
      setTemplates(readPackageTemplates(contextId));
      setTemplateToDelete(null);
    }

    syncTemplatesContext();
    window.addEventListener("storage", syncTemplatesContext);
    window.addEventListener("docmanager-account-context-change", syncTemplatesContext);

    return () => {
      window.removeEventListener("storage", syncTemplatesContext);
      window.removeEventListener("docmanager-account-context-change", syncTemplatesContext);
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return templates;

    return templates.filter((template) =>
      [
        template.name,
        template.createdAt,
        ...template.documents.flatMap((document) => [document.title, document.category]),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, templates]);

  function removeTemplate(template: PackageTemplate) {
    const nextTemplates = templates.filter((item) => item.id !== template.id);

    setTemplates(nextTemplates);
    writePackageTemplates(nextTemplates, activeContextId);
    setTemplateToDelete(null);
    toast.success(`Sablonul "${template.name}" a fost sters cu succes.`);
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Sabloane</p>
          <h1>Pachete reutilizabile</h1>
          <p className="muted">Listezi pachetele folosite frecvent pentru {activeContextName} si documentele incluse in fiecare.</p>
        </div>
        <Link className="primary-button" href="/documents">
          <Send size={18} /> Creeaza sablon din documente
        </Link>
      </section>

      <section className="document-filter-bar panel">
        <label className="compact-select search-filter">Cautare sablon
          <span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nume sablon, document sau folder" /></span>
        </label>
      </section>

      {filteredTemplates.length === 0 ? (
        <section className="empty-state">
          <Archive size={34} />
          <h2>Nu ai sabloane salvate</h2>
          <p>Selecteaza documente din biblioteca si creeaza un pachet. Il vei vedea aici ca sablon reutilizabil.</p>
        </section>
      ) : (
        <section className="templates-list">
          {filteredTemplates.map((template) => (
            <article className="panel template-list-card" key={template.id}>
              <div className="template-card-head">
                <div>
                  <p className="eyebrow">Sablon pachet</p>
                  <h2>{template.name}</h2>
                  <p>{template.documents.length} documente · creat la {template.createdAt}</p>
                </div>
                <div className="template-card-actions">
                  <Link className="secondary-button" href="/documents">Trimite</Link>
                  <button className="icon-button danger" type="button" aria-label={`Sterge ${template.name}`} onClick={() => setTemplateToDelete(template)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="template-doc-section">
                <div className="template-doc-section-head">
                  <span>Documente incluse</span>
                  <strong>{template.documents.length}</strong>
                </div>
                <div className="template-doc-table">
                  {template.documents.map((document) => (
                    <div key={document.id}>
                      <FileText size={17} />
                      <strong>{document.title}</strong>
                      <span>{document.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {templateToDelete && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Sterge sablonul ${templateToDelete.name}`}>
          <div className="modal-panel confirm-modal">
            <div className="confirm-icon danger">
              <Trash2 size={24} />
            </div>
            <div>
              <p className="eyebrow">Confirmare stergere</p>
              <h2>Stergi sablonul?</h2>
              <p className="muted">Sablonul "{templateToDelete.name}" contine {templateToDelete.documents.length} documente. Documentele originale raman in biblioteca, se sterge doar pachetul reutilizabil.</p>
            </div>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setTemplateToDelete(null)}>
                Anuleaza
              </button>
              <button className="primary-button danger-confirm" type="button" onClick={() => removeTemplate(templateToDelete)}>
                Sterge sablon
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
