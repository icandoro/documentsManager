export type AccountContextType = "independent" | "city_hall" | "institution";

export type AccountContext = {
  id: string;
  name: string;
  type: AccountContextType;
  locality?: string;
  identifier?: string;
  address?: string;
  enrollmentStatus?: "active" | "pending";
};

export const accountContextsStorageKey = "docmanager_account_contexts";
export const activeAccountContextStorageKey = "docmanager_active_account_context";

export const defaultAccountContexts: AccountContext[] = [
  {
    id: "independent",
    name: "Activitate independenta",
    type: "independent",
    locality: "Fara institutie",
    enrollmentStatus: "active",
  },
  {
    id: "primaria-joita",
    name: "Primaria Joita",
    type: "city_hall",
    locality: "Joita",
    identifier: "UAT-JOITA",
    enrollmentStatus: "active",
  },
  {
    id: "primaria-pleasov",
    name: "Primaria Pleasov",
    type: "city_hall",
    locality: "Pleasov",
    identifier: "UAT-PLEASOV",
    enrollmentStatus: "active",
  },
];

export function readAccountContexts() {
  const saved = window.localStorage.getItem(accountContextsStorageKey);

  if (!saved) return defaultAccountContexts;

  try {
    const parsed = JSON.parse(saved) as AccountContext[];

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(accountContextsStorageKey);
  }

  return defaultAccountContexts;
}

export function writeAccountContexts(contexts: AccountContext[]) {
  window.localStorage.setItem(accountContextsStorageKey, JSON.stringify(contexts));
}

export function readActiveAccountContextId(contexts: AccountContext[]) {
  if (typeof window === "undefined") return contexts[0]?.id ?? "independent";

  const saved = window.localStorage.getItem(activeAccountContextStorageKey);
  const fallback = contexts[0]?.id ?? "independent";

  return contexts.some((context) => context.id === saved) ? saved ?? fallback : fallback;
}

export function writeActiveAccountContextId(id: string) {
  window.localStorage.setItem(activeAccountContextStorageKey, id);
  window.dispatchEvent(new Event("docmanager-account-context-change"));
}

export type ContextAwareUser = {
  accountType?: string;
  linkedInstitutionIds?: string[];
} | null | undefined;

export function resolveActiveContextIdForUser(user?: ContextAwareUser) {
  const contexts = readAccountContexts();
  const activeContextId = readActiveAccountContextId(contexts);

  if (user?.accountType === "institution") {
    if (user.linkedInstitutionIds?.includes(activeContextId)) {
      return activeContextId;
    }

    return user.linkedInstitutionIds?.[0] ?? activeContextId;
  }

  return activeContextId;
}
