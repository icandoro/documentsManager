"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Database, IdCard, Landmark, RefreshCw, Sparkles, UploadCloud, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { demoPasswordForEmail, demoUserForEmail, PlatformUser } from "@/lib/adminData";
import { toast } from "sonner";

type AuthFormProps = {
  mode: "login" | "register" | "forgot";
};

type NoticeType = "success" | "info" | "error";

type LocalAccount = {
  email: string;
  password: string;
  user: PlatformUser;
};

type IdentityData = {
  firstName: string;
  lastName: string;
  cnp: string;
  series: string;
  number: string;
  address: string;
  county: string;
  city: string;
  issuedBy: string;
  validUntil: string;
};

type OcrStatus = {
  type: "idle" | "reading" | "success" | "warning" | "error";
  text: string;
};

const localAccountsStorageKey = "docmanager_local_accounts";

const accountCards = [
  {
    id: "individual",
    title: "Persoana fizica",
    icon: UserRound,
    text: "Cont personal pentru documente de identitate, contracte si pachete trimise rapid.",
    benefits: ["Profil personal complet", "Documente proprii organizate", "Trimitere pachete catre firme sau institutii"],
  },
  {
    id: "company",
    title: "Persoana juridica",
    icon: Building2,
    text: "Cont pentru firme, PFA sau organizatii care gestioneaza documente cu parteneri.",
    benefits: ["Precompletare date dupa CIF", "Documente si pachete pe companie", "Pregatit pentru fluxuri de semnare"],
  },
  {
    id: "institution",
    title: "Institutie",
    icon: Landmark,
    text: "Flux verificat pentru institutii, cu documente doveditoare si persoana delegata.",
    benefits: ["Verificare documente de inrolare", "Cont activat dupa aprobare", "Structura dedicata pentru documente primite si trimise"],
  },
];

const demoAccounts = [
  { group: "Cont demo administrare", email: "superadmin@docmanager.local", password: "superadmin123" },
  { group: "Conturi demo utilizatori", email: "pf.demo@docmanager.local", password: "demo12345" },
  { group: "Conturi demo utilizatori", email: "pj.demo@docmanager.local", password: "demo12345" },
  { group: "Conturi demo utilizatori", email: "primaria.joita@docmanager.local", password: "demo12345" },
  { group: "Conturi demo utilizatori", email: "primaria.pleasov@docmanager.local", password: "demo12345" },
];

function apiUrl(endpoint: "login" | "register") {
  return `/api/auth/${endpoint}`;
}

function readLocalAccounts() {
  const saved = window.localStorage.getItem(localAccountsStorageKey);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as LocalAccount[];

    if (Array.isArray(parsed)) return parsed;
  } catch {
    window.localStorage.removeItem(localAccountsStorageKey);
  }

  return [];
}

function writeLocalAccount(account: LocalAccount) {
  const accounts = readLocalAccounts().filter((item) => item.email.toLowerCase() !== account.email.toLowerCase());

  window.localStorage.setItem(localAccountsStorageKey, JSON.stringify([account, ...accounts]));
}

function localAccountForCredentials(email: string, password: string) {
  return readLocalAccounts().find((account) => account.email.toLowerCase() === email.toLowerCase() && account.password === password);
}

function mergeIdentityData(current: IdentityData, incoming: Partial<IdentityData>) {
  return {
    firstName: incoming.firstName || current.firstName,
    lastName: incoming.lastName || current.lastName,
    cnp: incoming.cnp || current.cnp,
    series: incoming.series || current.series,
    number: incoming.number || current.number,
    address: incoming.address || current.address,
    county: incoming.county || current.county,
    city: incoming.city || current.city,
    issuedBy: incoming.issuedBy || current.issuedBy,
    validUntil: incoming.validUntil || current.validUntil,
  };
}

function imageFileToAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Nu am putut citi imaginea."));
    reader.onload = () => {
      image.onerror = () => reject(new Error("Imaginea nu poate fi procesata."));
      image.onload = () => {
        const size = 192;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas indisponibil."));
          return;
        }

        canvas.width = size;
        canvas.height = size;
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
        const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Nu am putut citi imaginea."));
    reader.onload = () => {
      image.onerror = () => reject(new Error("Imaginea nu poate fi procesata."));
      image.onload = () => resolve(image);
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function enhanceImageForOcr(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.24 + 138));
    data[index] = contrasted;
    data[index + 1] = contrasted;
    data[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);
}

