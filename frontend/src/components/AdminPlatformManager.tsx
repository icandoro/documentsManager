"use client";

import {
  PlatformInstitution,
  PlatformUser,
  TaxpayerCompany,
  TaxpayerPerson,
  readPlatformInstitutions,
  readPlatformUsers,
  readTaxpayerCompanies,
  readTaxpayerPersons,
  writePlatformInstitutions,
  writePlatformUsers,
  writeTaxpayerCompanies,
  writeTaxpayerPersons,
} from "@/lib/adminData";
import { Building2, CheckCircle2, Clock3, Database, Download, FileCheck2, FileInput, FileOutput, FileUp, Gavel, Landmark, Link2, MapPin, MoreVertical, Network, RefreshCw, Search, Shield, ShieldAlert, SlidersHorizontal, UserPlus, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AdminTab = "users" | "institutions" | "persons" | "companies" | "relations";

type LocalAccount = {
  email: string;
  password: string;
  user: PlatformUser;
};

type PendingInstitutionOnboarding = {
  email?: string | null;
  company?: {
    name?: string;
    cif?: string;
  } | null;
  documents?: Record<string, string>;
  status?: string;
  submittedAt?: string;
};

type InstitutionApprovalRequest = {
  id: string;
  name: string;
  email: string;
  cif: string;
  submittedAt?: string;
  documents?: Record<string, string>;
  user: PlatformUser | null;
};

const localAccountsStorageKey = "docmanager_local_accounts";

function tabFromHash(hash: string): AdminTab {
  const value = hash.replace("#", "");

  if (value === "institutions" || value === "persons" || value === "companies" || value === "relations") {
    return value;
  }

  return "users";
}

function statusLabel(status: "legat" | "nelegat" | "activa" | "in_verificare") {
  if (status === "legat") return "Legat";
  if (status === "nelegat") return "Nelegat";
  if (status === "activa") return "Activa";
  return "In verificare";
}

function readStoredRole() {
  if (typeof window === "undefined") return "user";

  return window.localStorage.getItem("docmanager_user_role") ?? "user";
}

function readLocalAccounts() {
  if (typeof window === "undefined") return [];

  const saved = window.localStorage.getItem(localAccountsStorageKey);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as LocalAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(localAccountsStorageKey);
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccount[]) {
  window.localStorage.setItem(localAccountsStorageKey, JSON.stringify(accounts));
}

function readPendingInstitutionOnboarding(): PendingInstitutionOnboarding | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem("docmanager_institution_onboarding");
    return saved ? JSON.parse(saved) as PendingInstitutionOnboarding : null;
  } catch {
    return null;
  }
}

function mergeUsersWithLocalAccounts(users: PlatformUser[]) {
  const localUsers = readLocalAccounts().map((account) => account.user);
  const existingEmails = new Set(users.map((user) => user.email.toLowerCase()));

  return [...users, ...localUsers.filter((user) => !existingEmails.has(user.email.toLowerCase()))];
}

