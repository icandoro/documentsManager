import { receivedPackages, sentPackages } from "@/lib/data";

export type PackagePurpose = "send" | "signature";

export type PackageDocumentStatus = "Trimis" | "Asteapta semnare" | "Semnat" | "Primire confirmata";

export type PackageDocument = {
  id?: number;
  title: string;
  category?: string;
  status: PackageDocumentStatus | string;
  signedFile?: string;
  signedAt?: string;
  receivedAt?: string;
  sentAsSingle?: boolean;
};

export type PackageGroup = {
  to: string;
  email: string;
  accountIdentifier?: string;
  packages: Array<{
    name: string;
    date: string;
    purpose?: PackagePurpose;
    documents: Array<string | PackageDocument>;
    status: string;
    singleDocument?: boolean;
  }>;
};

export type ReceivedPackageGroup = {
  from: string;
  email: string;
  packages: PackageGroup["packages"];
};

export function sentPackagesStorageKey(contextId = "independent") {
  return `docmanager_sent_packages_${contextId}`;
}

export function receivedPackagesStorageKey(contextId = "independent") {
  return `docmanager_received_packages_${contextId}`;
}

export function packageDocumentTitle(document: string | PackageDocument) {
  return typeof document === "string" ? document : document.title;
}

export function normalizePackageDocument(document: string | PackageDocument, purpose: PackagePurpose = "send"): PackageDocument {
  if (typeof document !== "string") {
    return {
      ...document,
      status: document.status ?? (purpose === "signature" ? "Asteapta semnare" : "Trimis"),
    };
  }

  return {
    title: document,
    status: purpose === "signature" ? "Asteapta semnare" : "Trimis",
  };
}

export function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("partial")) return "partial";
  if (normalized.includes("asteapta")) return "waiting";
  if (normalized.includes("semnat")) return "signed";
  if (normalized.includes("primit") || normalized.includes("confirmata")) return "received";
  if (normalized.includes("trimis") || normalized.includes("deschis")) return "sent";

  return "neutral";
}

function packageKey(groupEmail: string, packageName: string, date: string) {
  return `${groupEmail}::${packageName}::${date}`;
}

function mergePackageGroups<T extends ReceivedPackageGroup | PackageGroup>(savedGroups: T[], fallbackGroups: T[]) {
  const savedKeys = new Set(
    savedGroups.flatMap((group) =>
      group.packages.map((pkg) => packageKey(group.email, pkg.name, pkg.date)),
    ),
  );
  const filteredFallback = fallbackGroups.map((group) => ({
    ...group,
    packages: group.packages.filter((pkg) => !savedKeys.has(packageKey(group.email, pkg.name, pkg.date))),
  })).filter((group) => group.packages.length > 0);

  return [...savedGroups, ...filteredFallback] as T[];
}

export function readSentPackages(contextId = "independent") {
  const saved = window.localStorage.getItem(sentPackagesStorageKey(contextId));
  const fallback = contextId === "independent" ? sentPackages : [];

  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved) as PackageGroup[];

    if (Array.isArray(parsed)) {
      return mergePackageGroups(parsed, fallback);
    }
  } catch {
    window.localStorage.removeItem(sentPackagesStorageKey(contextId));
  }

  return fallback;
}

export function writeSentPackages(groups: PackageGroup[], contextId = "independent") {
  window.localStorage.setItem(sentPackagesStorageKey(contextId), JSON.stringify(groups));
}

export function readReceivedPackages(contextId = "independent") {
  const saved = window.localStorage.getItem(receivedPackagesStorageKey(contextId));
  const fallback = contextId === "independent" ? receivedPackages as ReceivedPackageGroup[] : [];

  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved) as ReceivedPackageGroup[];

    if (Array.isArray(parsed)) {
      return mergePackageGroups(parsed, fallback);
    }
  } catch {
    window.localStorage.removeItem(receivedPackagesStorageKey(contextId));
  }

  return fallback;
}

export function writeReceivedPackages(groups: ReceivedPackageGroup[], contextId = "independent") {
  window.localStorage.setItem(receivedPackagesStorageKey(contextId), JSON.stringify(groups));
}