async function prepareIdentityImageForOcr(file: File) {
  const image = await loadImageFromFile(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const targetLongestSide = Math.min(2800, Math.max(1800, longestSide));
  const scale = targetLongestSide / longestSide;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return { file, previewUrl: URL.createObjectURL(file) };
  }

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  enhanceImageForOcr(canvas);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.98));

  if (!blob) {
    return { file, previewUrl: URL.createObjectURL(file) };
  }

  return {
    file: new File([blob], file.name.replace(/\.[^.]+$/, "") + "-ocr.png", { type: "image/png" }),
    previewUrl: URL.createObjectURL(blob),
  };
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState("individual");
  const [hasChosenAccountType, setHasChosenAccountType] = useState(!isRegister);
  const [identityData, setIdentityData] = useState<IdentityData>({
    firstName: "",
    lastName: "",
    cnp: "",
    series: "",
    number: "",
    address: "",
    county: "",
    city: "",
    issuedBy: "",
    validUntil: "",
  });
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [identityPreview, setIdentityPreview] = useState("");
  const [identityAvatarUrl, setIdentityAvatarUrl] = useState("");
  const [isReadingIdentity, setIsReadingIdentity] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ email: "", password: "" });
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>({
    type: "idle",
    text: "Incarca o poza frontala, clara, cu tot buletinul in cadru.",
  });
  const [companyData, setCompanyData] = useState({
    cif: "",
    name: "",
    registrationNumber: "",
    address: "",
    status: "",
  });
  const [isLookingUpCompany, setIsLookingUpCompany] = useState(false);

  const needsCompanyData = isRegister && (accountType === "company" || accountType === "institution");
  const selectedAccount = accountCards.find((card) => card.id === accountType) ?? accountCards[0];
  const SelectedAccountIcon = selectedAccount.icon;

  function showNotice(type: NoticeType, text: string) {
    if (type === "success") {
      toast.success(text);
      return;
    }

    if (type === "error") {
      toast.error(text);
      return;
    }

    toast.info(text);
  }

  function updateCompanyField(field: keyof typeof companyData, value: string) {
    setCompanyData((current) => ({ ...current, [field]: value }));
  }

  function updateIdentityField(field: keyof IdentityData, value: string) {
    setIdentityData((current) => ({ ...current, [field]: value }));
  }

  function fillDemoCredentials(email: string, password: string) {
    setLoginCredentials({ email, password });
    showNotice("info", `Am completat datele pentru ${email}.`);
  }

  async function handleIdentityUpload(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotice("error", "Incarca o poza valida cu buletinul.");
      setOcrStatus({ type: "error", text: "Fisierul selectat nu este o imagine valida." });
      return;
    }

    setIdentityFile(file);
    if (identityPreview) {
      window.URL.revokeObjectURL(identityPreview);
    }

    let prepared: { file: File; previewUrl: string };

    try {
      prepared = await prepareIdentityImageForOcr(file);
    } catch {
      prepared = { file, previewUrl: window.URL.createObjectURL(file) };
    }

    setIdentityPreview(prepared.previewUrl);
    try {
      setIdentityAvatarUrl(await imageFileToAvatar(file));
    } catch {
      setIdentityAvatarUrl("");
    }
    setIsReadingIdentity(true);
    setOcrStatus({ type: "reading", text: "Procesam poza local. Poate dura cateva secunde pentru imagini mari." });
    showNotice("info", "Rulam OCR local pe poza buletinului. Verifica informatiile inainte de creare cont.");

    try {
      const form = new FormData();
      form.append("identity", prepared.file);
      const response = await fetch("/api/ocr/identity", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotice("error", data.message ?? "OCR-ul local nu a putut procesa imaginea.");
        setOcrStatus({
          type: "error",
          text: data.message ?? "Nu am putut citi imaginea. Incearca o poza mai luminoasa, fara reflexii si fara margini taiate.",
        });
        return;
      }

      setIdentityData((current) => mergeIdentityData(current, data.fields ?? {}));
      setOcrStatus({
        type: data.fields?.cnp || data.fields?.lastName ? "success" : "warning",
        text: data.message ?? "OCR-ul local a procesat imaginea. Verifica si completeaza manual campurile lipsa.",
      });
      showNotice(data.fields?.cnp || data.fields?.lastName ? "success" : "info", data.message ?? "OCR-ul local a procesat imaginea.");
    } catch {
      showNotice("error", "Nu pot contacta OCR-ul local. Verifica backend-ul Docker.");
      setOcrStatus({ type: "error", text: "Nu pot contacta OCR-ul local. Verifica daca backend-ul Docker ruleaza." });
    } finally {
      setIsReadingIdentity(false);
    }
  }

  async function lookupCompany() {
    const normalizedCif = companyData.cif.replace(/\D+/g, "");

    if (!normalizedCif) {
      showNotice("error", "Introdu CIF-ul inainte de preluarea datelor.");
      return;
    }

    toast.dismiss();
    setIsLookingUpCompany(true);

    try {
      const response = await fetch(`/api/public/company/${normalizedCif}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.manualEntryAllowed) {
          showNotice("info", data.message ?? "Nu am gasit date publice. Poti completa manual campurile.");
          updateCompanyField("cif", normalizedCif);
          return;
        }

        showNotice("error", data.message ?? "Nu am putut prelua datele publice.");
        return;
      }

      if (data.manualEntryAllowed && !["found", "demo_fallback"].includes(data.lookupStatus)) {
        updateCompanyField("cif", normalizedCif);
        showNotice("info", data.message ?? "Preluarea automata nu este disponibila acum. Completeaza manual campurile si poti continua.");
        return;
      }

      setCompanyData({
        cif: data.cif ?? normalizedCif,
        name: data.name ?? "",
        registrationNumber: data.registrationNumber ?? "",
        address: data.address ?? "",
        status: data.status ?? "",
      });
      showNotice(data.warning ? "info" : "success", data.warning ?? "Datele publice au fost preluate. Verifica si completeaza unde este nevoie.");
    } catch {
      showNotice("error", "Nu pot contacta serviciul de preluare date. Completeaza manual.");
    } finally {
      setIsLookingUpCompany(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.dismiss();

    if (mode === "forgot") {
      showNotice("info", "Resetarea parolei va fi legata in pasul urmator.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const endpoint = isRegister ? "register" : "login";
    const email = String(form.get("email") ?? "").toLowerCase().trim();
    const password = String(form.get("password") ?? "");
    setIsSubmitting(true);

    function loginDemoUser() {
      const demoUser = demoUserForEmail(email);
      const expectedPassword = demoPasswordForEmail(email);

      if (!isLogin || !demoUser || password !== expectedPassword) {
        return false;
      }

      window.localStorage.setItem("docmanager_token", `demo-token-${demoUser.role}`);
      window.localStorage.setItem("docmanager_user", JSON.stringify(demoUser));
      window.localStorage.setItem("docmanager_user_role", demoUser.role);
      window.localStorage.removeItem("docmanager_institution_onboarding");
      showNotice("success", "Autentificare reusita. Te duc in dashboard.");
      setTimeout(() => router.push("/dashboard"), 700);

      return true;
    }

    function loginLocalUser() {
      const account = localAccountForCredentials(email, password);

      if (!isLogin || !account) {
        return false;
      }

      window.localStorage.setItem("docmanager_token", `local-token-${account.user.id}`);
      window.localStorage.setItem("docmanager_user", JSON.stringify(account.user));
      window.localStorage.setItem("docmanager_user_role", account.user.role);
      if (account.user.accountType !== "institution") {
        window.localStorage.removeItem("docmanager_institution_onboarding");
      }
      showNotice("success", "Autentificare reusita. Te duc in dashboard.");
      setTimeout(() => router.push("/dashboard"), 700);

      return true;
    }

    if (loginDemoUser()) {
      setIsSubmitting(false);
      return;
    }

    if (loginLocalUser()) {
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          personalData: accountType === "individual" ? identityData : null,
          email: form.get("email"),
          password: form.get("password"),
          accountType,
          company: needsCompanyData ? companyData : null
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (loginDemoUser()) {
          return;
        }

        if (loginLocalUser()) {
          return;
        }

        showNotice("error", data.message ?? (isRegister ? "Contul nu a putut fi creat." : "Autentificarea nu a reusit."));
        return;
      }

      if (!isRegister && data.requiresTwoFactor) {
        window.localStorage.setItem("docmanager_2fa_challenge", JSON.stringify({
          email,
          maskedEmail: data.maskedEmail ?? email,
          challengeToken: data.challengeToken,
        }));
        showNotice("info", data.message ?? "Continua cu verificarea in doi pasi.");
        setTimeout(() => router.push("/auth/two-factor"), 500);
        return;
      }

      if (isRegister) {
        const firstName = String(form.get("firstName") ?? identityData.firstName).trim();
        const lastName = String(form.get("lastName") ?? identityData.lastName).trim();
        const registeredCompany = needsCompanyData ? (data.company ?? companyData) : null;
        const name = accountType === "individual"
          ? [firstName, lastName].filter(Boolean).join(" ") || email
          : registeredCompany?.name || email;
        const localUser: PlatformUser = {
          id: `local-${Date.now()}`,
          name,
          email,
          role: "user",
          accountType: accountType as PlatformUser["accountType"],
          firstName,
          lastName,
          avatarUrl: accountType === "individual" ? identityAvatarUrl : undefined,
          cnp: accountType === "individual" ? identityData.cnp : undefined,
          cif: registeredCompany?.cif,
          phone: "",
          address: {
            street: registeredCompany?.address ?? identityData.address,
            number: "",
            city: identityData.city,
            county: identityData.county,
            postalCode: "",
          },
          status: accountType === "institution" ? "in_verificare" : "activ",
          linkedInstitutionIds: [],
          sentCount: 0,
          receivedCount: 0,
        };

        writeLocalAccount({ email, password, user: localUser });

        if (accountType !== "institution") {
          window.localStorage.removeItem("docmanager_institution_onboarding");
        }
        window.localStorage.setItem("docmanager_pending_registration", JSON.stringify({
          email: form.get("email"),
          accountType,
          company: registeredCompany,
          companyLookup: data.companyLookup ?? null,
          nextStep: data.nextStep ?? null,
          user: data.user ?? null,
        }));
      }

      if (!isRegister && data.token) {
        const demoUser = demoUserForEmail(String(data.user?.email ?? ""));
        window.localStorage.setItem("docmanager_token", data.token);
        window.localStorage.setItem("docmanager_user", JSON.stringify(demoUser ?? data.user ?? {}));
        window.localStorage.setItem("docmanager_user_role", demoUser?.role ?? "user");
        window.localStorage.removeItem("docmanager_institution_onboarding");
      }

      showNotice("success", isRegister ? "Contul a fost creat. Urmeaza confirmarea emailului." : "Autentificare reusita. Te duc in dashboard.");
      setTimeout(() => router.push(isRegister ? "/auth/check-email" : "/dashboard"), 700);
    } catch {
      if (loginDemoUser() || loginLocalUser()) {
        return;
      }

      showNotice("error", "Nu pot contacta backend-ul. Verifica daca serviciile Docker sunt pornite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">DM</span>
        <span>DocManager</span>
      </Link>
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Acces securizat</p>
          <h1>{isLogin ? "Autentificare" : isRegister && !hasChosenAccountType ? "Alege tipul de cont" : isRegister ? "Creeaza cont" : "Resetare parola"}</h1>
          <p className="muted">
            {isLogin
              ? "Intra in cont cu email, parola si verificare in doi pasi cand este activa."
              : isRegister && !hasChosenAccountType
                ? "Selecteaza cum vrei sa te inrolezi. Formularul se adapteaza automat in functie de tipul contului."
                : isRegister
                ? "Creeaza contul, confirma emailul, apoi continui cu pasii necesari tipului de cont ales."
                : "Primeste un link securizat pentru alegerea unei parole noi."}
          </p>
        </div>
        {isRegister && !hasChosenAccountType && (
          <section className="account-choice">
            <div className="account-card-grid">
              {accountCards.map((card) => {
                const Icon = card.icon;
                const isSelected = accountType === card.id;

                return (
                  <button className={`account-card ${isSelected ? "selected" : ""}`} key={card.id} type="button" onClick={() => setAccountType(card.id)}>
                    <span className="account-card-check"><CheckCircle2 size={18} /></span>
                    <span className="account-card-icon"><Icon size={30} /></span>
                    <strong>{card.title}</strong>
                    <span>{card.text}</span>
                    <ul>
                      {card.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
            <button className="primary-button account-next" type="button" disabled={!accountType} onClick={() => setHasChosenAccountType(true)}>
              Continua cu {selectedAccount.title}
            </button>
          </section>
        )}
        {(!isRegister || hasChosenAccountType) && <form className="form-grid" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="selected-account-strip">
                <span><SelectedAccountIcon size={18} /> {selectedAccount.title}</span>
                <button type="button" onClick={() => setHasChosenAccountType(false)}>Schimba</button>
              </div>
              {accountType === "individual" && (
                <section className="form-subsection identity-reader">
                  <div>
                    <p className="eyebrow">Preluare automata</p>
                    <h2>Date din buletin</h2>
                  </div>
                  <div className="identity-reader-grid">
                    <div className="identity-upload-stack">
                      <label className="identity-upload-card">
                        <input type="file" accept="image/*" capture="environment" onChange={(event) => handleIdentityUpload(event.target.files?.[0] ?? null)} />
                        {identityPreview ? (
                          <span className="identity-preview-frame">
                            <img src={identityPreview} alt="Preview buletin incarcat" />
                          </span>
                        ) : (
                          <span><UploadCloud size={28} /> Incarca poza buletin</span>
                        )}
                      </label>
                      <div className="identity-upload-help">
                        <strong>Preluam automat datele vizibile din act</strong>
                        <p>Nume, prenume, CNP, serie, numar si adresa. Verifica informatiile inainte de creare cont.</p>
                        <ul className="ocr-tips">
                          <li>Foloseste poza frontala, nu inclinata.</li>
                          <li>Evita reflexiile si blurul.</li>
                          <li>Pastreaza tot actul in cadru.</li>
                        </ul>
                      </div>
                    </div>
                    <div className="identity-reader-info">
                      <IdCard size={28} />
                      <div>
                        <strong>{isReadingIdentity ? "Se citesc datele..." : identityData.cnp ? "Date preluate" : "Status OCR"}</strong>
                        <p>OCR local pentru completarea campurilor gasite.</p>
                      </div>
                      <div className={`ocr-status ocr-status-${ocrStatus.type}`}>{ocrStatus.text}</div>
                      <button className="secondary-button" type="button" disabled={!identityFile || isReadingIdentity} onClick={() => handleIdentityUpload(identityFile)}>
                        {isReadingIdentity ? "Se proceseaza..." : "Reproceseaza"}
                      </button>
                    </div>
                  </div>
                  <div className="two-cols">
                    <label>CNP<input name="cnp" value={identityData.cnp} onChange={(event) => updateIdentityField("cnp", event.target.value)} placeholder="CNP" /></label>
                    <label>Serie si numar<input value={[identityData.series, identityData.number].filter(Boolean).join(" ")} onChange={(event) => {
                      const [series = "", number = ""] = event.target.value.split(/\s+/, 2);
                      setIdentityData((current) => ({ ...current, series, number }));
                    }} placeholder="RX 123456" /></label>
                  </div>
                  <label>Adresa<input name="identityAddress" value={identityData.address} onChange={(event) => updateIdentityField("address", event.target.value)} placeholder="Adresa din actul de identitate" /></label>
                  <div className="two-cols">
                    <label>Localitate<input value={identityData.city} onChange={(event) => updateIdentityField("city", event.target.value)} placeholder="Localitate" /></label>
                    <label>Judet<input value={identityData.county} onChange={(event) => updateIdentityField("county", event.target.value)} placeholder="Judet" /></label>
                  </div>
                  <div className="two-cols">
                    <label>Eliberat de<input value={identityData.issuedBy} onChange={(event) => updateIdentityField("issuedBy", event.target.value)} placeholder="SPCLEP..." /></label>
                    <label>Valabil pana la<input type="date" value={identityData.validUntil} onChange={(event) => updateIdentityField("validUntil", event.target.value)} /></label>
                  </div>
                </section>
              )}
              <div className="two-cols">
                <label>Nume<input name="lastName" value={identityData.lastName} onChange={(event) => updateIdentityField("lastName", event.target.value)} placeholder="Popescu" /></label>
                <label>Prenume<input name="firstName" value={identityData.firstName} onChange={(event) => updateIdentityField("firstName", event.target.value)} placeholder="Ion" /></label>
              </div>
              {needsCompanyData && (
                <section className="form-subsection company-register-card">
                  <div className="company-register-head">
                    <span><Building2 size={22} /></span>
                    <div>
                      <p className="eyebrow">Date publice</p>
                      <h2>{accountType === "institution" ? "Date institutie" : "Date persoana juridica"}</h2>
                      <p>Introdu CIF-ul si incercam sa completam automat datele publice. Daca serviciul nu raspunde, poti continua manual.</p>
                    </div>
                  </div>
                  <div className="company-lookup-card">
                    <div className="lookup-icon"><Database size={22} /></div>
                    <label>CIF / CUI
                      <input value={companyData.cif} onChange={(event) => updateCompanyField("cif", event.target.value)} placeholder="Ex: 48478795" />
                    </label>
                    <button className="primary-button lookup-action" type="button" onClick={lookupCompany} disabled={isLookingUpCompany}>
                      {isLookingUpCompany ? <RefreshCw size={18} className="spin-icon" /> : <Sparkles size={18} />}
                      {isLookingUpCompany ? "Se preiau" : "Preia date"}
                    </button>
                    <p className="lookup-hint">Sursa: servicii publice ANAF, cu fallback pe completare manuala.</p>
                  </div>
                  <div className="two-cols">
                    <label>Denumire<input value={companyData.name} onChange={(event) => updateCompanyField("name", event.target.value)} placeholder="Denumire oficiala" /></label>
                    <label>Nr. Registrul Comertului<input value={companyData.registrationNumber} onChange={(event) => updateCompanyField("registrationNumber", event.target.value)} placeholder="J..." /></label>
                  </div>
                  <label>Adresa<input value={companyData.address} onChange={(event) => updateCompanyField("address", event.target.value)} placeholder="Adresa sediu" /></label>
                  {companyData.status && <p className="company-status-pill">Status ANAF: {companyData.status}</p>}
                </section>
              )}
              {accountType === "institution" && (
                <p className="form-alert info">
                  Documentele institutiei se incarca dupa confirmarea emailului, intr-o zona separata de activare cont.
                </p>
              )}
            </>
          )}
          <label>Email<input name="email" type="email" placeholder="nume@example.com" required value={isLogin ? loginCredentials.email : undefined} onChange={isLogin ? (event) => setLoginCredentials((current) => ({ ...current, email: event.target.value })) : undefined} /></label>
          {mode !== "forgot" && <label>Parola<input name="password" type="password" placeholder="Minim 8 caractere" minLength={8} required value={isLogin ? loginCredentials.password : undefined} onChange={isLogin ? (event) => setLoginCredentials((current) => ({ ...current, password: event.target.value })) : undefined} /></label>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Se trimite..." : isLogin ? "Intra in cont" : isRegister ? "Creeaza cont" : "Trimite link resetare"}
          </button>
          {isLogin && (
            <div className="demo-accounts">
              <strong>Cont demo administrare</strong>
              {demoAccounts.filter((account) => account.group === "Cont demo administrare").map((account) => (
                <button type="button" key={account.email} onClick={() => fillDemoCredentials(account.email, account.password)}>
                  <span>{account.email}</span>
                  <em>{account.password}</em>
                </button>
              ))}
              <strong>Conturi demo utilizatori</strong>
              {demoAccounts.filter((account) => account.group === "Conturi demo utilizatori").map((account) => (
                <button type="button" key={account.email} onClick={() => fillDemoCredentials(account.email, account.password)}>
                  <span>{account.email}</span>
                  <em>{account.password}</em>
                </button>
              ))}
            </div>
          )}
        </form>}
        <div className="auth-links">
          {!isLogin && <Link href="/auth/login">Am deja cont</Link>}
          {isLogin && <Link href="/auth/register">Creeaza cont</Link>}
          {mode !== "forgot" && <Link href="/auth/forgot-password">Am uitat parola</Link>}
        </div>
      </section>
    </main>
  );
}
