"use client";

import {
  AccountContext,
  readAccountContexts,
  readActiveAccountContextId,
  writeAccountContexts,
  writeActiveAccountContextId,
} from "@/lib/institutions";
import { Building2, CheckCircle2, Plus, Shuffle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

function contextLabel(type: AccountContext["type"]) {
  if (type === "independent") return "Independent";
  if (type === "city_hall") return "Primarie / UAT";
  return "Institutie";
}

export function InstitutionsManager() {
  const [contexts, setContexts] = useState<AccountContext[]>([]);
  const [activeId, setActiveId] = useState("independent");
  const activeContext = contexts.find((context) => context.id === activeId);

  useEffect(() => {
    const savedContexts = readAccountContexts();

    setContexts(savedContexts);
    setActiveId(readActiveAccountContextId(savedContexts));
  }, []);

  function activateContext(id: string) {
    setActiveId(id);
    writeActiveAccountContextId(id);
  }

  function handleAddInstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const locality = String(form.get("locality") ?? "").trim();
    const identifier = String(form.get("identifier") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();

    if (!name || !locality) return;

    const nextContext: AccountContext = {
      id: `${Date.now()}`,
      name,
      type: "city_hall",
      locality,
      identifier: identifier || undefined,
      address: address || undefined,
    };
    const nextContexts = [...contexts, nextContext];

    setContexts(nextContexts);
    writeAccountContexts(nextContexts);
    activateContext(nextContext.id);
    event.currentTarget.reset();
  }

  return (
    <section className="panel institutions-panel">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Institutii</p>
          <h2>Contexte de lucru</h2>
          <p className="muted">Contul ramane unul singur, dar activitatea se poate filtra pe institutie sau independent.</p>
        </div>
        <span className="context-active-chip"><Shuffle size={16} /> {activeContext?.name ?? "Activitate independenta"}</span>
      </div>

      <div className="context-list">
        {contexts.map((context) => (
          <article className={`context-card ${context.id === activeId ? "active" : ""}`} key={context.id}>
            <Building2 size={22} />
            <div>
              <h3>{context.name}</h3>
              <p>{contextLabel(context.type)} · {context.locality}</p>
              {context.identifier && <small>{context.identifier}</small>}
            </div>
            <button className={context.id === activeId ? "primary-button" : "secondary-button"} type="button" onClick={() => activateContext(context.id)}>
              {context.id === activeId ? <CheckCircle2 size={17} /> : <Shuffle size={17} />}
              {context.id === activeId ? "Activ" : "Activeaza"}
            </button>
          </article>
        ))}
      </div>

      <form className="institution-form" onSubmit={handleAddInstitution}>
        <div>
          <p className="eyebrow">Adauga institutie</p>
          <h3>Primarie / institutie noua</h3>
        </div>
        <div className="form-grid two">
          <label>Denumire institutie<input name="name" placeholder="Primaria Joita" required /></label>
          <label>Localitate<input name="locality" placeholder="Joita" required /></label>
          <label>Cod / identificator cont<input name="identifier" placeholder="UAT, cod intern sau CIF" /></label>
          <label>Adresa relevanta<input name="address" placeholder="Strada, numar, localitate" /></label>
        </div>
        <button className="primary-button" type="submit"><Plus size={18} /> Adauga si activeaza</button>
      </form>
    </section>
  );
}
