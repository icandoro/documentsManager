"use client";

import {
  AccountContext,
  LinkedInstitutionsUser,
  RealInstitutionSummary,
  readAccountContexts,
  readActiveAccountContextId,
  syncContextsFromLinkedInstitutions,
  writeActiveAccountContextId,
} from "@/lib/institutions";
import { apiFetch } from "@/lib/api";
import { Building2, CheckCircle2, Clock3, Plus, Search, Shuffle, X } from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";

type StoredUser = LinkedInstitutionsUser & {
  id?: string;
  name?: string;
};

function contextLabel(type: AccountContext["type"]) {
  if (type === "independent") return "Activitate independenta";
  if (type === "city_hall") return "Primarie / UAT";
  return "Institutie";
}

function readStoredUser(): StoredUser | null {
  const saved = window.localStorage.getItem("docmanager_user");

  if (!saved) return null;

  try {
    return JSON.parse(saved) as StoredUser;
  } catch {
    return null;
  }
}

function writeStoredUser(user: StoredUser) {
  window.localStorage.setItem("docmanager_user", JSON.stringify(user));
}

export function InstitutionsManager() {
  const [contexts, setContexts] = useState<AccountContext[]>([]);
  const [institutions, setInstitutions] = useState<RealInstitutionSummary[]>([]);
  const [activeId, setActiveId] = useState("independent");
  const [isInstitutionAccount, setIsInstitutionAccount] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const activeContext = contexts.find((context) => context.id === activeId);
  const institutionContexts = contexts.filter((context) => context.id !== "independent");
  const independentContext = contexts.find((context) => context.id === "independent");

  async function loadInstitutions(user: StoredUser | null) {
    try {
      const response = await apiFetch("/api/auth/institutions");
      const data = await response.json();
      const rawItems: Array<{ id: number; name: string; locality?: string; county?: string }> = Array.isArray(data.items) ? data.items : [];
      const items: RealInstitutionSummary[] = rawItems.map((institution) => ({
        id: String(institution.id),
        name: institution.name,
        locality: institution.locality,
        county: institution.county,
      }));

      setInstitutions(items);

      const nextContexts = syncContextsFromLinkedInstitutions(user, items);

      setContexts(nextContexts);
      setActiveId(readActiveAccountContextId(nextContexts));
    } catch {
      toast.error("Nu am putut incarca lista de institutii.");
    }
  }

  useEffect(() => {
    const savedUser = readStoredUser();

    setIsInstitutionAccount(savedUser?.accountType === "institution");
    setCurrentUser(savedUser);
    setContexts(readAccountContexts());
    loadInstitutions(savedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function activateContext(id: string) {
    const context = contexts.find((item) => item.id === id);

    if (context?.enrollmentStatus === "pending") {
      toast.info("Institutia trebuie sa te adauge in evidenta ei inainte de activare.");
      return;
    }

    setActiveId(id);
    writeActiveAccountContextId(id);
  }

  const filteredInstitutions = useMemo(() => {
    const normalized = institutionQuery.trim().toLowerCase();

    return institutions.filter((institution) => {
      const haystack = `${institution.name} ${institution.locality ?? ""} ${institution.county ?? ""}`.toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
  }, [institutionQuery, institutions]);

  function statusForInstitution(institutionId: string): "linked" | "requested" | "none" {
    if (currentUser?.linkedInstitutionIds?.includes(institutionId)) return "linked";
    if (currentUser?.requestedInstitutionIds?.includes(institutionId)) return "requested";
    return "none";
  }

  async function requestInstitution(institution: RealInstitutionSummary) {
    const status = statusForInstitution(institution.id);

    if (status === "linked") {
      activateContext(institution.id);
      setIsPickerOpen(false);
      return;
    }

    if (status === "requested") {
      toast.info(`Cererea catre ${institution.name} e deja inregistrata. Asteapta confirmarea institutiei.`);
      setIsPickerOpen(false);
      return;
    }

    setIsLinking(true);

    try {
      const response = await apiFetch("/api/institutions/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: Number(institution.id) }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Cererea nu a putut fi trimisa.");
      }

      const nextUser: StoredUser = { ...currentUser, ...data.user };

      writeStoredUser(nextUser);
      setCurrentUser(nextUser);

      const nextContexts = syncContextsFromLinkedInstitutions(nextUser, institutions);
      setContexts(nextContexts);
      setIsPickerOpen(false);
      setInstitutionQuery("");

      if (data.status === "linked") {
        setActiveId(institution.id);
        writeActiveAccountContextId(institution.id);
      }

      toast[data.status === "linked" ? "success" : "info"](data.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cererea nu a putut fi trimisa.");
    } finally {
      setIsLinking(false);
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
              <h2 id="institution-picker-title">Alege institutia</h2>
              <p>Cauta dupa denumire sau localitate. Confirmarea se face automat doar daca institutia te are deja in evidenta ei (dupa CNP/CIF).</p>
            </div>
            <label className="institution-picker-search">
              <Search size={19} />
              <input value={institutionQuery} onChange={(event) => setInstitutionQuery(event.target.value)} placeholder="Scrie numele institutiei sau localitatea" autoFocus />
            </label>
            <div className="institution-picker-list">
              {filteredInstitutions.map((institution) => {
                const status = statusForInstitution(institution.id);

                return (
                  <button
                    className="institution-picker-option"
                    type="button"
                    key={institution.id}
                    onClick={() => requestInstitution(institution)}
                    disabled={isLinking}
                  >
                    <Building2 size={20} />
                    <span>
                      <strong>{institution.name}</strong>
                      <small>{institution.locality}{institution.county ? ` · ${institution.county}` : ""}</small>
                    </span>
                    <em className={status === "linked" ? "auto" : status === "requested" ? "pending" : ""}>
                      {status === "linked" ? "legat" : status === "requested" ? "in asteptare" : "solicita acces"}
                    </em>
                  </button>
                );
              })}
              {filteredInstitutions.length === 0 && <p className="empty-state-inline">Nu am gasit institutii pentru cautarea curenta.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
