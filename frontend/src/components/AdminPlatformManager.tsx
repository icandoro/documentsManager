"use client";

import Link from "next/link";
import {
  PlatformInstitution,
  PlatformUser,
  readPlatformUsers,
  writePlatformUsers,
} from "@/lib/adminData";
import { apiFetch } from "@/lib/api";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Gavel,
  Landmark,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AdminTab = "admins" | "all-users" | "roles" | "institutions";
type AdminSection = "dashboard" | "users" | "all-users" | "security" | "institutions";
type CapabilityKey =
  | "platform.full"
  | "platform.users.read"
  | "platform.users.write"
  | "platform.roles.write"
  | "platform.institutions.read"
  | "platform.institutions.write"
  | "platform.institutions.approve"
  | "platform.audit.read";

type RolePreset = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  tone: "full" | "edit" | "read" | "review";
  capabilities: CapabilityKey[];
};

type AdminAccessRecord = {
  presetId: string;
  capabilities: CapabilityKey[];
  updatedAt: string;
};

type LocalAccount = {
  email: string;
  password: string;
  user: PlatformUser;
};

type ApiInstitution = PlatformInstitution & {
  email: string;
  documents: Record<string, unknown>;
};

type DirectoryUser = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  accountType: "individual" | "company" | "institution";
  status: "activ" | "in_verificare" | "suspendat";
  locality: string;
  county: string;
  cif: string | null;
  clientCode: string | null;
  linkedInstitutionIds: string[];
  linkedInstitutionNames: string[];
};

type DirectoryInstitutionOption = {
  slug: string;
  name: string;
};

type InstitutionApprovalRequest = {
  id: string;
  name: string;
  email: string;
  cif: string;
  submittedAt?: string;
  documents?: Record<string, unknown>;
};

const localAccountsStorageKey = "docmanager_local_accounts";
const adminAccessStorageKey = "docmanager_platform_admin_access";

const capabilityLabels: Record<CapabilityKey, string> = {
  "platform.full": "Acces complet",
  "platform.users.read": "Citire administratori",
  "platform.users.write": "Editare administratori",
  "platform.roles.write": "Roluri si capabilitati",
  "platform.institutions.read": "Citire institutii",
  "platform.institutions.write": "Activare/dezactivare institutii",
  "platform.institutions.approve": "Aprobare inrolari institutii",
  "platform.audit.read": "Audit si istoric securitate",
};

const rolePresets: RolePreset[] = [
  {
    id: "superadmin_full",
    label: "Superadmin full access",
    shortLabel: "Full access",
    description: "Poate administra intreaga platforma, roluri, institutii si aprobari.",
    tone: "full",
    capabilities: [
      "platform.full",
      "platform.users.read",
      "platform.users.write",
      "platform.roles.write",
      "platform.institutions.read",
      "platform.institutions.write",
      "platform.institutions.approve",
      "platform.audit.read",
    ],
  },
  {
    id: "platform_editor",
    label: "Administrator editare",
    shortLabel: "Editare",
    description: "Poate edita administratori si institutii, fara control total asupra rolurilor critice.",
    tone: "edit",
    capabilities: [
      "platform.users.read",
      "platform.users.write",
      "platform.institutions.read",
      "platform.institutions.write",
      "platform.institutions.approve",
      "platform.audit.read",
    ],
  },
  {
    id: "institution_reviewer",
    label: "Reviewer institutii",
    shortLabel: "Aprobari",
    description: "Verifica documentele de inrolare si aproba sau respinge institutii.",
    tone: "review",
    capabilities: [
      "platform.institutions.read",
      "platform.institutions.approve",
      "platform.audit.read",
    ],
  },
  {
    id: "platform_readonly",
    label: "Citire si audit",
    shortLabel: "Citire",
    description: "Are acces doar la vizualizare si audit, fara modificari.",
    tone: "read",
    capabilities: ["platform.users.read", "platform.institutions.read", "platform.audit.read"],
  },
];

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

function readAdminAccess(): Record<string, AdminAccessRecord> {
  if (typeof window === "undefined") return {};

  try {
    const saved = window.localStorage.getItem(adminAccessStorageKey);
    return saved ? JSON.parse(saved) as Record<string, AdminAccessRecord> : {};
  } catch {
    window.localStorage.removeItem(adminAccessStorageKey);
    return {};
  }
}

