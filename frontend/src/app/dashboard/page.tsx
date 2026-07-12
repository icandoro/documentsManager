import { AppShell } from "@/components/AppShell";
import { documents, receivedPackages, sentPackages } from "@/lib/data";
import { ArrowUpRight, FileInput, FileOutput, Files, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="page-head">
        <div>
          <p className="eyebrow">Panou control</p>
          <h1>Activitate documente</h1>
        </div>
        <Link href="/documents" className="primary-button">Incarca document</Link>
      </section>
      <section className="stats-grid">
        <article><Files /><strong>{documents.length}</strong><span>Documente salvate</span></article>
        <article><FileInput /><strong>{receivedPackages.length}</strong><span>Surse primite</span></article>
        <article><FileOutput /><strong>{sentPackages.length}</strong><span>Destinatari trimisi</span></article>
        <article><ShieldCheck /><strong>2FA</strong><span>Activare recomandata</span></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <h2>Pachete primite recent</h2>
          {receivedPackages.map((group) => (
            <div className="package-row" key={group.email}>
              <div>
                <strong>{group.from}</strong>
                <p>{group.packages[0].name} · {group.packages[0].documents.length} documente</p>
              </div>
              <ArrowUpRight size={18} />
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>Urmatoarele actiuni</h2>
          <div className="task-list">
            <span>Finalizeaza profilul juridic</span>
            <span>Activeaza verificarea in doi pasi</span>
            <span>Pregateste fluxul pentru semnare digitala</span>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