function nextReviewDate(from = new Date()) {
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function isReviewDue(institution: PlatformInstitution) {
  if (!institution.nextDocumentReviewDueAt) return false;

  return new Date(institution.nextDocumentReviewDueAt) <= new Date();
}

export function AdminPlatformManager() {
  const [role, setRole] = useState("user");
  const [tab, setTab] = useState<AdminTab>("users");
  const [query, setQuery] = useState("");
  const [institutions, setInstitutions] = useState<PlatformInstitution[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [persons, setPersons] = useState<TaxpayerPerson[]>([]);
  const [companies, setCompanies] = useState<TaxpayerCompany[]>([]);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingOnboarding, setPendingOnboarding] = useState<PendingInstitutionOnboarding | null>(null);

  useEffect(() => {
    function syncRole() {
      setRole(readStoredRole());
    }

    syncRole();
    setInstitutions(readPlatformInstitutions());
    setUsers(mergeUsersWithLocalAccounts(readPlatformUsers()));
    setPersons(readTaxpayerPersons());
    setCompanies(readTaxpayerCompanies());
    setPendingOnboarding(readPendingInstitutionOnboarding());
    window.localStorage.setItem("docmanager_user_role", readStoredRole());
    window.addEventListener("storage", syncRole);

    return () => window.removeEventListener("storage", syncRole);
  }, []);

  const isSuperAdmin = role === "superadmin";
  const canManageUsers = role === "superadmin" || role === "admin";

  const filteredInstitutions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return institutions.filter((item) =>
      [item.name, item.locality, item.cif, item.type].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [institutions, query]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((item) => {
      const linkedInstitutions = item.linkedInstitutionIds
        .map((id) => institutions.find((institution) => institution.id === id)?.name ?? id)
        .join(" ");
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesRole && matchesStatus && [
        item.name,
        item.email,
        item.role,
        item.accountType,
        item.cnp ?? "",
        item.cif ?? "",
        item.phone ?? "",
        item.status,
        linkedInstitutions,
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [institutions, query, roleFilter, statusFilter, users]);

  const filteredPersons = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return persons.filter((item) =>
      [item.name, item.cnp, item.locality, item.status].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [persons, query]);

  const filteredCompanies = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return companies.filter((item) =>
      [item.name, item.cif, item.locality, item.status].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [companies, query]);

  const pendingInstitutionUsers = useMemo(() => {
    return users.filter((user) => user.accountType === "institution" && user.status === "in_verificare");
  }, [users]);

  const dueInstitutions = useMemo(() => {
    return institutions.filter((institution) => isReviewDue(institution) || institution.verificationStatus === "renewal_due");
  }, [institutions]);

  const pendingInstitutionRequests = useMemo(() => {
    const requests: InstitutionApprovalRequest[] = pendingInstitutionUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      cif: user.cif ?? "-",
      submittedAt: pendingOnboarding?.email === user.email ? pendingOnboarding.submittedAt : undefined,
      documents: pendingOnboarding?.email === user.email ? pendingOnboarding.documents : undefined,
      user,
    }));

    if (pendingOnboarding?.status === "pending_admin_review" && pendingOnboarding.email && !requests.some((request) => request.email === pendingOnboarding.email)) {
      requests.unshift({
        id: `pending-${pendingOnboarding.email}`,
        name: pendingOnboarding.company?.name ?? "Institutie in verificare",
        email: pendingOnboarding.email,
        cif: pendingOnboarding.company?.cif ?? "-",
        submittedAt: pendingOnboarding.submittedAt,
        documents: pendingOnboarding.documents,
        user: null,
      });
    }

    return requests;
  }, [pendingInstitutionUsers, pendingOnboarding]);

  function handleInstitutionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const locality = String(form.get("locality") ?? "").trim();
    const cif = String(form.get("cif") ?? "").trim();
    const type = String(form.get("type") ?? "primarie") as PlatformInstitution["type"];

    if (!name || !locality || !cif) return;

    const nextInstitutions = [
      {
        id: `${Date.now()}`,
        name,
        locality,
        cif,
        type,
        status: "activa" as const,
        taxpayers: 0,
      },
      ...institutions,
    ];

    setInstitutions(nextInstitutions);
    writePlatformInstitutions(nextInstitutions);
    event.currentTarget.reset();
  }

  function handleDatabaseImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const institutionId = String(form.get("institutionId") ?? "");
    const payload = String(form.get("payload") ?? "").trim();
    const institution = institutions.find((item) => item.id === institutionId);

    if (!institution || !payload) return;

    const rows = payload.split("\n").map((row) => row.split(",").map((cell) => cell.trim())).filter((row) => row.length >= 3);
    const nextPersons = [...persons];
    const nextCompanies = [...companies];

    rows.forEach(([kind, identifier, name]) => {
      if (kind.toLowerCase() === "pf") {
        nextPersons.unshift({
          id: `${Date.now()}-${identifier}`,
          name,
          cnp: identifier,
          locality: institution.locality,
          institutionId,
          status: "nelegat",
        });
      }

      if (kind.toLowerCase() === "pj") {
        nextCompanies.unshift({
          id: `${Date.now()}-${identifier}`,
          name,
          cif: identifier,
          locality: institution.locality,
          institutionId,
          status: "nelegat",
        });
      }
    });

    const nextInstitutions = institutions.map((item) =>
      item.id === institutionId ? { ...item, taxpayers: item.taxpayers + rows.length } : item,
    );

    setPersons(nextPersons);
    setCompanies(nextCompanies);
    setInstitutions(nextInstitutions);
    writeTaxpayerPersons(nextPersons);
    writeTaxpayerCompanies(nextCompanies);
    writePlatformInstitutions(nextInstitutions);
    event.currentTarget.reset();
  }

  function handleManualTaxpayerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = String(form.get("kind") ?? "pf");
    const institutionId = String(form.get("institutionId") ?? "");
    const identifier = String(form.get("identifier") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const sector = String(form.get("sector") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();

    if (!institutionId || !identifier || !name || !city) return;

    if (kind === "pf") {
      const nextPersons = [{
        id: `${Date.now()}-${identifier}`,
        name,
        cnp: identifier,
        locality: sector ? `${city}, sector ${sector}` : city,
        institutionId,
        status: "nelegat" as const,
      }, ...persons];

      setPersons(nextPersons);
      writeTaxpayerPersons(nextPersons);
    } else {
      const nextCompanies = [{
        id: `${Date.now()}-${identifier}`,
        name,
        cif: identifier,
        locality: address ? `${city}, ${address}` : city,
        institutionId,
        status: "nelegat" as const,
      }, ...companies];

      setCompanies(nextCompanies);
      writeTaxpayerCompanies(nextCompanies);
    }

    event.currentTarget.reset();
  }

  function linkPerson(id: string) {
    const nextPersons = persons.map((person) => person.id === id ? { ...person, status: "legat" as const } : person);

    setPersons(nextPersons);
    writeTaxpayerPersons(nextPersons);
  }

  function linkCompany(id: string) {
    const nextCompanies = companies.map((company) => company.id === id ? { ...company, status: "legat" as const } : company);

    setCompanies(nextCompanies);
    writeTaxpayerCompanies(nextCompanies);
  }

  function updateUserRole(id: string, nextRole: PlatformUser["role"]) {
    const nextUsers = users.map((user) => user.id === id ? { ...user, role: nextRole } : user);

    setUsers(nextUsers);
    setSelectedUser((current) => current?.id === id ? { ...current, role: nextRole } : current);
    writePlatformUsers(nextUsers);
  }

  useEffect(() => {
    function syncTabFromHash() {
      const nextTab = tabFromHash(window.location.hash);

      if (!isSuperAdmin && nextTab !== "users") {
        window.history.replaceState(null, "", "#users");
        setTab("users");
        return;
      }

      setTab(nextTab);
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, [isSuperAdmin]);

  function updateUserStatus(id: string, nextStatus: PlatformUser["status"]) {
    const nextUsers = users.map((user) => user.id === id ? { ...user, status: nextStatus } : user);

    setUsers(nextUsers);
    setSelectedUser((current) => current?.id === id ? { ...current, status: nextStatus } : current);
    writePlatformUsers(nextUsers);
  }

  function persistUserStatusByEmail(email: string, nextStatus: PlatformUser["status"]) {
    const normalizedEmail = email.toLowerCase();
    const nextUsers = users.map((user) => user.email.toLowerCase() === normalizedEmail ? { ...user, status: nextStatus } : user);
    const nextLocalAccounts = readLocalAccounts().map((account) =>
      account.email.toLowerCase() === normalizedEmail ? { ...account, user: { ...account.user, status: nextStatus } } : account,
    );

    setUsers(nextUsers);
    writePlatformUsers(nextUsers.filter((user) => readPlatformUsers().some((defaultUser) => defaultUser.id === user.id)));
    writeLocalAccounts(nextLocalAccounts);
  }

  function approveInstitutionRequest(email: string, name: string, cif: string) {
    persistUserStatusByEmail(email, "activ");

    const existingInstitution = institutions.find((institution) => institution.cif.replace(/^RO/i, "") === cif.replace(/^RO/i, ""));
    const now = new Date();
    const nextInstitutions = existingInstitution
      ? institutions.map((institution) => institution.id === existingInstitution.id ? {
        ...institution,
        status: "activa" as const,
        verificationStatus: "approved" as const,
        lastDocumentReviewAt: now.toISOString().slice(0, 10),
        nextDocumentReviewDueAt: nextReviewDate(now),
      } : institution)
      : [{
        id: `institution-${Date.now()}`,
        name,
        locality: "Nespecificata",
        cif,
        type: "institutie" as const,
        status: "activa" as const,
        taxpayers: 0,
        verificationStatus: "approved" as const,
        lastDocumentReviewAt: now.toISOString().slice(0, 10),
        nextDocumentReviewDueAt: nextReviewDate(now),
      }, ...institutions];

    setInstitutions(nextInstitutions);
    writePlatformInstitutions(nextInstitutions);

    if (pendingOnboarding?.email === email) {
      const nextOnboarding = { ...pendingOnboarding, status: "approved" };
      window.localStorage.setItem("docmanager_institution_onboarding", JSON.stringify(nextOnboarding));
      setPendingOnboarding(nextOnboarding);
    }

    toast.success("Institutia a fost aprobata. Contul este activ.");
  }

  function rejectInstitutionRequest(email: string) {
    persistUserStatusByEmail(email, "suspendat");
    toast.info("Solicitarea institutiei a fost marcata ca respinsa/suspendata.");
  }

  function confirmAnnualReview(institutionId: string) {
    const now = new Date();
    const nextInstitutions = institutions.map((institution) => institution.id === institutionId ? {
      ...institution,
      verificationStatus: "approved" as const,
      lastDocumentReviewAt: now.toISOString().slice(0, 10),
      nextDocumentReviewDueAt: nextReviewDate(now),
    } : institution);

    setInstitutions(nextInstitutions);
    writePlatformInstitutions(nextInstitutions);
    toast.success("Revizuirea anuala a fost confirmata pentru urmatoarele 12 luni.");
  }

  if (!canManageUsers) {
    return (
      <section className="approval-panel">
        <ShieldAlert size={36} />
        <h1>Acces restrictionat</h1>
        <p>Zona de administrare este disponibila doar pentru rolurile admin si superadmin.</p>
      </section>
    );
  }

  return (
    <>
      <section className="enterprise-page-head">
        <div>
          <p className="eyebrow">{isSuperAdmin ? "Superadmin" : "Admin"}</p>
          <h1>{tab === "users" ? "User Management" : tab === "institutions" ? "Institutions" : tab === "persons" ? "Individuals" : tab === "companies" ? "Legal Entities" : "Imports"}</h1>
          <p>{tab === "users" ? "Manage institutional access, roles, and user profiles across the enterprise." : "Gestioneaza institutiile, contribuabilii si legaturile CNP/CIF intr-un mediu securizat."}</p>
        </div>
        {tab === "users" && (
          <button className="primary-button admin-add-user" type="button">
            <UserPlus size={20} />
            Add New User
          </button>
        )}
      </section>

      {tab === "users" ? (
        <>
          <section className="admin-overview-stats">
            <article>
              <div className="admin-stat-icon"><UserRound size={24} /></div>
              <em>+12%</em>
              <span>Total Users</span>
              <strong>{users.length.toLocaleString("ro-RO")}</strong>
              <p>+12%</p>
            </article>
            <article>
              <div className="admin-stat-icon warm"><Building2 size={24} /></div>
              <span>Active Now</span>
              <strong>{users.filter((item) => item.status === "activ").length.toLocaleString("ro-RO")}</strong>
              <p>High Load</p>
            </article>
            <article>
              <div className="admin-stat-icon cool"><Gavel size={24} /></div>
              <span>Pending Requests</span>
              <strong>{(users.filter((item) => item.status === "in_verificare").length + (pendingOnboarding?.status === "pending_admin_review" ? 1 : 0)).toLocaleString("ro-RO")}</strong>
              <p>Action Needed</p>
            </article>
            <article>
              <div className="admin-stat-icon"><Network size={24} /></div>
              <i />
              <span>Admin Accounts</span>
              <strong>{users.filter((item) => item.role === "admin" || item.role === "superadmin").length}</strong>
              <p>Stable</p>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="admin-tabs panel admin-search-only">
            <div>
              <p className="eyebrow">Sectiune curenta</p>
              <h2>{tab === "institutions" ? "Institutii" : tab === "persons" ? "Persoane fizice" : tab === "companies" ? "Persoane juridice" : "Import si legaturi"}</h2>
            </div>
            <label className="compact-select search-filter">Cautare
              <span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta dupa nume, CNP, CIF sau localitate" /></span>
            </label>
          </section>
        </>
      )}

      {tab === "users" && (
        <>
        <section className="admin-overview-table panel">
          <div className="admin-table-toolbar">
            <label className="admin-table-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by name, email..." />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All Roles</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All Status</option>
              <option value="activ">Active</option>
              <option value="in_verificare">Pending</option>
              <option value="suspendat">Inactive</option>
            </select>
            <button className="icon-button" type="button" aria-label="Filtre avansate"><SlidersHorizontal size={19} /></button>
            <button className="icon-button" type="button" aria-label="Export"><Download size={19} /></button>
          </div>
          <div className="admin-overview-head">
            <span>User details</span>
            <span>CNP / Identifier</span>
            <span>Institution</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filteredUsers.slice(0, 4).map((user, index) => {
            const linkedInstitutions = user.linkedInstitutionIds
              .map((id) => institutions.find((institution) => institution.id === id)?.name ?? id);

            return (
              <article className="admin-overview-row enterprise-user-row" key={user.id} onClick={() => setSelectedUser(user)}>
                <span className={`admin-avatar-chip tone-${index}`}>{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="admin-user-main">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <div>
                  <span>{user.accountType === "individual" ? "Persoana fizica" : user.accountType === "company" ? "Persoana juridica" : "Institutie"}</span>
                  <small>{user.cnp ?? user.cif ?? "Fara identificator"}</small>
                </div>
                <span className="institution-tags-inline">
                  {linkedInstitutions.slice(0, 2).map((institution) => <em key={institution}>{institution}</em>)}
                  {linkedInstitutions.length === 0 && <em>Independent</em>}
                </span>
                <span className="admin-role-badge">{user.role === "superadmin" ? "Superadmin" : user.role === "admin" ? "Administrator" : "Viewer"}</span>
                <span className={`admin-status-pill ${user.status === "activ" ? "active" : "inactive"}`}>
                  {user.status === "activ" ? "Active" : user.status === "in_verificare" ? "Pending" : "Inactive"}
                </span>
                <button type="button" aria-label={`Detalii ${user.name}`} onClick={(event) => { event.stopPropagation(); setSelectedUser(user); }}><MoreVertical size={20} /></button>
              </article>
            );
          })}
          <footer className="admin-overview-footer">
            <span>Showing 1-{Math.min(filteredUsers.length, 4)} of {users.length.toLocaleString("ro-RO")} users</span>
            <div>
              <button type="button">‹</button>
              <button className="active" type="button">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <span>...</span>
              <button type="button">321</button>
              <button type="button">›</button>
            </div>
          </footer>
        </section>

        <section className="admin-insight-grid">
          <article className="admin-insight-card">
            <h2>Regula de acces institutional</h2>
            <p>O institutie poate trimite documente doar catre persoane sau firme importate in baza ei si legate de cont prin CNP/CIF. Daca persoana are cont, dar nu exista in baza institutiei, relatia nu este activa.</p>
            <button className="secondary-button" type="button" onClick={() => window.location.hash = "relations"}>Gestioneaza legaturi</button>
          </article>
          <article className="admin-security-card">
            <Shield size={38} />
            <h2>Flux securizat activ</h2>
            <p>Documentele se trimit doar intre conturi eligibile: persoana fizica, persoana juridica si institutie validata.</p>
          </article>
        </section>
        </>
      )}
      {selectedUser && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Profil ${selectedUser.name}`}>
          <div className="modal-panel admin-profile-modal">
            <header className="modal-head">
              <div>
                <p className="eyebrow">Profil utilizator</p>
                <h2>{selectedUser.name}</h2>
                <p>{selectedUser.email} · {selectedUser.accountType === "individual" ? "Persoana fizica" : selectedUser.accountType === "company" ? "Persoana juridica" : "Institutie"}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Inchide profilul" onClick={() => setSelectedUser(null)}><X size={18} /></button>
            </header>
            <div className="profile-modal-stats">
              <span><FileOutput size={17} /><strong>{selectedUser.sentCount}</strong> documente trimise</span>
              <span><FileInput size={17} /><strong>{selectedUser.receivedCount}</strong> documente primite</span>
              <span className={`status-chip ${selectedUser.status === "activ" ? "received" : selectedUser.status === "in_verificare" ? "waiting" : "neutral"}`}>{selectedUser.status}</span>
            </div>
            <div className="profile-detail-grid">
              <section>
                <h3>Date personale</h3>
                <dl>
                  <div><dt>Nume</dt><dd>{selectedUser.lastName ?? selectedUser.name}</dd></div>
                  <div><dt>Prenume</dt><dd>{selectedUser.firstName ?? "-"}</dd></div>
                  <div><dt>CNP</dt><dd>{selectedUser.cnp ?? "-"}</dd></div>
                  <div><dt>CIF/CUI</dt><dd>{selectedUser.cif ?? "-"}</dd></div>
                  <div><dt>Telefon</dt><dd>{selectedUser.phone ?? "-"}</dd></div>
                  <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
                </dl>
              </section>
              <section>
                <h3>Adresa completa</h3>
                <dl>
                  <div><dt>Strada</dt><dd>{selectedUser.address?.street ?? "-"}</dd></div>
                  <div><dt>Numar</dt><dd>{selectedUser.address?.number ?? "-"}</dd></div>
                  <div><dt>Localitate</dt><dd>{selectedUser.address?.city ?? "-"}</dd></div>
                  <div><dt>Sector</dt><dd>{selectedUser.address?.sector ?? "-"}</dd></div>
                  <div><dt>Judet</dt><dd>{selectedUser.address?.county ?? "-"}</dd></div>
                  <div><dt>Cod postal</dt><dd>{selectedUser.address?.postalCode ?? "-"}</dd></div>
                </dl>
              </section>
              <section>
                <h3>Institutii inrolate</h3>
                <div className="linked-institutions profile">
                  {selectedUser.linkedInstitutionIds.map((id) => (
                    <em key={id}>{institutions.find((institution) => institution.id === id)?.name ?? id}</em>
                  ))}
                  {selectedUser.linkedInstitutionIds.length === 0 && <em>Independent</em>}
                </div>
              </section>
              <section>
                <h3>Administrare cont</h3>
                <div className="profile-admin-controls">
                  <label className="compact-select">Rol
                    <select value={selectedUser.role} onChange={(event) => updateUserRole(selectedUser.id, event.target.value as PlatformUser["role"])} disabled={!isSuperAdmin}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </label>
                  <label className="compact-select">Status
                    <select value={selectedUser.status} onChange={(event) => updateUserStatus(selectedUser.id, event.target.value as PlatformUser["status"])}>
                      <option value="activ">Activ</option>
                      <option value="in_verificare">In verificare</option>
                      <option value="suspendat">Suspendat</option>
                    </select>
                  </label>
                  <button className="secondary-button danger-action" type="button" onClick={() => updateUserStatus(selectedUser.id, "suspendat")}>
                    Dezactiveaza utilizator
                  </button>
                </div>
              </section>
            </div>
            <aside className="relation-note mapping-note">
              <MapPin size={22} />
              <p>Maparea cu institutiile se face dupa CNP si adresa de domiciliu pentru persoane fizice, respectiv dupa CIF/CUI si adresa sediului social pentru persoane juridice.</p>
            </aside>
          </div>
        </section>
      )}

      {tab === "institutions" && (
        <>
          <section className="institution-approval-grid">
            <article className="institution-approval-card primary-review">
              <header>
                <span><ShieldAlert size={24} /></span>
                <div>
                  <p className="eyebrow">Aprobari institutii</p>
                  <h2>Asteapta verificare administrator</h2>
                </div>
              </header>
              {pendingInstitutionRequests.length === 0 ? (
                <p className="empty-state">Nu exista institutii in asteptare.</p>
              ) : pendingInstitutionRequests.map((request) => (
                <div className="institution-request-row" key={request.id}>
                  <span className="admin-avatar-chip">{request.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{request.name}</strong>
                    <small>{request.email} · CIF {request.cif} · trimis {request.submittedAt ? new Date(request.submittedAt).toLocaleDateString("ro-RO") : "recent"}</small>
                    <em>{request.documents ? Object.values(request.documents).filter(Boolean).length : 0} documente incarcate</em>
                  </div>
                  <button className="secondary-button" type="button">Vezi documente</button>
                  <button className="primary-button" type="button" onClick={() => approveInstitutionRequest(request.email, request.name, request.cif)}>Aproba</button>
                  <button className="secondary-button danger-action" type="button" onClick={() => rejectInstitutionRequest(request.email)}>Respinge</button>
                </div>
              ))}
            </article>
            <article className="institution-approval-card renewal-review">
              <header>
                <span><RefreshCw size={24} /></span>
                <div>
                  <p className="eyebrow">Revalidare anuala</p>
                  <h2>Actualizare documente la 12 luni</h2>
                </div>
              </header>
              <p className="muted">Institutiile trebuie sa actualizeze documentele sau sa confirme ca nu s-a schimbat nimic o data la 12 luni.</p>
              {dueInstitutions.length === 0 ? (
                <p className="empty-state">Toate institutiile sunt in termen.</p>
              ) : dueInstitutions.map((institution) => (
                <div className="renewal-row" key={institution.id}>
                  <Clock3 size={18} />
                  <div>
                    <strong>{institution.name}</strong>
                    <small>Scadent: {institution.nextDocumentReviewDueAt ?? "nesetat"}</small>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => confirmAnnualReview(institution.id)}>Confirma neschimbat</button>
                </div>
              ))}
            </article>
          </section>

          <section className="admin-grid">
            <form className="panel admin-form" onSubmit={handleInstitutionSubmit}>
              <h2>Adauga institutie</h2>
              <label>Denumire<input name="name" placeholder="Primaria ..." required /></label>
              <label>Localitate<input name="locality" placeholder="Localitate" required /></label>
              <label>CIF institutie<input name="cif" placeholder="CIF" required /></label>
              <label>Tip<select name="type" defaultValue="primarie"><option value="primarie">Primarie / UAT</option><option value="institutie">Institutie</option></select></label>
              <button className="primary-button" type="submit">Salveaza institutie</button>
            </form>
            <div className="admin-table panel">
              <div className="admin-user-head institutions-head">
                <span>Institutie</span>
                <span>Localitate</span>
                <span>CIF</span>
                <span>Status</span>
              </div>
              {filteredInstitutions.map((institution) => (
                <article key={institution.id}>
                  <Landmark size={20} />
                  <div>
                    <strong>{institution.name}</strong>
                    <span>{institution.locality} · CIF {institution.cif}</span>
                    <small>Ultima verificare: {institution.lastDocumentReviewAt ?? "nesetat"} · urmatoarea: {institution.nextDocumentReviewDueAt ?? "nesetat"}</small>
                  </div>
                  <span className={`status-chip ${institution.status === "activa" ? "received" : "waiting"}`}>{statusLabel(institution.status)}</span>
                  <button className="secondary-button" type="button" onClick={() => confirmAnnualReview(institution.id)}><FileCheck2 size={16} /> Confirma 12 luni</button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "persons" && (
        <section className="admin-table panel">
          <div className="admin-user-head people-head">
            <span>Persoana</span>
            <span>CNP</span>
            <span>Localitate</span>
            <span>Status</span>
          </div>
          {filteredPersons.map((person) => (
            <article key={person.id}>
              <UserRound size={20} />
              <div><strong>{person.name}</strong><span>CNP {person.cnp} · {person.locality}</span></div>
              <span className={`status-chip ${person.status === "legat" ? "received" : "waiting"}`}>{statusLabel(person.status)}</span>
              <button className="secondary-button" type="button" onClick={() => linkPerson(person.id)}>Leaga dupa CNP</button>
            </article>
          ))}
        </section>
      )}

      {tab === "companies" && (
        <section className="admin-table panel">
          <div className="admin-user-head people-head">
            <span>Companie</span>
            <span>CIF</span>
            <span>Localitate / sediu</span>
            <span>Status</span>
          </div>
          {filteredCompanies.map((company) => (
            <article key={company.id}>
              <Building2 size={20} />
              <div><strong>{company.name}</strong><span>CIF {company.cif} · {company.locality}</span></div>
              <span className={`status-chip ${company.status === "legat" ? "received" : "waiting"}`}>{statusLabel(company.status)}</span>
              <button className="secondary-button" type="button" onClick={() => linkCompany(company.id)}>Leaga dupa CIF</button>
            </article>
          ))}
        </section>
      )}

      {tab === "relations" && (
        <section className="admin-grid">
          <form className="panel admin-form wide" onSubmit={handleDatabaseImport}>
            <Database size={26} />
            <h2>Import baza taxe si impozite</h2>
            <p className="muted">Format demo CSV: tip, identificator, nume. Exemplu: PF,1900101123456,Popescu Ion sau PJ,RO11223344,Acme SRL.</p>
            <label>Institutia sursa<select name="institutionId">{institutions.map((institution) => <option value={institution.id} key={institution.id}>{institution.name}</option>)}</select></label>
            <label>Date import<textarea name="payload" placeholder={"PF,1900101123456,Popescu Ion\nPJ,RO11223344,Acme Construct SRL"} required /></label>
            <button className="primary-button" type="submit"><FileUp size={18} /> Incarca baza locala</button>
          </form>
          <form className="panel admin-form wide" onSubmit={handleManualTaxpayerSubmit}>
            <UserRound size={26} />
            <h2>Adaugare manuala contribuabil</h2>
            <p className="muted">Pentru persoane fizice referinta principala este CNP + localitate/sector/adresa. Pentru companii referinta principala este CIF/CUI + adresa sediului social.</p>
            <label>Tip contribuabil<select name="kind" defaultValue="pf"><option value="pf">Persoana fizica</option><option value="pj">Persoana juridica</option></select></label>
            <label>Institutia<select name="institutionId">{institutions.map((institution) => <option value={institution.id} key={institution.id}>{institution.name}</option>)}</select></label>
            <label>CNP / CIF<input name="identifier" placeholder="CNP sau CIF/CUI" required /></label>
            <label>Nume / Denumire<input name="name" placeholder="Nume persoana sau companie" required /></label>
            <div className="form-grid two">
              <label>Localitate<input name="city" placeholder="Localitate" required /></label>
              <label>Sector<input name="sector" placeholder="Optional" /></label>
            </div>
            <label>Adresa domiciliu / sediu social<input name="address" placeholder="Strada, numar, bloc, apartament" /></label>
            <button className="secondary-button" type="submit">Adauga in baza institutiei</button>
          </form>
          <article className="panel relation-note">
            <Link2 size={28} />
            <h2>Regula de legare</h2>
            <p>Persoanele fizice se leaga de institutii dupa CNP si adresa de domiciliu: localitate, sector si adresa. Persoanele juridice se leaga dupa CIF/CUI si adresa sediului social. Acelasi CNP/CIF poate avea legaturi active cu institutii diferite.</p>
          </article>
        </section>
      )}
    </>
  );
}
