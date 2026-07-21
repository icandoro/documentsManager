export type PlatformInstitution = {
  id: string;
  name: string;
  locality: string;
  cif: string;
  type: "primarie" | "institutie";
  status: "activa" | "in_verificare" | "dezactivata";
  taxpayers: number;
  verificationStatus?: "approved" | "pending_documents" | "renewal_due";
  lastDocumentReviewAt?: string;
  nextDocumentReviewDueAt?: string;
};

export type TaxpayerPerson = {
  id: string;
  name: string;
  cnp: string;
  locality: string;
  institutionId: string;
  status: "legat" | "nelegat";
  linkedUserId?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  ciSeries?: string;
  ciNumber?: string;
  ciIssuedAt?: string;
  birthDate?: string;
  birthPlace?: string;
  country?: string;
  county?: string;
  street?: string;
  streetNumber?: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  accountKind?: "resident" | "property_owner";
};

export type TaxpayerCompany = {
  id: string;
  name: string;
  cif: string;
  locality: string;
  institutionId: string;
  status: "legat" | "nelegat";
  linkedUserId?: string | null;
  phone?: string;
  email?: string;
  country?: string;
  county?: string;
  street?: string;
  streetNumber?: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  accountKind?: "company_hq" | "company_property_owner";
};

export type PlatformUserRole = "user" | "admin" | "superadmin";

export type PlatformUser = {
  id: string;
  databaseId?: number;
  name: string;
  email: string;
  role: PlatformUserRole;
  accountType: "individual" | "company" | "institution";
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  cnp?: string;
  cif?: string;
  phone?: string;
  address?: {
    street: string;
    number: string;
    city: string;
    county: string;
    sector?: string;
    postalCode: string;
  };
  status: "activ" | "in_verificare" | "suspendat";
  linkedInstitutionIds: string[];
  sentCount: number;
  receivedCount: number;
};

export const adminInstitutionsStorageKey = "docmanager_admin_institutions";
export const adminPersonsStorageKey = "docmanager_admin_persons";
export const adminCompaniesStorageKey = "docmanager_admin_companies";
export const adminUsersStorageKey = "docmanager_admin_users";
export const adminSeedVersionStorageKey = "docmanager_admin_seed_version";
export const adminSeedVersion = "db-backed-reset-2026-07-19-v1";

export const defaultPlatformInstitutions: PlatformInstitution[] = [
  {
    id: "primaria-joita",
    name: "Primaria Joita",
    locality: "Joita",
    cif: "12345678",
    type: "primarie",
    status: "activa",
    taxpayers: 12,
    verificationStatus: "approved",
    lastDocumentReviewAt: "2026-07-01",
    nextDocumentReviewDueAt: "2027-07-01",
  },
  {
    id: "primaria-pleasov",
    name: "Primaria Pleasov",
    locality: "Pleasov",
    cif: "87654321",
    type: "primarie",
    status: "activa",
    taxpayers: 5,
    verificationStatus: "approved",
    lastDocumentReviewAt: "2026-07-01",
    nextDocumentReviewDueAt: "2027-07-01",
  },
];

export const defaultTaxpayerPersons: TaxpayerPerson[] = [];

export const defaultTaxpayerCompanies: TaxpayerCompany[] = [];

export const defaultPlatformUsers: PlatformUser[] = [
  {
    id: "user-superadmin",
    name: "Super Administrator",
    email: "superadmin@docmanager.local",
    role: "superadmin",
    accountType: "individual",
    firstName: "Super",
    lastName: "Administrator",
    cnp: "1800101000000",
    phone: "+40 700 000 000",
    address: { street: "Bulevardul Platformei", number: "10", city: "Bucuresti", county: "Bucuresti", sector: "1", postalCode: "010101" },
    status: "activ",
    linkedInstitutionIds: ["primaria-joita", "primaria-pleasov"],
    sentCount: 34,
    receivedCount: 21,
  },
  {
    id: "user-demo-individual",
    name: "Popescu Ion",
    email: "pf.demo@docmanager.local",
    role: "user",
    accountType: "individual",
    firstName: "Ion",
    lastName: "Popescu",
    cnp: "1800101000100",
    phone: "+40 700 000 010",
    address: { street: "Strada Principala", number: "24", city: "Joita", county: "Giurgiu", postalCode: "087150" },
    status: "activ",
    linkedInstitutionIds: ["primaria-joita", "primaria-pleasov"],
    sentCount: 5,
    receivedCount: 9,
  },
  {
    id: "user-demo-company",
    name: "Demo Construct SRL",
    email: "pj.demo@docmanager.local",
    role: "user",
    accountType: "company",
    cif: "RO11223344",
    phone: "+40 700 000 020",
    address: { street: "Strada Fabricii", number: "8", city: "Joita", county: "Giurgiu", postalCode: "087150" },
    status: "activ",
    linkedInstitutionIds: ["primaria-joita"],
    sentCount: 18,
    receivedCount: 14,
  },
  {
    id: "user-demo-institution-joita",
    name: "Primaria Joita",
    email: "primaria.joita@docmanager.local",
    role: "user",
    accountType: "institution",
    cif: "12345678",
    phone: "+40 246 000 100",
    address: { street: "Strada Primariei", number: "1", city: "Joita", county: "Giurgiu", postalCode: "087150" },
    status: "activ",
    linkedInstitutionIds: ["primaria-joita"],
    sentCount: 11,
    receivedCount: 16,
  },
  {
    id: "user-demo-institution-pleasov",
    name: "Primaria Pleasov",
    email: "primaria.pleasov@docmanager.local",
    role: "user",
    accountType: "institution",
    cif: "87654321",
    phone: "+40 246 000 200",
    address: { street: "Strada Primariei", number: "2", city: "Pleasov", county: "Olt", postalCode: "237000" },
    status: "activ",
    linkedInstitutionIds: ["primaria-pleasov"],
    sentCount: 9,
    receivedCount: 12,
  },
];

