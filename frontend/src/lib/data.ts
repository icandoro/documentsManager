import { FileCheck, FileText, IdCard, ShieldCheck } from "lucide-react";

export const documents = [
  { id: 1, title: "Buletin", type: "Identitate", status: "Valid", size: "2.4 MB", icon: IdCard },
  { id: 2, title: "Contract de munca", type: "HR", status: "In asteptare semnare", size: "1.1 MB", icon: FileText },
  { id: 3, title: "Certificat nastere", type: "Civil", status: "Valid", size: "800 KB", icon: FileCheck },
  { id: 4, title: "Permis conducere", type: "Identitate", status: "Expira in 90 zile", size: "1.7 MB", icon: ShieldCheck }
];

export const receivedPackages = [
  {
    from: "Popescu Ion",
    email: "ion.popescu@example.com",
    packages: [
      { name: "Dosar angajare", date: "11 iul. 2026", documents: ["Buletin", "Contract de munca"], status: "Primit" },
      { name: "Actualizare date personale", date: "8 iul. 2026", documents: ["Certificat nastere"], status: "Necesita verificare" }
    ]
  },
  {
    from: "Acme HR",
    email: "hr@acme.test",
    packages: [
      { name: "Semnare acte aditionale", date: "5 iul. 2026", documents: ["Act aditional", "Declaratie GDPR"], status: "Semnare solicitata" }
    ]
  }
];

export const sentPackages = [
  {
    to: "Ionescu Maria",
    email: "maria.ionescu@example.com",
    packages: [
      { name: "Dosar credit", date: "10 iul. 2026", documents: ["Buletin", "Contract de munca"], status: "Deschis de destinatar" }
    ]
  },
  {
    to: "Banca Demo",
    email: "verificari@banca-demo.test",
    packages: [
      { name: "Verificare identitate", date: "2 iul. 2026", documents: ["Buletin", "Permis conducere"], status: "Trimis" }
    ]
  }
];
