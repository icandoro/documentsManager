import { AccountContext } from "@/lib/institutions";

export type GeneralProfileData = {
  firstName: string;
  lastName: string;
  cnp: string;
  phone: string;
  email: string;
  language: string;
  timezone: string;
  accountType: string;
};

export type ContextProfileData = {
  correspondenceAddress: string;
  county: string;
  locality: string;
  postalCode: string;
  fiscalRole: string;
  fileNumber: string;
  communicationPreference: string;
  notes: string;
};

export const generalProfileStorageKey = "docmanager_profile_general";
export const contextProfileStoragePrefix = "docmanager_profile_context";

function splitDisplayName(name?: string) {
  const parts = (name ?? "Popescu Ion").trim().split(/\s+/);

  return {
    firstName: parts.slice(1).join(" ") || "Ion",
    lastName: parts[0] || "Popescu",
  };
}

export function defaultGeneralProfile(): GeneralProfileData {
  if (typeof window === "undefined") {
    return {
      firstName: "Ion",
      lastName: "Popescu",
      cnp: "1750520123456",
      phone: "+40 700 000 000",
      email: "pf.demo@docmanager.local",
      language: "ro",
      timezone: "Europe/Bucharest",
      accountType: "individual",
    };
  }

  const savedUser = window.localStorage.getItem("docmanager_user");

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser) as {
        name?: string;
        email?: string;
        cnp?: string;
        phone?: string;
        accountType?: string;
      };
      const name = splitDisplayName(user.name);

      return {
        firstName: name.firstName,
        lastName: name.lastName,
        cnp: user.cnp ?? "1750520123456",
        phone: user.phone ?? "+40 700 000 000",
        email: user.email ?? "pf.demo@docmanager.local",
        language: "ro",
        timezone: "Europe/Bucharest",
        accountType: user.accountType ?? "individual",
      };
    } catch {
      window.localStorage.removeItem("docmanager_user");
    }
  }

  return {
    firstName: "Ion",
    lastName: "Popescu",
    cnp: "1750520123456",
    phone: "+40 700 000 000",
    email: "pf.demo@docmanager.local",
    language: "ro",
    timezone: "Europe/Bucharest",
    accountType: "individual",
  };
}

export function contextProfileStorageKey(contextId: string) {
  return `${contextProfileStoragePrefix}_${contextId}`;
}

export function defaultContextProfile(context: AccountContext): ContextProfileData {
  return {
    correspondenceAddress: context.address ?? "",
    county: "",
    locality: context.locality ?? "",
    postalCode: "",
    fiscalRole: context.type === "independent" ? "Activitate independenta" : "Contribuabil in evidenta institutiei",
    fileNumber: context.identifier ?? "",
    communicationPreference: "platforma",
    notes: "",
  };
}

export function readGeneralProfile() {
  const saved = window.localStorage.getItem(generalProfileStorageKey);

  if (!saved) return defaultGeneralProfile();

  try {
    return { ...defaultGeneralProfile(), ...(JSON.parse(saved) as Partial<GeneralProfileData>) };
  } catch {
    window.localStorage.removeItem(generalProfileStorageKey);
    return defaultGeneralProfile();
  }
}

export function writeGeneralProfile(profile: GeneralProfileData) {
  window.localStorage.setItem(generalProfileStorageKey, JSON.stringify(profile));
}

export function readContextProfile(context: AccountContext) {
  const saved = window.localStorage.getItem(contextProfileStorageKey(context.id));

  if (!saved) return defaultContextProfile(context);

  try {
    return { ...defaultContextProfile(context), ...(JSON.parse(saved) as Partial<ContextProfileData>) };
  } catch {
    window.localStorage.removeItem(contextProfileStorageKey(context.id));
    return defaultContextProfile(context);
  }
}

export function writeContextProfile(contextId: string, profile: ContextProfileData) {
  window.localStorage.setItem(contextProfileStorageKey(contextId), JSON.stringify(profile));
}
