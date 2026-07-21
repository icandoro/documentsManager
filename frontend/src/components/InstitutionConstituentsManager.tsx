"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Building2, CheckCircle2, Download, FileInput, FileOutput, FileSpreadsheet, FileText, FileUp, PlusCircle, Search, UploadCloud, UserRound, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  PlatformInstitution,
  TaxpayerCompany,
  TaxpayerPerson,
  readPlatformInstitutions,
} from "@/lib/adminData";
import { apiFetch } from "@/lib/api";
import { resolveActiveContextIdForUser } from "@/lib/institutions";
import { packageDocumentTitle, readReceivedPackages, readSentPackages, statusTone } from "@/lib/packages";
import { ROMANIA_COUNTIES, localityOptions } from "@/lib/romaniaLocalities";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  accountType: "individual" | "company" | "institution";
  linkedInstitutionIds?: string[];
};
type ConstituentRow =
  | (TaxpayerPerson & { rowType: "person" })
  | (TaxpayerCompany & { rowType: "company" });

type TaxpayerSummary = {
  total: number;
  persons: number;
  companies: number;
  active: number;
};

type TaxpayerApiItem = {
  id: string;
  institutionId: string;
  type: "person" | "company";
  name: string;
  identifier: string;
  locality: string;
  status: "legat" | "nelegat";
  linkedUserId: number | null;
  email?: string | null;
  phone?: string | null;
  accountKind?: string | null;
  address?: string | null;
  details?: Record<string, unknown>;
};

type TaxpayerApiResponse = {
  items: TaxpayerApiItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: TaxpayerSummary;
};

type PersonForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  cnp: string;
  ciSeries: string;
  ciNumber: string;
  ciIssuedAt: string;
  birthDate: string;
  birthPlace: string;
  accountKind: TaxpayerPerson["accountKind"];
  country: string;
  county: string;
  locality: string;
  street: string;
  streetNumber: string;
  buildingNumber: string;
  floor: string;
  apartment: string;
  postalCode: string;
  latitude: string;
  longitude: string;
};

type CompanyForm = {
  name: string;
  cif: string;
  phone: string;
  email: string;
  accountKind: TaxpayerCompany["accountKind"];
  country: string;
  county: string;
  locality: string;
  street: string;
  streetNumber: string;
  buildingNumber: string;
  floor: string;
  apartment: string;
  postalCode: string;
  latitude: string;
  longitude: string;
};

function readStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem("docmanager_user");
    return saved ? JSON.parse(saved) as StoredUser : null;
  } catch {
    return null;
  }
}

function normalizeText(value?: string) {
  return (value ?? "").trim();
}

function normalizeName(value?: string) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function splitCsvLine(line: string) {
  const delimiter = line.includes(";") ? ";" : ",";
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);

  return cells;
}

const importColumns = [
  "tip",
  "nume",
  "prenume",
  "cnp_cui",
  "telefon",
  "email",
  "serie_ci",
  "numar_ci",
  "data_eliberarii_ci",
  "data_nasterii",
  "loc_nastere",
  "tara",
  "judet",
  "localitate",
  "strada",
  "nr_strada",
  "nr_cladire",
  "etaj",
  "apartament",
  "cod_postal",
  "latitudine",
  "longitudine",
  "tip_cont",
] as const;

type ImportColumn = typeof importColumns[number];
type ImportRecord = Record<ImportColumn, string>;

