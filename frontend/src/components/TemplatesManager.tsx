"use client";

import { PackageTemplate, readPackageTemplates, writePackageTemplates } from "@/lib/packageTemplates";
import { Archive, FileText, Search, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export function TemplatesManager() {
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTemplates(readPackageTemplates());
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

  function removeTemplate(id: string) {
    const nextTemplates = templates.filter((template) => template.id !== id);

    setTemplates(nextTemplates);
    writePackageTemplates(nextTemplates);
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Sabloane</p>
          <h1>Pachete reutilizabile</h1>
          <p className="muted">Listezi pachetele folosite frecvent si documentele incluse in fiecare.</p>
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
                  <button className="icon-button danger" type="button" aria-label={`Sterge ${template.name}`} onClick={() => removeTemplate(template.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
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
            </article>
          ))}
        </section>
      )}
    </>
  );
}
