"use client";

import { readAccountContexts, readActiveAccountContextId } from "@/lib/institutions";
import {
  ContextProfileData,
  GeneralProfileData,
  readContextProfile,
  readGeneralProfile,
  writeContextProfile,
  writeGeneralProfile,
} from "@/lib/profileData";
import { ROMANIA_COUNTIES, localityOptions } from "@/lib/romaniaLocalities";
import { Building2, KeyRound, LockKeyhole, MapPin, QrCode, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

export function ProfileManager() {
  const [generalProfile, setGeneralProfile] = useState<GeneralProfileData | null>(null);
  const [contextProfile, setContextProfile] = useState<ContextProfileData | null>(null);
  const [activeContextId, setActiveContextId] = useState("independent");
  const [activeContextName, setActiveContextName] = useState("Activitate independenta");
  const [activeContextLocality, setActiveContextLocality] = useState("Fara institutie");

  useEffect(() => {
    setGeneralProfile(readGeneralProfile());

    function syncProfileContext() {
      const contexts = readAccountContexts();
      const contextId = readActiveAccountContextId(contexts);
      const context = contexts.find((item) => item.id === contextId) ?? contexts[0];

      setActiveContextId(context.id);
      setActiveContextName(context.name);
      setActiveContextLocality(context.locality ?? "Fara localitate");
      setContextProfile(readContextProfile(context));
    }

    syncProfileContext();
    window.addEventListener("storage", syncProfileContext);
    window.addEventListener("docmanager-account-context-change", syncProfileContext);

    return () => {
      window.removeEventListener("storage", syncProfileContext);
      window.removeEventListener("docmanager-account-context-change", syncProfileContext);
    };
  }, []);

  if (!generalProfile || !contextProfile) {
    return null;
  }

  function updateGeneral(field: keyof GeneralProfileData, value: string) {
    setGeneralProfile((current) => current ? { ...current, [field]: value } : current);
  }

  function updateContext(field: keyof ContextProfileData, value: string) {
    setContextProfile((current) => current ? { ...current, [field]: value } : current);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!generalProfile || !contextProfile) return;

    writeGeneralProfile(generalProfile);
    writeContextProfile(activeContextId, contextProfile);
    toast.success("Profilul a fost salvat pentru contextul curent.");
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Cont si profil</p>
          <h1>Date utilizator</h1>
          <p className="muted">Datele generale raman comune, iar datele institutionale se schimba in functie de contextul selectat.</p>
        </div>
      </section>

      <section className="context-profile-card panel">
        <div className="context-profile-icon">
          {activeContextId === "independent" ? <UserRound size={24} /> : <Building2 size={24} />}
        </div>
        <div>
          <p className="eyebrow">Context activ</p>
          <h2>{activeContextName}</h2>
          <p><MapPin size={16} /> {activeContextLocality}</p>
        </div>
      </section>

      <section className="profile-grid">
        <form className="panel form-grid profile-form-panel" onSubmit={saveProfile}>
          <div className="profile-section-title">
            <UserRound size={22} />
            <div>
              <p className="eyebrow">Date generale</p>
              <h2>Identitate cont</h2>
            </div>
          </div>
          <div className="two-cols">
            <label>Nume<input value={generalProfile.lastName} onChange={(event) => updateGeneral("lastName", event.target.value)} /></label>
            <label>Prenume<input value={generalProfile.firstName} onChange={(event) => updateGeneral("firstName", event.target.value)} /></label>
          </div>
          <div className="two-cols">
            <label>CNP<input value={generalProfile.cnp} onChange={(event) => updateGeneral("cnp", event.target.value)} /></label>
            <label>Telefon<input value={generalProfile.phone} onChange={(event) => updateGeneral("phone", event.target.value)} /></label>
          </div>
          <div className="two-cols">
            <label>Email<input type="email" value={generalProfile.email} onChange={(event) => updateGeneral("email", event.target.value)} /></label>
            <label>Tip cont
              <select value={generalProfile.accountType} onChange={(event) => updateGeneral("accountType", event.target.value)}>
                <option value="individual">Persoana fizica</option>
                <option value="company">Persoana juridica</option>
                <option value="institution">Institutie</option>
              </select>
            </label>
          </div>
          <div className="two-cols">
            <label>Limba
              <select value={generalProfile.language} onChange={(event) => updateGeneral("language", event.target.value)}>
                <option value="ro">Romana</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>Fus orar
              <select value={generalProfile.timezone} onChange={(event) => updateGeneral("timezone", event.target.value)}>
                <option>Europe/Bucharest</option>
                <option>Europe/London</option>
              </select>
            </label>
          </div>

          <div className="profile-section-title profile-context-title">
            <Building2 size={22} />
            <div>
              <p className="eyebrow">Date specifice</p>
              <h2>{activeContextName}</h2>
            </div>
          </div>
          <div className="two-cols">
            <label>Judet
              <select value={contextProfile.county} onChange={(event) => {
                updateContext("county", event.target.value);
                updateContext("locality", "");
              }}>
                <option value="">Selecteaza judetul</option>
                {ROMANIA_COUNTIES.map((county) => <option key={county} value={county}>{county}</option>)}
              </select>
            </label>
            <label>Localitate
              <select value={contextProfile.locality} onChange={(event) => updateContext("locality", event.target.value)} disabled={!contextProfile.county}>
                <option value="">{contextProfile.county ? "Selecteaza localitatea" : "Alege mai intai judetul"}</option>
                {localityOptions(contextProfile.county, contextProfile.locality).map((locality) => <option key={locality} value={locality}>{locality}</option>)}
              </select>
            </label>
          </div>
          <label>Cod postal<input value={contextProfile.postalCode} onChange={(event) => updateContext("postalCode", event.target.value)} /></label>
          <label>Adresa de corespondenta in acest context
            <input value={contextProfile.correspondenceAddress} onChange={(event) => updateContext("correspondenceAddress", event.target.value)} placeholder="Strada, numar, bloc, apartament" />
          </label>
          <div className="two-cols">
            <label>Calitate / rol fiscal<input value={contextProfile.fiscalRole} onChange={(event) => updateContext("fiscalRole", event.target.value)} /></label>
            <label>Numar rol / dosar<input value={contextProfile.fileNumber} onChange={(event) => updateContext("fileNumber", event.target.value)} /></label>
          </div>
          <label>Preferinta comunicare
            <select value={contextProfile.communicationPreference} onChange={(event) => updateContext("communicationPreference", event.target.value)}>
              <option value="platforma">Platforma</option>
              <option value="email">Email</option>
              <option value="telefon">Telefon</option>
            </select>
          </label>
          <details>
            <summary>Informatii optionale pentru acest context</summary>
            <label>Observatii interne<textarea value={contextProfile.notes} onChange={(event) => updateContext("notes", event.target.value)} placeholder="Ex: proprietate secundara, imputernicit, preferinte locale" /></label>
          </details>
          <button className="primary-button" type="submit">Salveaza profil</button>
        </form>

        <aside className="panel security-panel" id="security">
          <ShieldCheck size={32} />
          <h2>Securitate</h2>
          <p>Email si parola, sesiuni pe baza de token JWT si verificare 2FA pentru actiuni sensibile.</p>
          <div className="security-row"><LockKeyhole size={18} /> Parola configurata</div>
          <div className="security-row"><ShieldCheck size={18} /> 2FA recomandat</div>

          <div className="two-factor-setup-card">
            <p className="eyebrow">Pregatit pentru activare</p>
            <h3>Autentificare in doi pasi</h3>
            <div className="two-factor-setup-steps">
              <span><QrCode size={18} /> Secret TOTP si QR</span>
              <span><Smartphone size={18} /> Aplicatie Authenticator</span>
              <span><KeyRound size={18} /> Cod in pas separat la login</span>
            </div>
            <p>Fluxul este implementat, dar ramane dezactivat pana cand decidem sa permitem activarea conturilor.</p>
          </div>
          <button className="secondary-button" type="button" disabled>Activare 2FA indisponibila momentan</button>
        </aside>
      </section>
    </>
  );
}