function writeAdminAccess(access: Record<string, AdminAccessRecord>) {
  window.localStorage.setItem(adminAccessStorageKey, JSON.stringify(access));
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

function statusLabel(status: PlatformInstitution["status"]) {
  if (status === "activa") return "Activa";
  if (status === "dezactivata") return "Dezactivata";
  return "In verificare";
}

function userStatusLabel(status: PlatformUser["status"]) {
  if (status === "activ") return "Activ";
  if (status === "suspendat") return "Suspendat";
  return "In verificare";
}

function accessFor(user: PlatformUser, access: Record<string, AdminAccessRecord>) {
  const fallback = user.role === "superadmin" ? rolePresets[0] : rolePresets[3];
  const saved = access[user.id];
  const preset = rolePresets.find((item) => item.id === saved?.presetId) ?? fallback;

  return {
    preset,
    capabilities: saved?.capabilities ?? preset.capabilities,
  };
}

function isPlatformAdministrator(user: PlatformUser) {
  return user.role === "admin" || user.role === "superadmin";
}

function directoryAccountTypeLabel(accountType: DirectoryUser["accountType"]) {
  if (accountType === "institution") return "Institutie";
  if (accountType === "company") return "Persoana juridica";
  return "Persoana fizica";
}

function isReviewDue(institution: PlatformInstitution) {
  if (!institution.nextDocumentReviewDueAt) return false;

  return new Date(institution.nextDocumentReviewDueAt) <= new Date();
}

const adminPageCopy: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "Superadmin",
    title: "Dashboard",
    description: "Privire rapida peste administratori, roluri, institutii si aprobari.",
  },
  users: {
    eyebrow: "Administratori",
    title: "Administratori platforma",
    description: "Gestioneaza doar conturile care administreaza platforma.",
  },
  "all-users": {
    eyebrow: "Utilizatori",
    title: "Toti utilizatorii",
    description: "Persoane fizice, persoane juridice si institutii inregistrate, indiferent de institutia la care sunt inrolate.",
  },
  security: {
    eyebrow: "Securitate",
    title: "Roluri si capabilitati",
    description: "Controleaza accesul, drepturile si nivelurile de administrare.",
  },
  institutions: {
    eyebrow: "Institutii",
    title: "Institutii si aprobari",
    description: "Verifica inrolari, activeaza institutii si urmareste revizuirile anuale.",
  },
};

function tabForSection(section: AdminSection): AdminTab {
  if (section === "users") return "admins";
  if (section === "all-users") return "all-users";
  if (section === "security") return "roles";
  return "institutions";
}

