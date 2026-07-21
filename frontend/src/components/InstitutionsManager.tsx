"use client";

import {
  AccountContext,
  readAccountContexts,
  readActiveAccountContextId,
  writeAccountContexts,
  writeActiveAccountContextId,
} from "@/lib/institutions";
import {
  readPlatformInstitutions,
  readTaxpayerCompanies,
  readTaxpayerPersons,
  type PlatformInstitution,
  type PlatformUser,
} from "@/lib/adminData";
import { Building2, CheckCircle2, Clock3, Plus, Search, Shuffle, X } from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";

function contextLabel(type: AccountContext["type"]) {
  if (type === "independent") return "Activitate independenta";
  if (type === "city_hall") return "Primarie / UAT";
  return "Institutie";
}

export function InstitutionsManager() {
  const [contexts, setContexts] = useState<AccountContext[]>([]);
  const [institutions, setInstitutions] = useState<PlatformInstitution[]>([]);
  const [activeId, setActiveId] = useState("independent");
  const [isInstitutionAccount, setIsInstitutionAccount] = useState(false);
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const activeContext = contexts.find((context) => context.id === activeId);
  const institutionContexts = contexts.filter((context) => context.id !== "independent");
  const independentContext = contexts.find((context) => context.id === "independent");

  useEffect(() => {
    const savedContexts = readAccountContexts();
    const savedUser = window.localStorage.getItem("docmanager_user");

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as PlatformUser;
        setIsInstitutionAccount(parsed.accountType === "institution");
        setCurrentUser(parsed);
      } catch {
        setIsInstitutionAccount(false);
        setCurrentUser(null);
      }
    }

    setContexts(savedContexts);
    setInstitutions(readPlatformInstitutions());
    setActiveId(readActiveAccountContextId(savedContexts));
  }, []);

  function activateContext(id: string) {
    const context = contexts.find((item) => item.id === id);

    if (context?.enrollmentStatus === "pending") {
      toast.info("Institutia trebuie sa confirme cererea inainte de activare.");
      return;
    }

    setActiveId(id);
    writeActiveAccountContextId(id);
  }

  const filteredInstitutions = useMemo(() => {
    const normalized = institutionQuery.trim().toLowerCase();

    return institutions.filter((institution) => {
      const haystack = `${institution.name} ${institution.locality} ${institution.cif}`.toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
  }, [institutionQuery, institutions]);

  function isAlreadyConfirmed(institutionId: string) {
    if (!currentUser) return false;

    if (currentUser.accountType === "individual" && currentUser.cnp) {
      return readTaxpayerPersons().some((person) =>
        person.institutionId === institutionId &&
        person.cnp === currentUser.cnp &&
        (person.status === "legat" || person.linkedUserId === currentUser.id)
      );
    }

    if (currentUser.accountType === "company" && currentUser.cif) {
      const cleanUserCif = currentUser.cif.replace(/^RO/i, "").trim();
      return readTaxpayerCompanies().some((company) =>
        company.institutionId === institutionId &&
        company.cif.replace(/^RO/i, "").trim() === cleanUserCif &&
        (company.status === "legat" || company.linkedUserId === currentUser.id)
      );
    }

    return false;
  }

  function requestInstitution(institution: PlatformInstitution) {
    const existingContext = contexts.find((context) => context.id === institution.id);

    if (existingContext?.enrollmentStatus === "active" || existingContext?.enrollmentStatus === undefined) {
      activateContext(institution.id);
      setIsPickerOpen(false);
      return;
    }

    const confirmed = isAlreadyConfirmed(institution.id);
    const nextContext: AccountContext = {
      id: institution.id,
      name: institution.name,
      type: institution.type === "primarie" ? "city_hall" : "institution",
      locality: institution.locality,
      identifier: institution.type === "primarie" ? `UAT-${institution.locality.toUpperCase()}` : institution.cif,
      enrollmentStatus: confirmed ? "active" : "pending",
    };

    const nextContexts = existingContext
      ? contexts.map((context) => context.id === institution.id ? nextContext : context)
      : [...contexts, nextContext];

    setContexts(nextContexts);
    writeAccountContexts(nextContexts);
    setIsPickerOpen(false);
    setInstitutionQuery("");

    if (confirmed) {
      setActiveId(institution.id);
      writeActiveAccountContextId(institution.id);
      toast.success(`${institution.name} a fost activata automat. Ai fost gasit in baza institutiei.`);
    } else {
      toast.info(`Cererea catre ${institution.name} a fost trimisa. Asteapta confirmarea institutiei.`);
    }
  }

  function contextStatus(context: AccountContext) {
    if (context.id === activeId && context.enrollmentStatus !== "pending") return "active";
    return context.enrollmentStatus ?? "active";
  }

  if (isInstitutionAccount) {
    return null;
  }

  return (
    <section className="panel institutions-panel">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Institutii inrolate</p>
          <h2>Institutii</h2>
          <p className="muted">Alege institutia pentru care lucrezi sau foloseste activitatea independenta.</p>
        </div>
        <span className="context-active-chip"><Shuffle size={16} /> {activeContext?.name ?? "Activitate independenta"}</span>
      </div>

      <div className="context-list compact-context-list">
        {independentContext && (
          <article className={`context-card compact ${independentContext.id === activeId ? "active" : ""}`} key={independentContext.id}>
            <Building2 size={22} />
            <div>
              <h3>{independentContext.name}</h3>
              <p>{contextLabel(independentContext.type)} · {independentContext.locality}</p>
            </div>
            <button className={independentContext.id === activeId ? "primary-button compact-context-action" : "secondary-button compact-context-action"} type="button" onClick={() => activateContext(independentContext.id)}>
              {independentContext.id === activeId ? <CheckCircle2 size={16} /> : <Shuffle size={16} />}
              {independentContext.id === activeId ? "Activ" : "Activeaza"}
            </button>
          </article>
        )}

        {institutionContexts.map((context) => {
          const status = contextStatus(context);

          return (
            <article className={`context-card compact ${context.id === activeId ? "active" : ""} ${status === "pending" ? "pending" : ""}`} key={context.id}>
              <Building2 size={22} />
              <div>
                <h3>{context.name}</h3>
                <p>{contextLabel(context.type)} · {context.locality}</p>
                {context.identifier && <small>{context.identifier}</small>}
              </div>
              {status === "pending" ? (
                <span className="context-status waiting"><Clock3 size={15} /> In asteptare</span>
              ) : (
                <button className={context.id === activeId ? "primary-button compact-context-action" : "secondary-button compact-context-action"} type="button" onClick={() => activateContext(context.id)}>
                  {context.id === activeId ? <CheckCircle2 size={16} /> : <Shuffle size={16} />}
                  {context.id === activeId ? "Activ" : "Activeaza"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div className="institution-add-card">
        <div className="institution-add-copy">
          <span><Plus size={18} /></span>
          <div>
            <p className="eyebrow">Adauga institutie inrolata</p>
            <h3>Solicita acces la institutie</h3>
            <p>Cauta institutia, selecteaz-o si cererea intra la confirmare daca nu esti deja in evidenta ei.</p>
          </div>
        </div>
        <button className="primary-button" type="button" onClick={() => setIsPickerOpen(true)}><Plus size={18} /> Alege institutie</button>
      </div>

      {isPickerOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPickerOpen(false)}>
          <div className="modal-panel institution-picker-modal" role="dialog" aria-modal="true" aria-labelledby="institution-picker-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Inchide" onClick={() => setIsPickerOpen(false)}><X size={24} /></button>
            <div className="institution-picker-head">
              <p className="eyebrow">Institutii disponibile</p>
              <h2 id="institution-picker-title">Alege primaria</h2>
              <p>Cauta dupa denumire sau localitate. Confirmarea se face automat doar daca institutia te are deja in baza locala.</p>
            </div>
            <label className="institution-picker-search">
              <Search size={19} />
              <input value={institutionQuery} onChange={(event) => setInstitutionQuery(event.target.value)} placeholder="Scrie numele primariei sau localitatea" autoFocus />
            </label>
            <div className="institution-picker-list">
              {filteredInstitutions.map((institution) => {
                const existingContext = contexts.find((context) => context.id === institution.id);
                const confirmed = isAlreadyConfirmed(institution.id);
                const isPending = existingContext?.enrollmentStatus === "pending";

                return (
                  <button className="institution-picker-option" type="button" key={institution.id} onClick={() => requestInstitution(institution)}>
                    <Building2 size={20} />
                    <span>
                      <strong>{institution.name}</strong>
                      <small>{institution.locality} · {institution.type === "primarie" ? "Primarie / UAT" : "Institutie"}</small>
                    </span>
                    <em className={confirmed ? "auto" : isPending ? "pending" : ""}>
                      {confirmed ? "activare automata" : isPending ? "in asteptare" : "solicita acces"}
                    </em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