const templateImportRows: ImportRecord[] = [
  {
    tip: "PF",
    nume: "Ionescu",
    prenume: "Andrei",
    cnp_cui: "1960101123456",
    telefon: "+40722111222",
    email: "andrei.ionescu@example.ro",
    serie_ci: "GR",
    numar_ci: "123456",
    data_eliberarii_ci: "2024-05-10",
    data_nasterii: "1996-01-01",
    loc_nastere: "Giurgiu",
    tara: "Romania",
    judet: "Giurgiu",
    localitate: "Joita",
    strada: "Strada Principala",
    nr_strada: "10",
    nr_cladire: "",
    etaj: "",
    apartament: "",
    cod_postal: "087150",
    latitudine: "",
    longitudine: "",
    tip_cont: "resident",
  },
  {
    tip: "PF",
    nume: "Marinescu",
    prenume: "Elena",
    cnp_cui: "2880222123456",
    telefon: "+40722333444",
    email: "elena.marinescu@example.ro",
    serie_ci: "IF",
    numar_ci: "654321",
    data_eliberarii_ci: "2023-03-20",
    data_nasterii: "1988-02-22",
    loc_nastere: "Bucuresti",
    tara: "Romania",
    judet: "Giurgiu",
    localitate: "Joita",
    strada: "Strada Livezii",
    nr_strada: "4",
    nr_cladire: "",
    etaj: "",
    apartament: "",
    cod_postal: "087150",
    latitudine: "",
    longitudine: "",
    tip_cont: "property_owner",
  },
  {
    tip: "PJ",
    nume: "Nord Construct SRL",
    prenume: "",
    cnp_cui: "RO44221133",
    telefon: "+40722999888",
    email: "office@nordconstruct.ro",
    serie_ci: "",
    numar_ci: "",
    data_eliberarii_ci: "",
    data_nasterii: "",
    loc_nastere: "",
    tara: "Romania",
    judet: "Giurgiu",
    localitate: "Joita",
    strada: "Strada Fabricii",
    nr_strada: "7",
    nr_cladire: "Hala 2",
    etaj: "",
    apartament: "",
    cod_postal: "087150",
    latitudine: "",
    longitudine: "",
    tip_cont: "company_hq",
  },
  {
    tip: "PJ",
    nume: "Agro Sud Invest SRL",
    prenume: "",
    cnp_cui: "RO55667788",
    telefon: "+40722123456",
    email: "contact@agrosud.ro",
    serie_ci: "",
    numar_ci: "",
    data_eliberarii_ci: "",
    data_nasterii: "",
    loc_nastere: "",
    tara: "Romania",
    judet: "Giurgiu",
    localitate: "Joita",
    strada: "Drumul Tarlalei",
    nr_strada: "FN",
    nr_cladire: "",
    etaj: "",
    apartament: "",
    cod_postal: "087150",
    latitudine: "",
    longitudine: "",
    tip_cont: "company_property_owner",
  },
];