export function AdminPlatformManager({ section = "dashboard" }: { section?: AdminSection }) {
  const [role, setRole] = useState("user");
  const [query, setQuery] = useState("");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutionStatus, setInstitutionStatus] = useState("all");
  const [adminPresetFilter, setAdminPresetFilter] = useState("all");
  const [institutions, setInstitutions] = useState<ApiInstitution[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [access, setAccess] = useState<Record<string, AdminAccessRecord>>({});
  const [selectedAdmin, setSelectedAdmin] = useState<PlatformUser | null>(null);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [directoryInstitutions, setDirectoryInstitutions] = useState<DirectoryInstitutionOption[]>([]);
  const [directoryCounties, setDirectoryCounties] = useState<string[]>([]);
  const [directoryLocalities, setDirectoryLocalities] = useState<string[]>([]);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryInstitutionFilter, setDirectoryInstitutionFilter] = useState("all");
  const [directoryAccountTypeFilter, setDirectoryAccountTypeFilter] = useState("all");
  const [directoryCountyFilter, setDirectoryCountyFilter] = useState("all");
  const [directoryLocalityFilter, setDirectoryLocalityFilter] = useState("all");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryTotalPages, setDirectoryTotalPages] = useState(1);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryDetailUser, setDirectoryDetailUser] = useState<DirectoryUser | null>(null);

  async function loadDirectoryUsers() {
    setDirectoryLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(directoryPage),
        limit: "20",
        q: directoryQuery,
        accountType: directoryAccountTypeFilter,
        institution: directoryInstitutionFilter,
        county: directoryCountyFilter,
        locality: directoryLocalityFilter,
      });
      const response = await apiFetch(`/api/platform-admin/all-users?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Eroare la incarcarea utilizatorilor.");
      }

      setDirectoryUsers(data.users ?? []);
      setDirectoryInstitutions(data.institutions ?? []);
      setDirectoryCounties(data.counties ?? []);
      setDirectoryLocalities(data.localities ?? []);
      setDirectoryTotalPages(data.totalPages ?? 1);
      setDirectoryTotal(data.total ?? 0);
      setDirectoryPage(data.page ?? 1);
    } catch {
      toast.error("Nu am putut incarca lista completa de utilizatori.");
    } finally {
      setDirectoryLoading(false);
    }
  }

  async function deletePlatformUser(id: number, label: string) {
    if (!window.confirm(`Sigur vrei sa stergi ${label}? Documentele si datele asociate vor fi sterse definitiv.`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/platform-admin/users/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Stergerea nu a reusit.");
      }

      toast.success(data.message ?? "Contul a fost sters.");
      setDirectoryDetailUser(null);
      await Promise.all([loadDirectoryUsers(), loadInstitutions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stergerea nu a reusit.");
    }
  }

  async function loadInstitutions() {
    try {
      const response = await apiFetch("/api/platform-admin/institutions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message ?? "Eroare la incarcarea institutiilor.");
      }

      const rows: Array<{
        id: number;
        email: string;
        name: string;
        cif: string | null;
        status: string;
        approval?: { updatedAt?: string } | null;
        documents?: Record<string, unknown>;
      }> = data.institutions ?? [];

      const mapped: ApiInstitution[] = rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        locality: "-",
        cif: row.cif ?? "-",
        type: "institutie",
        status: row.status === "activ" ? "activa" : row.status === "suspendat" ? "dezactivata" : "in_verificare",
        taxpayers: 0,
        verificationStatus: row.approval ? "approved" : undefined,
        lastDocumentReviewAt: row.approval?.updatedAt?.slice(0, 10),
        email: row.email,
        documents: row.documents ?? {},
      }));

      setInstitutions(mapped);
    } catch {
      toast.error("Nu am putut incarca institutiile din baza de date.");
    }
  }

  useEffect(() => {
    function sync() {
      setRole(readStoredRole());
      setUsers(mergeUsersWithLocalAccounts(readPlatformUsers()));
      setAccess(readAdminAccess());
    }

    sync();
    loadInstitutions();
    window.addEventListener("storage", sync);

    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    loadDirectoryUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryAccountTypeFilter, directoryCountyFilter, directoryInstitutionFilter, directoryLocalityFilter, directoryPage, directoryQuery]);

  useEffect(() => {
    setDirectoryPage(1);
  }, [directoryAccountTypeFilter, directoryCountyFilter, directoryInstitutionFilter, directoryLocalityFilter, directoryQuery]);

  const isSuperAdmin = role === "superadmin";
  const activeTab = tabForSection(section);
  const pageCopy = adminPageCopy[section];

  const platformAdmins = useMemo(() => users.filter(isPlatformAdministrator), [users]);

  const filteredAdmins = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return platformAdmins.filter((user) => {
      const adminAccess = accessFor(user, access);
      const matchesPreset = adminPresetFilter === "all" || adminAccess.preset.id === adminPresetFilter;
      const matchesQuery = [user.name, user.email, user.role, user.phone ?? "", adminAccess.preset.label]
        .some((value) => value.toLowerCase().includes(normalized));

      return matchesPreset && matchesQuery;
    });
  }, [access, adminPresetFilter, platformAdmins, query]);

  const filteredInstitutions = useMemo(() => {
    const normalized = institutionQuery.trim().toLowerCase();

    return institutions.filter((institution) => {
      const matchesStatus = institutionStatus === "all" || institution.status === institutionStatus;
      const matchesQuery = [institution.name, institution.locality, institution.cif, institution.type]
        .some((value) => value.toLowerCase().includes(normalized));

      return matchesStatus && matchesQuery;
    });
  }, [institutionQuery, institutionStatus, institutions]);

  const pendingInstitutionRequests = useMemo<InstitutionApprovalRequest[]>(() => {
    return institutions
      .filter((institution) => institution.status === "in_verificare")
      .map((institution) => ({
        id: institution.id,
        name: institution.name,
        email: institution.email,
        cif: institution.cif,
        documents: institution.documents,
      }));
  }, [institutions]);

  const dueInstitutions = useMemo(() => {
    return institutions.filter((institution) => isReviewDue(institution) || institution.verificationStatus === "renewal_due");
  }, [institutions]);

  function persistUsers(nextUsers: PlatformUser[]) {
    setUsers(nextUsers);
    writePlatformUsers(nextUsers);
  }

  function updateAdminPreset(userId: string, presetId: string) {
    const preset = rolePresets.find((item) => item.id === presetId) ?? rolePresets[3];
    const nextAccess = {
      ...access,
      [userId]: {
        presetId: preset.id,
        capabilities: preset.capabilities,
        updatedAt: new Date().toISOString(),
      },
    };
    const nextUsers = users.map((user) => user.id === userId
      ? { ...user, role: preset.id === "superadmin_full" ? "superadmin" as const : "admin" as const }
      : user,
    );

    setAccess(nextAccess);
    writeAdminAccess(nextAccess);
    persistUsers(nextUsers);
    setSelectedAdmin((current) => current?.id === userId ? nextUsers.find((user) => user.id === userId) ?? null : current);
    toast.success("Rolul administratorului a fost actualizat.");
  }

  function updateAdminStatus(userId: string, status: PlatformUser["status"]) {
    const nextUsers = users.map((user) => user.id === userId ? { ...user, status } : user);

    persistUsers(nextUsers);
    setSelectedAdmin((current) => current?.id === userId ? { ...current, status } : current);
    toast.success("Statusul administratorului a fost actualizat.");
  }

  function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const presetId = String(form.get("presetId") ?? "platform_readonly");
    const preset = rolePresets.find((item) => item.id === presetId) ?? rolePresets[3];

    if (!name || !email) return;
    if (users.some((user) => user.email.toLowerCase() === email)) {
      toast.error("Exista deja un cont cu acest email.");
      return;
    }

    const nextAdmin: PlatformUser = {
      id: `platform-admin-${Date.now()}`,
      name,
      email,
      role: preset.id === "superadmin_full" ? "superadmin" : "admin",
      accountType: "individual",
      status: "activ",
      linkedInstitutionIds: [],
      sentCount: 0,
      receivedCount: 0,
    };
    const nextUsers = [nextAdmin, ...users];
    const nextAccess = {
      ...access,
      [nextAdmin.id]: {
        presetId: preset.id,
        capabilities: preset.capabilities,
        updatedAt: new Date().toISOString(),
      },
    };

    persistUsers(nextUsers);
    setAccess(nextAccess);
    writeAdminAccess(nextAccess);
    setIsAddAdminOpen(false);
    toast.success("Administratorul platformei a fost creat.");
  }

  async function updateInstitutionStatus(institutionId: string, status: "activ" | "in_verificare" | "suspendat") {
    const response = await apiFetch(`/api/platform-admin/institutions/${institutionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.message ?? "Nu am putut actualiza statusul institutiei.");
      return false;
    }

    await loadInstitutions();
    return true;
  }

  async function approveInstitutionRequest(institutionId: string) {
    if (await updateInstitutionStatus(institutionId, "activ")) {
      toast.success("Institutia a fost aprobata si contul este activ.");
    }
  }

  async function rejectInstitutionRequest(institutionId: string) {
    if (await updateInstitutionStatus(institutionId, "suspendat")) {
      toast.info("Solicitarea institutiei a fost respinsa si contul a fost suspendat.");
    }
  }

  async function toggleInstitutionStatus(institutionId: string) {
    const current = institutions.find((institution) => institution.id === institutionId);
    if (!current) return;

    const nextStatus = current.status === "activa" ? "suspendat" : "activ";

    if (await updateInstitutionStatus(institutionId, nextStatus)) {
      toast.success(nextStatus === "activ" ? "Institutia a fost activata." : "Institutia a fost dezactivata.");
    }
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
    toast.success("Revizuirea anuala a fost confirmata pentru urmatoarele 12 luni.");
  }

  if (!isSuperAdmin) {
    return (
      <section className="approval-panel">
        <ShieldAlert size={36} />
        <h1>Acces restrictionat</h1>
        <p>Administrarea platformei este disponibila doar pentru conturile superadmin.</p>
      </section>
    );
  }

  return (
    <>
      <section className="enterprise-page-head superadmin-head">
        <div>
          <p className="eyebrow">{pageCopy.eyebrow}</p>
          <h1>{pageCopy.title}</h1>
          <p>{pageCopy.description}</p>
        </div>
      </section>

      <section className="admin-overview-stats superadmin-stats">
        <article>
          <div className="admin-stat-icon"><UserCog size={22} /></div>
          <span>Administratori</span>
          <strong>{platformAdmins.length}</strong>
          <p>Doar administratori platforma</p>
        </article>
        <article>
          <div className="admin-stat-icon cool"><Shield size={22} /></div>
          <span>Roluri definite</span>
          <strong>{rolePresets.length}</strong>
          <p>Full access, editare, citire</p>
        </article>
        <article>
          <div className="admin-stat-icon warm"><Landmark size={22} /></div>
          <span>Institutii</span>
          <strong>{institutions.length}</strong>
          <p>{institutions.filter((item) => item.status === "activa").length} active</p>
        </article>
        <article>
          <div className="admin-stat-icon alert"><Gavel size={22} /></div>
          <span>Aprobari</span>
          <strong>{pendingInstitutionRequests.length + dueInstitutions.length}</strong>
          <p>Inrolari si revizuiri 12 luni</p>
        </article>
      </section>

      {section === "dashboard" && (
        <section className="superadmin-dashboard-grid">
          <Link className="panel superadmin-dashboard-card" href="/admin/utilizatori">
            <span className="admin-stat-icon"><UserCog size={22} /></span>
            <div>
              <p className="eyebrow">Utilizatori</p>
              <h2>Administratori platforma</h2>
              <span>{platformAdmins.length} conturi cu acces administrativ.</span>
            </div>
          </Link>
          <Link className="panel superadmin-dashboard-card" href="/admin/securitate">
            <span className="admin-stat-icon cool"><LockKeyhole size={22} /></span>
            <div>
              <p className="eyebrow">Securitate</p>
              <h2>Roluri si capabilitati</h2>
              <span>{rolePresets.length} roluri predefinite pentru acces platforma.</span>
            </div>
          </Link>
          <Link className="panel superadmin-dashboard-card" href="/admin/institutii">
            <span className="admin-stat-icon warm"><Landmark size={22} /></span>
            <div>
              <p className="eyebrow">Institutii</p>
              <h2>Aprobari si activare</h2>
              <span>{pendingInstitutionRequests.length} solicitari in asteptare, {dueInstitutions.length} revizuiri.</span>
            </div>
          </Link>
          <article className="panel superadmin-dashboard-card">
            <span className="admin-stat-icon alert"><BarChart3 size={22} /></span>
            <div>
              <p className="eyebrow">Audit</p>
              <h2>Activitate platforma</h2>
              <span>Ultimele modificari de roluri si institutii raman urmaribile in zona de securitate.</span>
            </div>
          </article>
        </section>
      )}

      {section !== "dashboard" && activeTab === "admins" && (
        <section className="panel superadmin-panel">
          <header className="admin-section-head">
            <div>
              <p className="eyebrow">Securitate platforma</p>
              <h2>Administratori platforma</h2>
              <span>Sunt listate doar conturile care administreaza platforma, nu utilizatorii institutiilor.</span>
            </div>
            <button className="primary-button admin-action-button" type="button" onClick={() => setIsAddAdminOpen(true)}>
              <UserPlus size={18} />
              Adauga administrator
            </button>
          </header>

          <div className="admin-table-toolbar superadmin-toolbar">
            <label className="admin-table-search clean-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta administrator, email sau rol" />
            </label>
            <select value={adminPresetFilter} onChange={(event) => setAdminPresetFilter(event.target.value)}>
              <option value="all">Toate rolurile</option>
              {rolePresets.map((preset) => (
                <option value={preset.id} key={preset.id}>{preset.shortLabel}</option>
              ))}
            </select>
            <button className="icon-button" type="button" aria-label="Filtre"><SlidersHorizontal size={18} /></button>
            <button className="icon-button" type="button" aria-label="Export"><Download size={18} /></button>
          </div>

          <div className="admin-security-list">
            {filteredAdmins.map((admin) => {
              const adminAccess = accessFor(admin, access);

              return (
                <article className="admin-security-row" key={admin.id}>
                  <span className={`admin-avatar-chip ${admin.role === "superadmin" ? "super" : ""}`}>
                    {admin.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="admin-identity">
                    <strong>{admin.name}</strong>
                    <span>{admin.email}</span>
                    <small>{admin.phone ?? "Telefon nesetat"}</small>
                  </div>
                  <span className={`admin-role-badge tone-${adminAccess.preset.tone}`}>{adminAccess.preset.shortLabel}</span>
                  <span className={`admin-status-pill ${admin.status === "activ" ? "active" : "inactive"}`}>{userStatusLabel(admin.status)}</span>
                  <div className="capability-preview">
                    {adminAccess.capabilities.slice(0, 3).map((capability) => (
                      <em key={capability}>{capabilityLabels[capability]}</em>
                    ))}
                    {adminAccess.capabilities.length > 3 && <em>+{adminAccess.capabilities.length - 3}</em>}
                  </div>
                  <button className="secondary-button" type="button" onClick={() => setSelectedAdmin(admin)}>
                    <MoreVertical size={18} />
                    Detalii
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {section !== "dashboard" && activeTab === "all-users" && (
        <section className="panel superadmin-panel">
          <header className="admin-section-head">
            <div>
              <p className="eyebrow">Toata platforma</p>
              <h2>Toti utilizatorii</h2>
              <span>{directoryTotal} conturi &middot; persoane fizice, persoane juridice si institutii, indiferent de institutia la care sunt inrolate.</span>
            </div>
          </header>

          <div className="directory-filter-bar">
            <label className="admin-table-search clean-search directory-filter-search">
              <Search size={18} />
              <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Cauta utilizator, email, cod client sau institutie" />
            </label>
            <label className="directory-filter-field">
              <span>Institutie</span>
              <select value={directoryInstitutionFilter} onChange={(event) => setDirectoryInstitutionFilter(event.target.value)}>
                <option value="all">Toate conturile</option>
                <option value="independent">Independent</option>
                {directoryInstitutions.map((institution) => (
                  <option value={institution.slug} key={institution.slug}>{institution.name}</option>
                ))}
              </select>
            </label>
            <label className="directory-filter-field">
              <span>Tip cont</span>
              <select value={directoryAccountTypeFilter} onChange={(event) => setDirectoryAccountTypeFilter(event.target.value)}>
                <option value="all">Toate tipurile</option>
                <option value="individual">Persoana fizica</option>
                <option value="company">Persoana juridica</option>
                <option value="institution">Institutie</option>
              </select>
            </label>
            <label className="directory-filter-field">
              <span>Judet</span>
              <select value={directoryCountyFilter} onChange={(event) => setDirectoryCountyFilter(event.target.value)}>
                <option value="all">Toate judetele</option>
                {directoryCounties.map((county) => <option value={county} key={county}>{county}</option>)}
              </select>
            </label>
            <label className="directory-filter-field">
              <span>Localitate</span>
              <select value={directoryLocalityFilter} onChange={(event) => setDirectoryLocalityFilter(event.target.value)}>
                <option value="all">Toate localitatile</option>
                {directoryLocalities.map((locality) => <option value={locality} key={locality}>{locality}</option>)}
              </select>
            </label>
          </div>

          <div className="admin-security-list">
            {directoryLoading && <p className="empty-state">Se incarca...</p>}
            {!directoryLoading && directoryUsers.map((user) => (
              <article className="admin-security-row" key={user.id}>
                <span className={`admin-avatar-chip ${user.accountType === "institution" ? "institution" : ""}`}>
                  {user.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="admin-identity">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>{user.linkedInstitutionNames.length > 0 ? user.linkedInstitutionNames.join(", ") : "Independent"}</small>
                  {(user.locality || user.county) && (
                    <small>{[user.locality, user.county].filter(Boolean).join(", ")}</small>
                  )}
                </div>
                <span className="admin-role-badge tone-read">{directoryAccountTypeLabel(user.accountType)}</span>
                <span className={`admin-status-pill ${user.status === "activ" ? "active" : "inactive"}`}>{userStatusLabel(user.status)}</span>
                <button className="secondary-button" type="button" onClick={() => setDirectoryDetailUser(user)}>
                  <MoreVertical size={18} />
                  Detalii
                </button>
              </article>
            ))}
            {!directoryLoading && directoryUsers.length === 0 && <p className="empty-state">Niciun utilizator nu corespunde filtrelor curente.</p>}
          </div>

          {directoryTotalPages > 1 && (
            <div className="institution-pagination institution-list-pagination">
              <span>Pagina {directoryPage} din {directoryTotalPages}</span>
              <div className="pagination-controls">
                <button type="button" onClick={() => setDirectoryPage((current) => Math.max(1, current - 1))} disabled={directoryPage <= 1}>Anterior</button>
                <button type="button" onClick={() => setDirectoryPage((current) => Math.min(directoryTotalPages, current + 1))} disabled={directoryPage >= directoryTotalPages}>Urmator</button>
              </div>
            </div>
          )}
        </section>
      )}

      {section !== "dashboard" && activeTab === "roles" && (
        <section className="superadmin-role-grid">
          {rolePresets.map((preset) => (
            <article className={`role-preset-card tone-${preset.tone}`} key={preset.id}>
              <header>
                <span><Shield size={20} /></span>
                <div>
                  <h2>{preset.label}</h2>
                  <p>{preset.description}</p>
                </div>
              </header>
              <div className="capability-list">
                {Object.keys(capabilityLabels).map((capability) => {
                  const key = capability as CapabilityKey;
                  const enabled = preset.capabilities.includes(key);

                  return (
                    <span className={enabled ? "enabled" : ""} key={key}>
                      <CheckCircle2 size={16} />
                      {capabilityLabels[key]}
                    </span>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}

      {section !== "dashboard" && activeTab === "institutions" && (
        <section className="superadmin-institutions">
          <section className="panel superadmin-panel">
            <header className="admin-section-head">
              <div>
                <p className="eyebrow">Institutii platforma</p>
                <h2>Lista institutii</h2>
                <span>Filtreaza institutiile, activeaza sau dezactiveaza accesul lor in platforma.</span>
              </div>
            </header>
            <div className="admin-table-toolbar superadmin-toolbar">
              <label className="admin-table-search clean-search">
                <Search size={18} />
                <input value={institutionQuery} onChange={(event) => setInstitutionQuery(event.target.value)} placeholder="Cauta institutie, localitate sau CIF" />
              </label>
              <select value={institutionStatus} onChange={(event) => setInstitutionStatus(event.target.value)}>
                <option value="all">Toate statusurile</option>
                <option value="activa">Active</option>
                <option value="in_verificare">In verificare</option>
                <option value="dezactivata">Dezactivate</option>
              </select>
            </div>
            <div className="admin-security-list institution-list">
              {filteredInstitutions.map((institution) => (
                <article className="admin-security-row" key={institution.id}>
                  <span className="admin-avatar-chip institution"><Building2 size={20} /></span>
                  <div className="admin-identity">
                    <strong>{institution.name}</strong>
                    <span>{institution.locality} · CIF {institution.cif}</span>
                    <small>Ultima verificare: {institution.lastDocumentReviewAt ?? "nesetat"} · urmatoarea: {institution.nextDocumentReviewDueAt ?? "nesetat"}</small>
                  </div>
                  <span className={`admin-status-pill ${institution.status === "activa" ? "active" : "inactive"}`}>{statusLabel(institution.status)}</span>
                  <span className="admin-role-badge tone-review">{institution.verificationStatus === "approved" ? "Aprobata" : institution.verificationStatus === "renewal_due" ? "Revizuire" : "Documente"}</span>
                  <button className="secondary-button" type="button" onClick={() => toggleInstitutionStatus(institution.id)}>
                    {institution.status === "activa" ? "Dezactiveaza" : "Activeaza"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => confirmAnnualReview(institution.id)}>
                    Confirma 12 luni
                  </button>
                  <button
                    className="secondary-button danger-action"
                    type="button"
                    aria-label={`Sterge institutia ${institution.name}`}
                    onClick={() => deletePlatformUser(Number(institution.id), institution.name)}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <article className="panel institution-approval-card primary-review">
            <header>
              <span><ShieldAlert size={22} /></span>
              <div>
                <p className="eyebrow">Aprobari institutii</p>
                <h2>Documente de inrolare primite</h2>
              </div>
            </header>
            {pendingInstitutionRequests.length === 0 ? (
              <p className="empty-state">Nu exista institutii in asteptare.</p>
            ) : pendingInstitutionRequests.map((request) => (
              <div className="institution-request-row" key={request.id}>
                <span className="admin-avatar-chip">{request.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{request.name}</strong>
                  <small>{request.email} · CIF {request.cif} · {request.submittedAt ? new Date(request.submittedAt).toLocaleDateString("ro-RO") : "trimis recent"}</small>
                  <em>{request.documents ? Object.values(request.documents).filter(Boolean).length : 0} documente incarcate pentru inrolare</em>
                </div>
                <button className="secondary-button" type="button"><Eye size={16} /> Vezi documente</button>
                <button className="primary-button" type="button" onClick={() => approveInstitutionRequest(request.id)}>Aproba</button>
                <button className="secondary-button danger-action" type="button" onClick={() => rejectInstitutionRequest(request.id)}>Respinge</button>
              </div>
            ))}
          </article>

          <article className="panel institution-approval-card renewal-review">
            <header>
              <span><Clock3 size={22} /></span>
              <div>
                <p className="eyebrow">Revizuire periodica</p>
                <h2>Actualizare documente la 12 luni</h2>
              </div>
            </header>
            <p className="muted">Institutiile trebuie sa actualizeze documentele sau sa confirme ca nu s-a schimbat nimic o data la 12 luni.</p>
            {dueInstitutions.length === 0 ? (
              <p className="empty-state">Toate institutiile sunt in termen.</p>
            ) : dueInstitutions.map((institution) => (
              <div className="renewal-row" key={institution.id}>
                <FileCheck2 size={18} />
                <div>
                  <strong>{institution.name}</strong>
                  <small>Scadent: {institution.nextDocumentReviewDueAt ?? "nesetat"}</small>
                </div>
                <button className="secondary-button" type="button" onClick={() => confirmAnnualReview(institution.id)}>Confirma neschimbat</button>
              </div>
            ))}
          </article>
        </section>
      )}

      {selectedAdmin && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Administrator ${selectedAdmin.name}`}>
          <div className="modal-panel admin-profile-modal admin-access-modal">
            <header className="modal-head">
              <div>
                <p className="eyebrow">Administrator platforma</p>
                <h2>{selectedAdmin.name}</h2>
                <p>{selectedAdmin.email}</p>
              </div>
              <button className="modal-close" type="button" aria-label="Inchide" onClick={() => setSelectedAdmin(null)}><X size={20} /></button>
            </header>
            <div className="profile-modal-stats">
              <span><Shield size={17} /><strong>{accessFor(selectedAdmin, access).preset.shortLabel}</strong> rol curent</span>
              <span><LockKeyhole size={17} /><strong>{accessFor(selectedAdmin, access).capabilities.length}</strong> capabilitati</span>
              <span className={`status-chip ${selectedAdmin.status === "activ" ? "received" : "neutral"}`}>{userStatusLabel(selectedAdmin.status)}</span>
            </div>
            <div className="profile-admin-controls admin-access-controls">
              <label className="compact-select">Rol de securitate
                <select value={accessFor(selectedAdmin, access).preset.id} onChange={(event) => updateAdminPreset(selectedAdmin.id, event.target.value)}>
                  {rolePresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
                </select>
              </label>
              <label className="compact-select">Status cont
                <select value={selectedAdmin.status} onChange={(event) => updateAdminStatus(selectedAdmin.id, event.target.value as PlatformUser["status"])}>
                  <option value="activ">Activ</option>
                  <option value="in_verificare">In verificare</option>
                  <option value="suspendat">Suspendat</option>
                </select>
              </label>
            </div>
            <div className="capability-modal-grid">
              {Object.entries(capabilityLabels).map(([key, label]) => {
                const enabled = accessFor(selectedAdmin, access).capabilities.includes(key as CapabilityKey);

                return (
                  <span className={enabled ? "enabled" : ""} key={key}>
                    <CheckCircle2 size={16} />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {isAddAdminOpen && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Adauga administrator platforma">
          <form className="modal-panel admin-profile-modal admin-access-modal" onSubmit={handleCreateAdmin}>
            <header className="modal-head">
              <div>
                <p className="eyebrow">Administrator nou</p>
                <h2>Adauga administrator platforma</h2>
                <p>Acest cont va administra platforma, nu o institutie.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Inchide" onClick={() => setIsAddAdminOpen(false)}><X size={20} /></button>
            </header>
            <div className="form-grid two admin-modal-form">
              <label>Nume administrator
                <input name="name" placeholder="Ex: Ionescu Ana" required />
              </label>
              <label>Email
                <input name="email" placeholder="admin@docmanager.ro" type="email" required />
              </label>
              <label>Rol initial
                <select name="presetId" defaultValue="platform_readonly">
                  {rolePresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
                </select>
              </label>
            </div>
            <button className="primary-button admin-action-button" type="submit">
              <Plus size={18} />
              Creeaza administrator
            </button>
          </form>
        </section>
      )}

      {directoryDetailUser && (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Detalii ${directoryDetailUser.name}`}>
          <div className="modal-panel admin-profile-modal directory-detail-modal">
            <header className="modal-head">
              <div>
                <p className="eyebrow">{directoryAccountTypeLabel(directoryDetailUser.accountType)}</p>
                <h2>{directoryDetailUser.name}</h2>
                <p>{directoryDetailUser.email}</p>
              </div>
              <button className="modal-close" type="button" aria-label="Inchide" onClick={() => setDirectoryDetailUser(null)}><X size={20} /></button>
            </header>
            <div className="profile-modal-stats">
              <span className={`status-chip ${directoryDetailUser.status === "activ" ? "received" : "neutral"}`}>{userStatusLabel(directoryDetailUser.status)}</span>
              {directoryDetailUser.clientCode && <span>Cod client <strong>#{directoryDetailUser.clientCode}</strong></span>}
              {directoryDetailUser.cif && <span>CIF <strong>{directoryDetailUser.cif}</strong></span>}
            </div>
            <div className="directory-detail-grid">
              <span>Telefon <strong>{directoryDetailUser.phone ?? "nesetat"}</strong></span>
              <span>Localitate <strong>{directoryDetailUser.locality || "nesetata"}</strong></span>
              <span>Judet <strong>{directoryDetailUser.county || "nesetat"}</strong></span>
              <span>Institutie <strong>{directoryDetailUser.linkedInstitutionNames.length > 0 ? directoryDetailUser.linkedInstitutionNames.join(", ") : "Independent"}</strong></span>
            </div>
            <div className="taxpayer-modal-actions">
              <button className="secondary-button" type="button" disabled title="Editarea va fi disponibila intr-o versiune viitoare">
                <Pencil size={16} /> Editeaza
              </button>
              <button
                className="secondary-button danger-action"
                type="button"
                onClick={() => deletePlatformUser(directoryDetailUser.id, directoryDetailUser.name)}
              >
                <Trash2 size={16} /> Sterge contul
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
