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
  institutionId?: number | string | null;
  linkedInstitutionIds?: string[];
} | null | undefined;

export type RealInstitutionSummary = {
  id: string;
  name: string;
  locality?: string;
  county?: string;
};

export type LinkedInstitutionsUser = {
  accountType?: string;
  linkedInstitutionIds?: string[];
  requestedInstitutionIds?: string[];
} | null | undefined;

/**
 * Builds the account-context switcher list purely from real backend data
 * (the user's confirmed/requested institution links + the real institutions
 * list), replacing the old hardcoded demo contexts.
 */
export function buildContextsFromLinkedInstitutions(
  user: LinkedInstitutionsUser,
  realInstitutions: RealInstitutionSummary[],
): AccountContext[] {
  const independent: AccountContext = {
    id: "independent",
    name: "Activitate independenta",
    type: "independent",
    locality: "Fara institutie",
    enrollmentStatus: "active",
  };

  const linkedIds = user?.linkedInstitutionIds ?? [];
  const requestedIds = (user?.requestedInstitutionIds ?? []).filter((id) => !linkedIds.includes(id));

  const institutionContexts: AccountContext[] = [...linkedIds, ...requestedIds].map((id) => {
    const match = realInstitutions.find((institution) => institution.id === id);

    return {
      id,
      name: match?.name ?? id,
      type: "institution",
      locality: match?.locality ?? "",
      enrollmentStatus: linkedIds.includes(id) ? "active" : "pending",
    };
  });

  return [independent, ...institutionContexts];
}

export function syncContextsFromLinkedInstitutions(
  user: LinkedInstitutionsUser,
  realInstitutions: RealInstitutionSummary[],
) {
  const contexts = buildContextsFromLinkedInstitutions(user, realInstitutions);

  writeAccountContexts(contexts);
  window.dispatchEvent(new Event("docmanager-account-context-change"));

  return contexts;
}

export function resolveActiveContextIdForUser(user?: ContextAwareUser) {
  const contexts = readAccountContexts();
  const activeContextId = readActiveAccountContextId(contexts);

  if (user?.accountType === "institution") {
    return user.institutionId != null ? String(user.institutionId) : activeContextId;
  }

  return activeContextId;
}
