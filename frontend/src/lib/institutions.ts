export type AccountContextType = "independent" | "city_hall" | "institution";

export type AccountContext = {
  id: string;
  name: string;
  type: AccountContextType;
  locality?: string;
  identifier?: string;
  address?: string;
};

export const accountContextsStorageKey = "docmanager_account_contexts";
export const activeAccountContextStorageKey = "docmanager_active_account_context";

export const defaultAccountContexts: AccountContext[] = [
  {
    id: "independent",
    name: "Activitate independenta",
    type: "independent",
    locality: "Fara institutie",
  },
  {
    id: "primaria-joita",
    name: "Primaria Joita",
    type: "city_hall",
    locality: "Joita",
    identifier: "UAT-JOITA",
  },
  {
    id: "primaria-pleasov",
    name: "Primaria Pleasov",
    type: "city_hall",
    locality: "Pleasov",
    identifier: "UAT-PLEASOV",
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
  const saved = window.localStorage.getItem(activeAccountContextStorageKey);
  const fallback = contexts[0]?.id ?? "independent";

  return contexts.some((context) => context.id === saved) ? saved ?? fallback : fallback;
}

export function writeActiveAccountContextId(id: string) {
  window.localStorage.setItem(activeAccountContextStorageKey, id);
  window.dispatchEvent(new Event("docmanager-account-context-change"));
}
