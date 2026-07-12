import { AppShell } from "@/components/AppShell";
import { SentPackagesManager } from "@/components/SentPackagesManager";

export default function SentDocumentsPage() {
  return (
    <AppShell>
      <section className="page-head">
        <div>
          <p className="eyebrow">Documente trimise</p>
          <h1>Istoric pe destinatar si pachet</h1>
        </div>
      </section>
      <SentPackagesManager />
    </AppShell>
  );
}
