"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Building2, CheckCircle2, Download, FileSpreadsheet, FileText, FileUp, Link2, PlusCircle, Search, UploadCloud, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  PlatformUser,
  PlatformInstitution,
  TaxpayerCompany,
  TaxpayerPerson,
  readPlatformInstitutions,
  readPlatformUsers,
  readTaxpayerCompanies,
  readTaxpayerPersons,
  writeTaxpayerCompanies,
  writeTaxpayerPersons,
} from "@/lib/adminData";

const countyLocalities: Record<string, string[]> = {
  Giurgiu: ["Joita", "Bolintin-Deal", "Marsa", "Mihailesti"],
  Olt: ["Pleasov", "Slatina", "Caracal", "Bals"],
  Bucuresti: ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6"],
  Ilfov: ["Voluntari", "Otopeni", "Chitila", "Buftea"],
};

type StoredUser = Pick<PlatformUser, "id" | "name" | "email" | "accountType" | "linkedInstitutionIds">;

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

function normalizeFiscal(value?: string) {
  return (value ?? "").replace(/^RO/i, "").replace(/\D/g, "");
}

function normalizeText(value?: string) {
  return (value ?? "").trim();
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

const demoImportRows: ImportRecord[] = [
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
    ...demoImportRows.map((row) => importColumns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function buildDemoExcelHtml() {
  const header = importColumns.map((column) => `<th>${column}</th>`).join("");
  const rows = demoImportRows.map((row) => `<tr>${importColumns.map((column) => `<td>${row[column]}</td>`).join("")}</tr>`).join("");

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

export function InstitutionConstituentsManager() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [institutions, setInstitutions] = useState<PlatformInstitution[]>([]);
  const institutionId = currentUser?.linkedInstitutionIds?.[0] ?? "primaria-joita";
  const institution = institutions.find((item) => item.id === institutionId);
  const [kind, setKind] = useState<"person" | "company">("person");
  const [personForm, setPersonForm] = useState<PersonForm>(emptyPersonForm);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [persons, setPersons] = useState<TaxpayerPerson[]>([]);
  const [companies, setCompanies] = useState<TaxpayerCompany[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [search, setSearch] = useState("");
  const [csvPayload, setCsvPayload] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const enrollmentRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storedUser = readStoredUser();
    const nextInstitutions = readPlatformInstitutions();
    const nextInstitutionId = storedUser?.linkedInstitutionIds?.[0] ?? "primaria-joita";
    const nextInstitution = nextInstitutions.find((item) => item.id === nextInstitutionId);

    setCurrentUser(storedUser);
    setInstitutions(nextInstitutions);
    setPersons(readTaxpayerPersons());
    setCompanies(readTaxpayerCompanies());
    setUsers(readPlatformUsers());
    setPersonForm((current) => ({ ...current, locality: nextInstitution?.locality ?? current.locality }));
    setCompanyForm((current) => ({ ...current, locality: nextInstitution?.locality ?? current.locality }));
  }, []);

  const institutionPersons = persons.filter((person) => person.institutionId === institutionId);
  const institutionCompanies = companies.filter((company) => company.institutionId === institutionId);
  const filteredPersons = institutionPersons.filter((person) => `${person.name} ${person.cnp} ${person.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const filteredCompanies = institutionCompanies.filter((company) => `${company.name} ${company.cif} ${company.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  function matchPerson(cnp: string) {
    return users.find((user) => user.accountType === "individual" && normalizeFiscal(user.cnp) === normalizeFiscal(cnp));
  }

  function matchCompany(cif: string) {
    return users.find((user) => user.accountType === "company" && normalizeFiscal(user.cif) === normalizeFiscal(cif));
  }

  function updatePersonField(field: keyof PersonForm, value: string) {
    setPersonForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "county" ? { locality: countyLocalities[value]?.[0] ?? "" } : {}),
    }));
  }

  function updateCompanyField(field: keyof CompanyForm, value: string) {
    setCompanyForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "county" ? { locality: countyLocalities[value]?.[0] ?? "" } : {}),
    }));
  }

  function savePerson(event: FormEvent) {
    event.preventDefault();
    const personExists = persons.some((person) => person.institutionId === institutionId && normalizeFiscal(person.cnp) === normalizeFiscal(personForm.cnp));
    if (personExists) {
      toast.error("Cetateanul exista deja in baza acestei institutii.");
      return;
    }

    const matched = matchPerson(personForm.cnp);
    const nextPerson: TaxpayerPerson = {
      ...personForm,
      id: `tax-person-${Date.now()}`,
      name: `${personForm.lastName} ${personForm.firstName}`.trim(),
      cnp: personForm.cnp,
      locality: personForm.locality,
      institutionId,
      status: matched ? "legat" : "nelegat",
      linkedUserId: matched?.id ?? null,
    };
    const next = [nextPerson, ...persons];
    setPersons(next);
    writeTaxpayerPersons(next);
    setPersonForm({ ...emptyPersonForm, county: personForm.county, locality: personForm.locality });
    toast.success(matched ? "Cetatean adaugat si legat automat de cont." : "Cetatean adaugat. Nu exista inca un cont asociat.");
  }

  function saveCompany(event: FormEvent) {
    event.preventDefault();
    const companyExists = companies.some((company) => company.institutionId === institutionId && normalizeFiscal(company.cif) === normalizeFiscal(companyForm.cif));
    if (companyExists) {
      toast.error("Compania exista deja in baza acestei institutii.");
      return;
    }

    const matched = matchCompany(companyForm.cif);
    const nextCompany: TaxpayerCompany = {
      ...companyForm,
      id: `tax-company-${Date.now()}`,
      name: companyForm.name,
      cif: companyForm.cif,
      locality: companyForm.locality,
      institutionId,
      status: matched ? "legat" : "nelegat",
      linkedUserId: matched?.id ?? null,
    };
    const next = [nextCompany, ...companies];
    setCompanies(next);
    writeTaxpayerCompanies(next);
    setCompanyForm({ ...emptyCompanyForm, county: companyForm.county, locality: companyForm.locality });
    toast.success(matched ? "Companie adaugata si legata automat de cont." : "Companie adaugata. Nu exista inca un cont asociat.");
  }

  function scrollToEnrollment() {
    enrollmentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function importCsv() {
    const records = parseImportRecords(csvPayload);
    const nextPersons = [...persons];
    const nextCompanies = [...companies];
    let imported = 0;
    let skipped = 0;

    records.forEach((record) => {
      const type = record.tip.toUpperCase();
      const identifier = record.cnp_cui;

      if (type === "PF") {
        if (!identifier || nextPersons.some((person) => person.institutionId === institutionId && normalizeFiscal(person.cnp) === normalizeFiscal(identifier))) {
          skipped += 1;
          return;
        }

        const matched = matchPerson(identifier);
        nextPersons.unshift({
          id: `tax-person-${Date.now()}-${nextPersons.length}`,
          firstName: record.prenume,
          lastName: record.nume,
          name: `${record.nume} ${record.prenume}`.trim(),
          cnp: identifier,
          phone: record.telefon,
          email: record.email,
          ciSeries: record.serie_ci,
          ciNumber: record.numar_ci,
          ciIssuedAt: record.data_eliberarii_ci,
          birthDate: record.data_nasterii,
          birthPlace: record.loc_nastere,
          country: record.tara || "Romania",
          county: record.judet || "Giurgiu",
          locality: record.localitate || institution?.locality || "Joita",
          street: record.strada,
          streetNumber: record.nr_strada,
          buildingNumber: record.nr_cladire,
          floor: record.etaj,
          apartment: record.apartament,
          postalCode: record.cod_postal,
          latitude: record.latitudine,
          longitude: record.longitudine,
          accountKind: record.tip_cont === "property_owner" ? "property_owner" : "resident",
          institutionId,
          status: matched ? "legat" : "nelegat",
          linkedUserId: matched?.id ?? null,
        });
        imported += 1;
      }

      if (type === "PJ") {
        if (!identifier || nextCompanies.some((company) => company.institutionId === institutionId && normalizeFiscal(company.cif) === normalizeFiscal(identifier))) {
          skipped += 1;
          return;
        }

        const matched = matchCompany(identifier);
        nextCompanies.unshift({
          id: `tax-company-${Date.now()}-${nextCompanies.length}`,
          name: record.nume,
          cif: identifier,
          phone: record.telefon,
          email: record.email,
          country: record.tara || "Romania",
          county: record.judet || "Giurgiu",
          locality: record.localitate || institution?.locality || "Joita",
          street: record.strada,
          streetNumber: record.nr_strada,
          buildingNumber: record.nr_cladire,
          floor: record.etaj,
          apartment: record.apartament,
          postalCode: record.cod_postal,
          latitude: record.latitudine,
          longitude: record.longitudine,
          accountKind: record.tip_cont === "company_property_owner" ? "company_property_owner" : "company_hq",
          institutionId,
          status: matched ? "legat" : "nelegat",
          linkedUserId: matched?.id ?? null,
        });
        imported += 1;
      }
    });

    setPersons(nextPersons);
    setCompanies(nextCompanies);
    writeTaxpayerPersons(nextPersons);
    writeTaxpayerCompanies(nextCompanies);
    setCsvPayload("");
    setImportFileName("");
    toast.success(`Import finalizat: ${imported} inregistrari adaugate${skipped ? `, ${skipped} duplicate sarite` : ""}.`);
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
          <h1>Cetateni si companii</h1>
          <p>Administreaza baza locala de contribuabili si legaturile automate pe CNP/CUI.</p>
        </div>
      </div>

      <div className="institution-overview-grid">
        <article>
          <UsersRound size={24} />
          <strong>{institutionPersons.length}</strong>
          <span>Persoane fizice</span>
        </article>
        <article>
          <Building2 size={24} />
          <strong>{institutionCompanies.length}</strong>
          <span>Persoane juridice</span>
        </article>
        <article>
          <Link2 size={24} />
          <strong>{[...institutionPersons, ...institutionCompanies].filter((item) => item.status === "legat").length}</strong>
          <span>Conturi active</span>
        </article>
      </div>

      <div className="institution-list-card">
        <header>
          <div>
            <span className="eyebrow">Baza locala</span>
            <h2>Contribuabili inrolati</h2>
          </div>
          <div className="institution-list-actions">
            <label className="compact-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cauta dupa nume, CNP, CUI sau email" /></label>
            <button className="add-constituent-button" type="button" onClick={scrollToEnrollment}>
              <PlusCircle size={19} />
              Adauga cetatean / contribuabil
            </button>
          </div>
        </header>
        <div className="constituent-table">
          {[...filteredPersons, ...filteredCompanies].map((item) => {
            const isPerson = "cnp" in item;

            return (
              <article className="constituent-row" key={item.id}>
                <span className="entity-icon">{isPerson ? <UserRound size={20} /> : <Building2 size={20} />}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{isPerson ? `CNP ${item.cnp}` : `CUI ${item.cif}`} · {item.locality} · {accountKindLabel(item.accountKind)}</small>
                </div>
                <span className={`link-status ${item.status}`}>{item.status === "legat" ? "Legat de cont" : "Fara cont"}</span>
                <span className="muted-id">{item.linkedUserId ?? "id_cetatean null"}</span>
              </article>
            );
          })}
        </div>
      </div>

      <div className="institution-work-grid" ref={enrollmentRef}>
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
            <small>{importFileName || "CSV sau Excel (.xls). Modelul include cate un rand pentru fiecare tip de contribuabil."}</small>
          </div>
          <button className="secondary-button" type="button" onClick={importCsv} disabled={!csvPayload.trim()}>Proceseaza import</button>
        </aside>
      </div>
    </section>
  );
}

function AddressFields<T extends { country: string; county: string; locality: string; street: string; streetNumber: string; buildingNumber: string; floor: string; apartment: string; postalCode: string; latitude: string; longitude: string }>(
  { values, onChange }: { values: T; onChange: (field: keyof T, value: string) => void },
) {
  const localities = countyLocalities[values.county] ?? [];

  return (
    <fieldset className="address-fieldset">
      <legend>Adresa din act sau sediu social</legend>
      <div className="institution-form-grid three">
        <label>Tara<input value={values.country} onChange={(event) => onChange("country", event.target.value)} /></label>
        <label>Judet<select value={values.county} onChange={(event) => onChange("county", event.target.value)}>
          {Object.keys(countyLocalities).map((county) => <option value={county} key={county}>{county}</option>)}
        </select></label>
        <label>Oras/Localitate<select value={values.locality} onChange={(event) => onChange("locality", event.target.value)}>
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
