import { AppShell } from "@/components/AppShell";
import { ReceivedPackagesManager } from "@/components/ReceivedPackagesManager";

export default function ReceivedDocumentsPage() {
  return (
    <AppShell>
      <section className="page-head">
        <div>
          <p className="eyebrow">Documente primite</p>
          <h1>Grupate dupa expeditor si pachet</h1>
        </div>
      </section>
      <ReceivedPackagesManager />
    </AppShell>
  );
}
