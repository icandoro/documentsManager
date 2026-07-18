import { NextRequest, NextResponse } from "next/server";

type TaxpayerApiItem = {
  id: string;
  type: "person" | "company";
  name: string;
  identifier: string;
  locality: string;
  status: "legat" | "nelegat";
  institutionId: string;
  email?: string;
  phone?: string;
  address?: string;
  accountKind: "resident" | "property_owner" | "company_hq" | "company_property_owner";
  sentCount: number;
  receivedCount: number;
};

const firstNames = ["Ion", "Maria", "Andrei", "Elena", "Cristian", "Ioana", "Marius", "Ana", "Dumitru", "Roxana"];
const lastNames = ["Popescu", "Ionescu", "Marinescu", "Dumitrescu", "Stoica", "Vasilescu", "Georgescu", "Stan", "Moldovan", "Radu"];
const companyRoots = ["Nord Construct", "Agro Sud", "Digital Fiscal", "Urban Proiect", "Eco Servicii", "Delta Logistic", "Nova Instal", "Terra Imobiliare"];

function normalize(value: string) {
  return value.toLowerCase().replace(/^ro/, "").replace(/\s+/g, " ").trim();
}

function generateTaxpayers(institutionId: string): TaxpayerApiItem[] {
  const isPleasov = institutionId.includes("pleasov");
  const locality = isPleasov ? "Pleasov" : "Joita";
  const institutionSeed = isPleasov ? 7 : 3;
  const persons = Array.from({ length: 74 }, (_, index) => {
    const firstName = firstNames[(index + institutionSeed) % firstNames.length];
    const lastName = lastNames[(index * 2 + institutionSeed) % lastNames.length];
    const accountKind: TaxpayerApiItem["accountKind"] = index % 5 === 0 ? "property_owner" : "resident";
    const status: TaxpayerApiItem["status"] = index % 4 === 0 ? "nelegat" : "legat";

    return {
      id: `${institutionId}-pf-${index + 1}`,
      type: "person" as const,
      name: `${lastName} ${firstName}`,
      identifier: `${index % 2 ? "2" : "1"}9${String(60101 + index).padStart(5, "0")}${String(120000 + index + institutionSeed).slice(0, 6)}`,
      locality,
      status,
      institutionId,
      email: status === "legat" ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.ro` : undefined,
      phone: `+40 72${String(1000000 + index).slice(0, 7)}`,
      address: `Strada ${index % 3 === 0 ? "Principala" : "Livezii"} ${index + 1}, ${locality}`,
      accountKind,
      sentCount: (index * 3) % 17,
      receivedCount: (index * 5) % 19,
    };
  });
  const companies = Array.from({ length: 42 }, (_, index) => {
    const root = companyRoots[(index + institutionSeed) % companyRoots.length];
    const accountKind: TaxpayerApiItem["accountKind"] = index % 4 === 0 ? "company_property_owner" : "company_hq";
    const status: TaxpayerApiItem["status"] = index % 5 === 0 ? "nelegat" : "legat";

    return {
      id: `${institutionId}-pj-${index + 1}`,
      type: "company" as const,
      name: `${root} ${index + 1} SRL`,
      identifier: `RO${institutionSeed}${String(11223000 + index).slice(0, 8)}`,
      locality,
      status,
      institutionId,
      email: status === "legat" ? `office${index}@${root.toLowerCase().replace(/\s+/g, "")}.ro` : undefined,
      phone: `+40 31${String(2000000 + index).slice(0, 7)}`,
      address: `Strada Fabricii ${index + 2}, ${locality}`,
      accountKind,
      sentCount: (index * 4) % 21,
      receivedCount: (index * 2) % 18,
    };
  });

  return [...persons, ...companies];
}

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const institutionId = searchParams.get("institutionId") || "primaria-joita";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
  const query = normalize(searchParams.get("q") || "");
  const id = searchParams.get("id") || "";
  const type = searchParams.get("type") || "all";
  const status = searchParams.get("status") || "all";
  const accountKind = searchParams.get("accountKind") || "all";

  const allItems = generateTaxpayers(institutionId);
  const filtered = allItems.filter((item) => {
    const matchesId = !id || item.id === id;
    const matchesType = type === "all" || item.type === type;
    const matchesStatus = status === "all" || item.status === status;
    const matchesKind = accountKind === "all" || item.accountKind === accountKind;
    const matchesQuery = !query || [item.name, item.identifier, item.email ?? "", item.locality, item.address ?? ""]
      .some((value) => normalize(value).includes(query));

    return matchesId && matchesType && matchesStatus && matchesKind && matchesQuery;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return NextResponse.json({
    items,
    page: safePage,
    limit,
    total,
    totalPages,
    summary: {
      total: allItems.length,
      persons: allItems.filter((item) => item.type === "person").length,
      companies: allItems.filter((item) => item.type === "company").length,
      active: allItems.filter((item) => item.status === "legat").length,
    },
  });
}