export const defaultPlatformUserPasswords: Record<string, string> = {
  "superadmin@docmanager.local": "superadmin123",
  "pf.demo@docmanager.local": "demo12345",
  "pj.demo@docmanager.local": "demo12345",
  "primaria.joita@docmanager.local": "demo12345",
  "primaria.pleasov@docmanager.local": "demo12345",
};

export function ensureAdminSeedVersion() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(adminSeedVersionStorageKey) === adminSeedVersion) {
    return;
  }

  [
    adminInstitutionsStorageKey,
    adminPersonsStorageKey,
    adminCompaniesStorageKey,
    adminUsersStorageKey,
    "docmanager_local_accounts",
    "docmanager_token",
    "docmanager_user",
    "docmanager_user_role",
    "docmanager_notifications",
    "docmanager_general_profile",
    "docmanager_pending_registration",
    "docmanager_institution_onboarding",
  ].forEach((key) => window.localStorage.removeItem(key));

  Object.keys(window.localStorage)
    .filter((key) =>
      key.startsWith("docmanager_documents_") ||
      key.startsWith("docmanager_sent_packages_") ||
      key.startsWith("docmanager_received_packages_") ||
      key.startsWith("docmanager_package_templates") ||
      key.startsWith("docmanager_context_profile_") ||
      key.startsWith("docmanager_deleted_received_"),
    )
    .forEach((key) => window.localStorage.removeItem(key));

  window.localStorage.setItem(adminSeedVersionStorageKey, adminSeedVersion);
}

function readStoredList<T>(key: string, fallback: T[]) {
  ensureAdminSeedVersion();
  const saved = window.localStorage.getItem(key);

  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved) as T[];

    if (Array.isArray(parsed)) return parsed;
  } catch {
    window.localStorage.removeItem(key);
  }

  return fallback;
}

export function readPlatformInstitutions() {
  return readStoredList(adminInstitutionsStorageKey, defaultPlatformInstitutions);
}

export function writePlatformInstitutions(items: PlatformInstitution[]) {
  window.localStorage.setItem(adminInstitutionsStorageKey, JSON.stringify(items));
}

export function readTaxpayerPersons() {
  return readStoredList(adminPersonsStorageKey, defaultTaxpayerPersons);
}

export function writeTaxpayerPersons(items: TaxpayerPerson[]) {
  window.localStorage.setItem(adminPersonsStorageKey, JSON.stringify(items));
}

export function readTaxpayerCompanies() {
  return readStoredList(adminCompaniesStorageKey, defaultTaxpayerCompanies);
}

export function writeTaxpayerCompanies(items: TaxpayerCompany[]) {
  window.localStorage.setItem(adminCompaniesStorageKey, JSON.stringify(items));
}

export function readPlatformUsers() {
  return readStoredList(adminUsersStorageKey, defaultPlatformUsers);
}

export function writePlatformUsers(items: PlatformUser[]) {
  window.localStorage.setItem(adminUsersStorageKey, JSON.stringify(items));
}

export function demoUserForEmail(email: string) {
  ensureAdminSeedVersion();

  return defaultPlatformUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function demoPasswordForEmail(email: string) {
  ensureAdminSeedVersion();

  return defaultPlatformUserPasswords[email.toLowerCase()];
}