function csvEscape(value: string) {
  if (/[",;\n\r]/.test(value)) return `"${value.replace(/"/g, "\"\"")}"`;

  return value;
}

function buildDemoCsv() {
  return [
    importColumns.join(","),
    ...templateImportRows.map((row) => importColumns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function buildDemoExcelHtml() {
  const header = importColumns.map((column) => `<th>${column}</th>`).join("");
  const rows = templateImportRows.map((row) => `<tr>${importColumns.map((column) => `<td>${row[column]}</td>`).join("")}</tr>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
    th { background: #172033; color: #fff; text-align: left; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; mso-number-format:"\\@"; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function downloadTextFile(fileName: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseExcelHtml(content: string) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const rows = Array.from(doc.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => normalizeText(cell.textContent ?? "")),
  );

  return rows.filter((row) => row.some(Boolean));
}

function parseDelimitedRows(content: string) {
  return content
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => splitCsvLine(row).map(normalizeText));
}

function parseImportRecords(content: string) {
  const cleanContent = content.replace(/^\uFEFF/, "");
  const rows = cleanContent.trim().startsWith("<") ? parseExcelHtml(cleanContent) : parseDelimitedRows(cleanContent);
  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, "").toLowerCase());
  const hasKnownHeader = importColumns.every((column) => header.includes(column));

  if (!hasKnownHeader) {
    return rows.map((row) => {
      const [tip, nume, prenume, cnpCui, telefon, email, judet, localitate, tipCont] = row;
      return {
        tip,
        nume,
        prenume,
        cnp_cui: cnpCui,
        telefon,
        email,
        serie_ci: "",
        numar_ci: "",
        data_eliberarii_ci: "",
        data_nasterii: "",
        loc_nastere: "",
        tara: "Romania",
        judet,
        localitate,
        strada: "",
        nr_strada: "",
        nr_cladire: "",
        etaj: "",
        apartament: "",
        cod_postal: "",
        latitudine: "",
        longitudine: "",
        tip_cont: tipCont,
      };
    });
  }

  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(importColumns.map((column) => [column, ""])) as ImportRecord;

    importColumns.forEach((column) => {
      const index = header.indexOf(column);
      record[column] = index >= 0 ? row[index] ?? "" : "";
    });

    return record;
  });
}

const emptyPersonForm: PersonForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  cnp: "",
  ciSeries: "",
  ciNumber: "",
  ciIssuedAt: "",
  birthDate: "",
  birthPlace: "",
  accountKind: "resident",
  country: "Romania",
  county: "Giurgiu",
  locality: "Joita",
  street: "",
  streetNumber: "",
  buildingNumber: "",
  floor: "",
  apartment: "",
  postalCode: "",
  latitude: "",
  longitude: "",
};

const emptyCompanyForm: CompanyForm = {
  name: "",
  cif: "",
  phone: "",
  email: "",
  accountKind: "company_hq",
  country: "Romania",
  county: "Giurgiu",
  locality: "Joita",
  street: "",
  streetNumber: "",
  buildingNumber: "",
  floor: "",
  apartment: "",
  postalCode: "",
  latitude: "",
  longitude: "",
};

function accountKindLabel(kind?: string) {
  if (kind === "resident") return "Domiciliu in localitate";
  if (kind === "property_owner") return "Proprietar in localitate";
  if (kind === "company_hq") return "Sediu social local";
  if (kind === "company_property_owner") return "Proprietati locale";
  return "Nespecificat";
}

function apiItemToRow(item: TaxpayerApiItem): ConstituentRow {
  const base = {
    id: item.id,
    name: item.name,
    phone: item.phone ?? "",
    email: item.email ?? "",
    country: "Romania",
    county: "",
    locality: item.locality,
    street: "",
    streetNumber: "",
    buildingNumber: "",
    floor: "",
    apartment: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    institutionId: item.institutionId,
    status: item.status,
    linkedUserId: item.linkedUserId ? `user-${item.linkedUserId}` : null,
  };

  if (item.type === "company") {
    return {
      ...base,
      rowType: "company",
      cif: item.identifier,
      accountKind: item.accountKind === "company_property_owner" ? "company_property_owner" : "company_hq",
    };
  }

  const [lastName = "", ...firstNameParts] = item.name.split(" ");

  return {
    ...base,
    rowType: "person",
    firstName: firstNameParts.join(" "),
    lastName,
    cnp: item.identifier,
    ciSeries: "",
    ciNumber: "",
    ciIssuedAt: "",
    birthDate: "",
    birthPlace: "",
    accountKind: item.accountKind === "property_owner" ? "property_owner" : "resident",
  };
}

function recordToApiPayload(record: ImportRecord) {
  const isCompany = record.tip.toUpperCase() === "PJ";

  return {
    type: isCompany ? "company" : "person",
    name: isCompany ? record.nume : `${record.nume} ${record.prenume}`.trim(),
    firstName: record.prenume,
    lastName: record.nume,
    identifier: record.cnp_cui,
    phone: record.telefon,
    email: record.email,
    accountKind: record.tip_cont,
    country: record.tara,
    county: record.judet,
    locality: record.localitate,
    street: record.strada,
    streetNumber: record.nr_strada,
    buildingNumber: record.nr_cladire,
    floor: record.etaj,
    apartment: record.apartament,
    postalCode: record.cod_postal,
    latitude: record.latitudine,
    longitude: record.longitudine,
    ciSeries: record.serie_ci,
    ciNumber: record.numar_ci,
    ciIssuedAt: record.data_eliberarii_ci,
    birthDate: record.data_nasterii,
    birthPlace: record.loc_nastere,
  };
}

export function InstitutionConstituentsManager() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [institutions, setInstitutions] = useState<PlatformInstitution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const institution = institutions.find((item) => item.id === institutionId);
  const [kind, setKind] = useState<"person" | "company">("person");
  const [personForm, setPersonForm] = useState<PersonForm>(emptyPersonForm);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [constituentRows, setConstituentRows] = useState<ConstituentRow[]>([]);
  const [summary, setSummary] = useState<TaxpayerSummary>({ total: 0, persons: 0, companies: 0, active: 0 });
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "person" | "company">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "legat" | "nelegat">("all");
  const [accountKindFilter, setAccountKindFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [csvPayload, setCsvPayload] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [enrollmentTab, setEnrollmentTab] = useState<"manual" | "import">("manual");
  const [detailConstituent, setDetailConstituent] = useState<ConstituentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 20;

  useEffect(() => {
    function syncInstitutionContext() {
      const storedUser = readStoredUser();
      const nextInstitutions = readPlatformInstitutions();
      const nextInstitutionId = resolveActiveContextIdForUser(storedUser);
      const nextInstitution = nextInstitutions.find((item) => item.id === nextInstitutionId);

      setCurrentUser(storedUser);
      setInstitutions(nextInstitutions);
      setInstitutionId(nextInstitutionId);
      setPersonForm((current) => ({ ...current, locality: nextInstitution?.locality ?? current.locality }));
      setCompanyForm((current) => ({ ...current, locality: nextInstitution?.locality ?? current.locality }));
    }

    syncInstitutionContext();
    window.addEventListener("storage", syncInstitutionContext);
    window.addEventListener("docmanager-account-context-change", syncInstitutionContext);

    return () => {
      window.removeEventListener("storage", syncInstitutionContext);
      window.removeEventListener("docmanager-account-context-change", syncInstitutionContext);
    };
  }, []);

  useEffect(() => {
    if (!institutionId) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      institutionId,
      page: String(page),
      limit: String(pageSize),
      q: search,
      type: typeFilter,
      status: statusFilter,
      accountKind: accountKindFilter,
    });

    setIsLoadingRows(true);

    apiFetch(`/api/institution-taxpayers?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: TaxpayerApiResponse) => {
        setConstituentRows((data.items ?? []).map(apiItemToRow));
        setSummary(data.summary ?? { total: 0, persons: 0, companies: 0, active: 0 });
        setTotalResults(data.total ?? 0);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("Nu pot incarca lista de cetateni din baza de date.");
      })
      .finally(() => setIsLoadingRows(false));

    return () => controller.abort();
  }, [accountKindFilter, institutionId, page, pageSize, reloadKey, search, statusFilter, typeFilter]);

  const currentPage = Math.min(page, totalPages);
  const pageStartIndex = totalResults === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEndIndex = Math.min(currentPage * pageSize, totalResults);
  const paginatedConstituentRows = constituentRows;
  const detailIncoming = useMemo(() => {
    if (typeof window === "undefined" || !detailConstituent) return [];

    const name = normalizeName(detailConstituent.name);
    const email = detailConstituent.email?.toLowerCase();

    return readReceivedPackages(institutionId).flatMap((group, groupIndex) =>
      group.packages.map((pkg, packageIndex) => ({
        id: `incoming-${groupIndex}-${packageIndex}`,
        partner: group.from,
        email: group.email.toLowerCase(),
        packageName: pkg.name,
        date: pkg.date,
        status: pkg.status,
        documents: pkg.documents.map(packageDocumentTitle),
      })),
    ).filter((row) => normalizeName(row.partner) === name || (!!email && row.email === email));
  }, [detailConstituent, institutionId]);
  const detailOutgoing = useMemo(() => {
    if (typeof window === "undefined" || !detailConstituent) return [];

    const name = normalizeName(detailConstituent.name);
    const email = detailConstituent.email?.toLowerCase();

    return readSentPackages(institutionId).flatMap((group, groupIndex) =>
      group.packages.map((pkg, packageIndex) => ({
        id: `outgoing-${groupIndex}-${packageIndex}`,
        partner: group.to,
        email: group.email.toLowerCase(),
        packageName: pkg.name,
        date: pkg.date,
        status: pkg.status,
        documents: pkg.documents.map(packageDocumentTitle),
      })),
    ).filter((row) => normalizeName(row.partner) === name || (!!email && row.email === email));
  }, [detailConstituent, institutionId]);

  useEffect(() => {
    setPage(1);
    setPageInput("1");
  }, [accountKindFilter, search, statusFilter, typeFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
      setPageInput(String(totalPages));
      return;
    }

    setPageInput(String(page));
  }, [page, totalPages]);

  function goToPage(nextPage: number) {
    const cleanPage = Number.isFinite(nextPage) ? nextPage : 1;
    const clampedPage = Math.min(Math.max(1, Math.trunc(cleanPage)), totalPages);
    setPage(clampedPage);
    setPageInput(String(clampedPage));
  }

  function submitPageInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToPage(Number(pageInput));
  }

  function updatePersonField(field: keyof PersonForm, value: string) {
    setPersonForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "county" ? { locality: "" } : {}),
    }));
  }

  function updateCompanyField(field: keyof CompanyForm, value: string) {
    setCompanyForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "county" ? { locality: "" } : {}),
    }));
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();

    const response = await apiFetch("/api/institution-taxpayers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...personForm,
        type: "person",
        institutionId,
        name: `${personForm.lastName} ${personForm.firstName}`.trim(),
        identifier: personForm.cnp,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data.message ?? "Cetateanul nu a putut fi salvat in baza de date.");
      return;
    }

    setPersonForm({ ...emptyPersonForm, county: personForm.county, locality: personForm.locality });
    setReloadKey((current) => current + 1);
    toast.success(data.item?.status === "legat" ? "Cetatean adaugat si legat automat de cont." : "Cetatean adaugat in baza institutiei.");
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();

    const response = await apiFetch("/api/institution-taxpayers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...companyForm,
        type: "company",
        institutionId,
        name: companyForm.name,
        identifier: companyForm.cif,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data.message ?? "Compania nu a putut fi salvata in baza de date.");
      return;
    }

    setCompanyForm({ ...emptyCompanyForm, county: companyForm.county, locality: companyForm.locality });
    setReloadKey((current) => current + 1);
    toast.success(data.item?.status === "legat" ? "Companie adaugata si legata automat de cont." : "Companie adaugata in baza institutiei.");
  }

  function scrollToEnrollment() {
    setEnrollmentTab("manual");
    setIsEnrollmentModalOpen(true);
  }

  async function readImportFile(file: File | null) {
    if (!file) return;

    try {
      const content = await file.text();
      setCsvPayload(content);
      setImportFileName(file.name);
      toast.info(`Fisier incarcat: ${file.name}`);
    } catch {
      toast.error("Fisierul nu a putut fi citit.");
    }
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    void readImportFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    void readImportFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleDropzoneKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  }

  async function importCsv() {
    const records = parseImportRecords(csvPayload);

    const response = await apiFetch("/api/institution-taxpayers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId, records: records.map(recordToApiPayload) }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data.message ?? "Importul nu a putut fi procesat in baza de date.");
      return;
    }

    setCsvPayload("");
    setImportFileName("");
    setReloadKey((current) => current + 1);
    toast.success(data.message ?? "Import finalizat.");
  }

  function downloadCsvTemplate() {
    downloadTextFile("model-import-cetateni-docmanager.csv", "text/csv;charset=utf-8", buildDemoCsv());
    toast.info("Modelul CSV a fost generat pentru descarcare.");
  }

  function downloadExcelTemplate() {
    downloadTextFile("model-import-cetateni-docmanager.xls", "application/vnd.ms-excel;charset=utf-8", buildDemoExcelHtml());
    toast.info("Modelul Excel a fost generat pentru descarcare.");
  }

  return (
    <section className="institution-constituents-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Institutie</span>
          <h1>Cetateni</h1>
          <p>Administreaza baza locala de cetateni si legaturile automate pe CNP/CUI.</p>
        </div>
      </div>

      <div className="institution-list-card">
        <header>
          <div>
            <span className="eyebrow">Baza locala</span>
            <h2>Lista cetateni</h2>
          </div>
          <span className="list-results-pill">{totalResults} rezultate</span>
          <div className="institution-list-actions">
            <label className="compact-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cauta dupa nume, CNP, CUI sau email" /></label>
            <div className="segmented-control">
              <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>Toate</button>
              <button type="button" className={typeFilter === "person" ? "active" : ""} onClick={() => setTypeFilter("person")}>PF</button>
              <button type="button" className={typeFilter === "company" ? "active" : ""} onClick={() => setTypeFilter("company")}>PJ</button>
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Toate statusurile</option>
              <option value="legat">Cont activ</option>
              <option value="nelegat">Fara cont</option>
            </select>
            <select value={accountKindFilter} onChange={(event) => setAccountKindFilter(event.target.value)}>
              <option value="all">Toate tipurile</option>
              <option value="resident">Domiciliu localitate</option>
              <option value="property_owner">Proprietar localitate</option>
              <option value="company_hq">Sediu social local</option>
              <option value="company_property_owner">Companie cu proprietati</option>
            </select>
            <button className="add-constituent-button" type="button" onClick={scrollToEnrollment}>
              <PlusCircle size={19} />
              Adauga cetatean
            </button>
          </div>
        </header>
        <div className="constituent-table">
          {paginatedConstituentRows.map((item) => {
            const isPerson = item.rowType === "person";
            const identifier = isPerson ? item.cnp : item.cif;

            return (
              <article className="constituent-row institution-taxpayer-row" key={item.id}>
                <div className="taxpayer-main-button constituent-main">
                  <span className="entity-icon taxpayer-icon">{isPerson ? <UserRound size={20} /> : <Building2 size={20} />}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{isPerson ? "CNP" : "CUI"} {identifier} · {item.locality}</small>
                  </span>
                </div>
                <span className="taxpayer-row-meta">
                  <em className={item.status === "legat" ? "linked" : "unlinked"}>{item.status === "legat" ? "Cont activ" : "Fara cont"}</em>
                  <small>{accountKindLabel(item.accountKind)}</small>
                </span>
                <span className="taxpayer-row-counts">
                  <small>Primite <strong>0</strong></small>
                  <small>Trimise <strong>0</strong></small>
                </span>
                <button className="taxpayer-details-button" type="button" onClick={() => setDetailConstituent(item)}>Detalii</button>
              </article>
            );
          })}
          {totalResults === 0 ? <p className="empty-state-inline">{isLoadingRows ? "Se incarca lista din baza de date..." : "Nu exista cetateni pentru filtrele selectate."}</p> : null}
        </div>
        {totalResults > 0 ? (
          <div className="institution-pagination institution-list-pagination">
            <span>Afisare {pageStartIndex}-{pageEndIndex} din {totalResults} cetateni</span>
            <div className="pagination-controls">
              <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button>
              <form className="page-jump-form" onSubmit={submitPageInput}>
                <label htmlFor="constituent-page-jump">Pagina</label>
                <input
                  id="constituent-page-jump"
                  inputMode="numeric"
                  min={1}
                  max={totalPages}
                  type="number"
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                />
                <span>din {totalPages}</span>
              </form>
              <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>Urmator</button>
            </div>
          </div>
        ) : null}
      </div>

      {detailConstituent ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel taxpayer-detail-modal">
            <button className="modal-close" type="button" aria-label="Inchide detaliile cetateanului" onClick={() => setDetailConstituent(null)}>
              <X size={22} />
            </button>
            <div className="taxpayer-profile-card">
              <span className="taxpayer-profile-icon">
                {detailConstituent.rowType === "person" ? <UserRound size={28} /> : <Building2 size={28} />}
              </span>
              <div>
                <p className="eyebrow">{detailConstituent.rowType === "person" ? "Persoana fizica" : "Persoana juridica"}</p>
                <h2>{detailConstituent.name}</h2>
                <p>{detailConstituent.email ?? "Cont neidentificat"} · {detailConstituent.locality}</p>
              </div>
              <div className="taxpayer-profile-meta">
                <span>{detailConstituent.rowType === "person" ? "CNP" : "CIF"} <strong>{detailConstituent.rowType === "person" ? detailConstituent.cnp : detailConstituent.cif}</strong></span>
                <span>Trimise <strong>{detailOutgoing.length}</strong></span>
                <span>Primite <strong>{detailIncoming.length}</strong></span>
              </div>
            </div>
            <div className="taxpayer-modal-actions">
              <span className="taxpayer-linked-account-id">
                ID cont platforma: <strong>{detailConstituent.linkedUserId ?? "fara cont legat"}</strong>
              </span>
              <Link className="secondary-button citizen-profile-link" href={`/institutie/cetateni/${detailConstituent.id}`}>
                Profil cetatean <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="taxpayer-history-grid">
              <div>
                <h3>Documente primite de la cetatean</h3>
                <div className="taxpayer-history-list">
                  {detailIncoming.length ? detailIncoming.map((row) => (
                    <article key={row.id}>
                      <FileInput size={18} />
                      <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                      <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                    </article>
                  )) : <p className="empty-state-inline">Nu exista documente primite de la acest cetatean.</p>}
                </div>
              </div>
              <div>
                <h3>Documente trimise catre cetatean</h3>
                <div className="taxpayer-history-list">
                  {detailOutgoing.length ? detailOutgoing.map((row) => (
                    <article key={row.id}>
                      <FileOutput size={18} />
                      <span><strong>{row.packageName}</strong><small>{row.date} · {row.documents.join(", ")}</small></span>
                      <em className={`registry-status ${statusTone(row.status)}`}>{row.status}</em>
                    </article>
                  )) : <p className="empty-state-inline">Nu exista documente trimise catre acest cetatean.</p>}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isEnrollmentModalOpen ? (
        <section
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsEnrollmentModalOpen(false);
          }}
        >
          <div className="modal-panel constituent-modal-panel" role="dialog" aria-modal="true" aria-label="Adauga cetatean sau importa baza locala">
            <button className="modal-floating-close" type="button" aria-label="Inchide formularul" onClick={() => setIsEnrollmentModalOpen(false)}>
              <X size={20} />
            </button>
            <header className="constituent-modal-head">
              <div>
                <span className="eyebrow">Baza locala</span>
                <h2>Adauga cetatean</h2>
                <p>Adauga manual un cetatean sau importa un fisier CSV/Excel pentru institutia curenta.</p>
              </div>
              <strong>{institution?.name ?? currentUser?.name ?? "Institutia curenta"}</strong>
            </header>
            <div className="segmented-control constituent-modal-tabs">
              <button type="button" className={enrollmentTab === "manual" ? "active" : ""} onClick={() => setEnrollmentTab("manual")}>Adaugare manuala</button>
              <button type="button" className={enrollmentTab === "import" ? "active" : ""} onClick={() => setEnrollmentTab("import")}>Import fisier</button>
            </div>

            {enrollmentTab === "manual" ? (
        <form className="institution-form-card" onSubmit={kind === "person" ? savePerson : saveCompany}>
          <header>
            <span>{kind === "person" ? <UserRound size={22} /> : <Building2 size={22} />}</span>
            <div>
              <strong>Adaugare manuala</strong>
              <small>{institution?.name ?? currentUser?.name ?? "Institutia curenta"}</small>
            </div>
          </header>
          <div className="segmented-control">
            <button type="button" className={kind === "person" ? "active" : ""} onClick={() => setKind("person")}>Persoana fizica</button>
            <button type="button" className={kind === "company" ? "active" : ""} onClick={() => setKind("company")}>Persoana juridica</button>
          </div>

          {kind === "person" ? (
            <>
              <div className="institution-form-grid two">
                <label>Nume<input required value={personForm.lastName} onChange={(event) => updatePersonField("lastName", event.target.value)} placeholder="Popescu" /></label>
                <label>Prenume<input required value={personForm.firstName} onChange={(event) => updatePersonField("firstName", event.target.value)} placeholder="Ion" /></label>
                <label>Telefon<input value={personForm.phone} onChange={(event) => updatePersonField("phone", event.target.value)} placeholder="+40..." /></label>
                <label>Email<input type="email" value={personForm.email} onChange={(event) => updatePersonField("email", event.target.value)} placeholder="email@example.ro" /></label>
                <label>CNP<input required value={personForm.cnp} onChange={(event) => updatePersonField("cnp", event.target.value)} placeholder="13 cifre" /></label>
                <label>Serie si numar CI<div className="inline-fields"><input value={personForm.ciSeries} onChange={(event) => updatePersonField("ciSeries", event.target.value)} placeholder="GR" /><input value={personForm.ciNumber} onChange={(event) => updatePersonField("ciNumber", event.target.value)} placeholder="123456" /></div></label>
                <label>Data eliberarii CI<input type="date" value={personForm.ciIssuedAt} onChange={(event) => updatePersonField("ciIssuedAt", event.target.value)} /></label>
                <label>Data nasterii<input type="date" value={personForm.birthDate} onChange={(event) => updatePersonField("birthDate", event.target.value)} /></label>
                <label>Locul nasterii<input value={personForm.birthPlace} onChange={(event) => updatePersonField("birthPlace", event.target.value)} placeholder="Localitate, judet" /></label>
                <label>Tip cont<select value={personForm.accountKind} onChange={(event) => updatePersonField("accountKind", event.target.value)}>
                  <option value="resident">Cetatean cu domiciliu in localitate</option>
                  <option value="property_owner">Cetatean cu proprietati in localitate</option>
                </select></label>
              </div>
              <AddressFields values={personForm} onChange={updatePersonField} />
            </>
          ) : (
            <>
              <div className="institution-form-grid two">
                <label>Denumire<input required value={companyForm.name} onChange={(event) => updateCompanyField("name", event.target.value)} placeholder="Demo Construct SRL" /></label>
                <label>CUI/CIF<input required value={companyForm.cif} onChange={(event) => updateCompanyField("cif", event.target.value)} placeholder="RO..." /></label>
                <label>Telefon<input value={companyForm.phone} onChange={(event) => updateCompanyField("phone", event.target.value)} placeholder="+40..." /></label>
                <label>Email<input type="email" value={companyForm.email} onChange={(event) => updateCompanyField("email", event.target.value)} placeholder="office@example.ro" /></label>
                <label>Tip cont<select value={companyForm.accountKind} onChange={(event) => updateCompanyField("accountKind", event.target.value)}>
                  <option value="company_hq">Companie cu sediul social in localitate</option>
                  <option value="company_property_owner">Companie cu proprietati/terenuri in localitate</option>
                </select></label>
              </div>
              <AddressFields values={companyForm} onChange={updateCompanyField} />
            </>
          )}

          <button className="primary-button" type="submit">Adauga in baza institutiei</button>
        </form>
            ) : (

        <aside className="institution-import-card">
          <header>
            <FileUp size={22} />
            <div>
              <strong>Import fisier</strong>
              <small>Importa CSV sau Excel cu validare pe CNP/CUI + institutia curenta.</small>
            </div>
          </header>
          <div className="import-template-actions">
            <button className="template-download-card" type="button" onClick={downloadCsvTemplate}>
              <FileText size={20} />
              <span>Descarca model CSV</span>
              <Download size={16} />
            </button>
            <button className="template-download-card" type="button" onClick={downloadExcelTemplate}>
              <FileSpreadsheet size={20} />
              <span>Descarca model Excel</span>
              <Download size={16} />
            </button>
          </div>
          <div
            className={`import-dropzone${isDragOver ? " dragging" : ""}${csvPayload ? " ready" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onKeyDown={handleDropzoneKey}
            role="button"
            tabIndex={0}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.xls,.html" onChange={handleCsvFile} />
            <span className="dropzone-icon">{csvPayload ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}</span>
            <strong>{csvPayload ? "Fisier pregatit pentru import" : "Trage fisierul aici"}</strong>
            <small>{importFileName || "CSV sau Excel (.xls). Modelul include cate un rand pentru fiecare tip de cetatean sau companie."}</small>
          </div>
          <button className="secondary-button" type="button" onClick={importCsv} disabled={!csvPayload.trim()}>Proceseaza import</button>
        </aside>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AddressFields<T extends { country: string; county: string; locality: string; street: string; streetNumber: string; buildingNumber: string; floor: string; apartment: string; postalCode: string; latitude: string; longitude: string }>(
  { values, onChange }: { values: T; onChange: (field: keyof T, value: string) => void },
) {
  const localities = localityOptions(values.county, values.locality);

  return (
    <fieldset className="address-fieldset">
      <legend>Adresa din act sau sediu social</legend>
      <div className="institution-form-grid three">
        <label>Tara<input value={values.country} onChange={(event) => onChange("country", event.target.value)} /></label>
        <label>Judet<select value={values.county} onChange={(event) => onChange("county", event.target.value)}>
          <option value="">Selecteaza judetul</option>
          {ROMANIA_COUNTIES.map((county) => <option value={county} key={county}>{county}</option>)}
        </select></label>
        <label>Oras/Localitate<select value={values.locality} onChange={(event) => onChange("locality", event.target.value)} disabled={!values.county}>
          <option value="">{values.county ? "Selecteaza localitatea" : "Alege mai intai judetul"}</option>
          {localities.map((locality) => <option value={locality} key={locality}>{locality}</option>)}
        </select></label>
        <label>Strada<input value={values.street} onChange={(event) => onChange("street", event.target.value)} placeholder="Strada" /></label>
        <label>Nr. strada<input value={values.streetNumber} onChange={(event) => onChange("streetNumber", event.target.value)} placeholder="12" /></label>
        <label>Nr. cladire<input value={values.buildingNumber} onChange={(event) => onChange("buildingNumber", event.target.value)} placeholder="Bloc / cladire" /></label>
        <label>Etaj<input value={values.floor} onChange={(event) => onChange("floor", event.target.value)} placeholder="Optional" /></label>
        <label>Apartament<input value={values.apartment} onChange={(event) => onChange("apartment", event.target.value)} placeholder="Optional" /></label>
        <label>Cod postal<input value={values.postalCode} onChange={(event) => onChange("postalCode", event.target.value)} placeholder="087150" /></label>
        <label>Latitudine<input value={values.latitude} onChange={(event) => onChange("latitude", event.target.value)} placeholder="Optional" /></label>
        <label>Longitudine<input value={values.longitude} onChange={(event) => onChange("longitude", event.target.value)} placeholder="Optional" /></label>
      </div>
    </fieldset>
  );
}
