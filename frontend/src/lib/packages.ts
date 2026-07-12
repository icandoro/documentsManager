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

  if (normalized.includes("asteapta")) return "waiting";
  if (normalized.includes("semnat")) return "signed";
  if (normalized.includes("primit") || normalized.includes("confirmata")) return "received";
  if (normalized.includes("trimis") || normalized.includes("deschis")) return "sent";

  return "neutral";
}

export function readSentPackages() {
  const saved = window.localStorage.getItem("docmanager_sent_packages");

  if (!saved) return sentPackages;

  try {
    const parsed = JSON.parse(saved) as PackageGroup[];

    if (Array.isArray(parsed)) {
      return [...parsed, ...sentPackages];
    }
  } catch {
    window.localStorage.removeItem("docmanager_sent_packages");
  }

  return sentPackages;
}

export function readReceivedPackages() {
  const saved = window.localStorage.getItem("docmanager_received_packages");

  if (!saved) return receivedPackages as ReceivedPackageGroup[];

  try {
    const parsed = JSON.parse(saved) as ReceivedPackageGroup[];

    if (Array.isArray(parsed)) {
      return [...parsed, ...(receivedPackages as ReceivedPackageGroup[])];
    }
  } catch {
    window.localStorage.removeItem("docmanager_received_packages");
  }

  return receivedPackages as ReceivedPackageGroup[];
}

export function writeReceivedPackages(groups: ReceivedPackageGroup[]) {
  window.localStorage.setItem("docmanager_received_packages", JSON.stringify(groups));
}
